// src/screens/Collaboration/ProjectDetailScreen.jsx - ARVDOUL PROJECT DETAIL
// Per Constitution v5.0 - Team, content versions, review workflow
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../../lib/utils';
import collaborationService, { COLLABORATION_CONFIG } from '../../services/collaborationService';
import { copyToClipboard } from '../../utils/shareUtils';
import { 
  ArrowLeft, Users, Clock, FileText, CheckCircle, XCircle, 
  MessageCircle, Share2, MoreVertical, Plus, Eye, Download, Loader2
} from 'lucide-react';

const formatRelativeTime = (value) => {
  if (!value) return 'just now';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return 'recently';
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const STATUS_CONFIG = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: FileText },
  pending_review: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
  changes_requested: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
  published: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Eye },
};

export default function ProjectDetailScreen() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  const [activeTab, setActiveTab] = useState('content');
  const [project, setProject] = useState(null);
  const [team, setTeam] = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [busyVersionId, setBusyVersionId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const loadProject = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const projectData = await collaborationService.getProject(projectId);
      const [teamData, contentData] = await Promise.all([
        collaborationService.getTeam(projectId),
        collaborationService.getContentVersions(projectId),
      ]);

      setProject(projectData);
      setTeam(teamData || []);
      setContent(contentData || []);

      // Resolve the viewer's real role from the team roster; only the owner may
      // delete the project (mirrors collaborationService.deleteProject).
      const role = projectData?.ownerId === user?.uid
        ? 'owner'
        : (teamData || []).find(m => m.userId === user?.uid)?.role || null;
      setMyRole(role);
      setIsOwner(role === 'owner');
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.uid]);

  const handleShareProject = async () => {
    const url = `${window.location.origin}/collaboration/${projectId}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: project?.name || 'Arvdoul project', url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await copyToClipboard(url);
      toast.success('Project link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleDeleteProject = async () => {
    if (!isOwner || deleting) return;
    setDeleting(true);
    try {
      await collaborationService.deleteProject(projectId, user.uid, 'owner');
      toast.success('Project deleted');
      navigate('/collaboration');
    } catch (err) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  // Submits a specific draft version into the review workflow.
  const handleSubmitVersion = async (versionId) => {
    setBusyVersionId(versionId);
    try {
      await collaborationService.submitForReview(projectId, versionId, user.uid, myRole);
      toast.success('Version submitted for review');
      await loadProject();
    } catch (err) {
      toast.error(err.message || 'Could not submit for review');
    } finally {
      setBusyVersionId(null);
    }
  };

  // Creates a real draft version so "Add Content" writes to Firestore.
  const handleAddContent = async () => {
    const title = draftTitle.trim();
    if (creating || !title) return;
    setCreating(true);
    try {
      await collaborationService.createContentVersion(
        projectId,
        { title, type: 'article', state: COLLABORATION_CONFIG.REVIEW_STATES.DRAFT },
        user.uid,
        myRole,
      );
      toast.success('Draft version created');
      setDraftTitle('');
      setComposerOpen(false);
      await loadProject();
    } catch (err) {
      toast.error(err.message || 'Could not create content');
    } finally {
      setCreating(false);
    }
  };

  const handleReview = async (versionId, decision) => {
    setBusyVersionId(versionId);
    try {
      await collaborationService.reviewContent(projectId, versionId, decision, '', user.uid, myRole);
      toast.success(decision === 'approve' ? 'Version approved' : 'Changes requested');
      await loadProject();
    } catch (err) {
      toast.error(err.message || 'Could not record review');
    } finally {
      setBusyVersionId(null);
    }
  };

  const handlePublish = async (versionId) => {
    setBusyVersionId(versionId);
    try {
      await collaborationService.publishContent(projectId, versionId, user.uid, myRole);
      toast.success('Version published');
      await loadProject();
    } catch (err) {
      toast.error(err.message || 'Could not publish version');
    } finally {
      setBusyVersionId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={backgroundStyle}>
        <Loader2 className="w-8 h-8 animate-spin text-arvdoul-purple" />
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={backgroundStyle}>
        <p className="text-red-400 mb-4">{error || 'Project not found'}</p>
        <button 
          onClick={() => navigate('/collaboration')}
          className="px-4 py-2 rounded-lg bg-arvdoul-purple text-white"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const reviewStates = COLLABORATION_CONFIG.REVIEW_STATES;
  const pendingReviews = content.filter(v => v.state === reviewStates.PENDING_REVIEW);
  const decidedReviews = content.filter(v =>
    v.state === reviewStates.APPROVED ||
    v.state === reviewStates.CHANGES_REQUESTED ||
    v.state === reviewStates.PUBLISHED
  );
  const hasDraft = content.some(v => v.state === reviewStates.DRAFT);
  const canReview = collaborationService.canReviewContent(myRole);
  const canEdit = collaborationService.canEditContent(myRole);
  const canPublish = collaborationService.canPublishContent(myRole);

  const tabs = [
    { id: 'content', label: 'Content', count: content.length },
    { id: 'team', label: 'Team', count: team.length },
    { id: 'reviews', label: 'Reviews', count: pendingReviews.length + decidedReviews.length },
  ];

  return (
    <div className="min-h-screen pb-20" style={backgroundStyle}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        {/* Cover Image */}
        <div className="h-48 relative">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-900/70 to-blue-900/70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* More Options */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setShowOptions(v => !v)}
              aria-label="Project options"
              aria-expanded={showOptions}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                <div className="absolute right-0 mt-2 z-50 w-48 rounded-xl bg-gray-900 border border-white/15 shadow-xl overflow-hidden">
                  <button
                    onClick={() => { setShowOptions(false); handleShareProject(); }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <Share2 className="w-4 h-4" /> Share project
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => { setShowOptions(false); handleDeleteProject(); }}
                      disabled={deleting}
                      className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete project'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Project Info */}
        <div className="px-4 -mt-12 relative z-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-white mb-1">
                {project.name}
              </h1>
              <p className="text-sm text-gray-300">{project.description}</p>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              STATUS_CONFIG[project.status]?.bg || 'bg-gray-500/20',
              STATUS_CONFIG[project.status]?.text || 'text-gray-400'
            )}>
              {project.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
          
          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Updated {project.updatedAt}
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {team.length} members
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className={cn(
          "flex gap-1 p-1 rounded-arvdoul-lg",
          isDark ? "bg-white/5" : "bg-gray-100"
        )}>
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-2 px-3 rounded-arvdoul-md text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-arvdoul-gradient text-white"
                  : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {tab.label} ({tab.count})
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4">
        {activeTab === 'content' && (
          <div className="space-y-3">
            {content.length === 0 && (
              <div className="py-12 text-center text-arvdoul-text-secondary">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-60" />
                <p className="text-sm">No content versions yet. Add the first one below.</p>
              </div>
            )}

            {content.map((item, index) => {
              const status = STATUS_CONFIG[item.state] || STATUS_CONFIG.draft;
              const StatusIcon = status.icon;
              const meta = item.content || {};

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-arvdoul-lg",
                    "bg-arvdoul-surface border border-arvdoul-border"
                  )}
                >
                  {meta.thumbnail ? (
                    <img src={meta.thumbnail} alt={meta.title || 'Version'} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{meta.title || `Version ${index + 1}`}</h4>
                    <p className="text-xs text-gray-400 capitalize">
                      {(meta.type || 'video')} • {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                  <div className={cn("flex items-center gap-2", status.text)}>
                    <span className="text-xs font-medium capitalize">{item.state?.replace(/_/g, ' ')}</span>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  {item.state === reviewStates.DRAFT && canEdit && (
                    <button
                      onClick={() => handleSubmitVersion(item.id)}
                      disabled={busyVersionId === item.id}
                      className="px-3 py-1.5 rounded-lg bg-arvdoul-purple/20 text-arvdoul-purple text-xs font-semibold hover:bg-arvdoul-purple/30 disabled:opacity-50 transition-colors"
                    >
                      {busyVersionId === item.id ? 'Submitting…' : 'Submit for review'}
                    </button>
                  )}
                  {item.state === reviewStates.APPROVED && canPublish && (
                    <button
                      onClick={() => handlePublish(item.id)}
                      disabled={busyVersionId === item.id}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                    >
                      {busyVersionId === item.id ? 'Publishing…' : 'Publish'}
                    </button>
                  )}
                </motion.div>
              );
            })}

            {canEdit && (composerOpen ? (
              <div className="p-3 rounded-arvdoul-lg bg-arvdoul-surface border border-arvdoul-border space-y-3">
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddContent(); }}
                  placeholder="Name this content version"
                  className="w-full px-3 py-2 rounded-lg bg-black/20 border border-arvdoul-border text-white text-sm outline-none focus:border-arvdoul-purple"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => { setComposerOpen(false); setDraftTitle(''); }}
                    className="px-3 py-1.5 rounded-lg text-arvdoul-text-secondary text-sm hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContent}
                    disabled={creating || !draftTitle.trim()}
                    className="px-4 py-1.5 rounded-lg bg-arvdoul-purple text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                  >
                    {creating ? 'Creating…' : 'Create draft'}
                  </button>
                </div>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setComposerOpen(true)}
                className={cn(
                  "w-full py-3 rounded-arvdoul-lg border border-dashed border-arvdoul-border",
                  "text-arvdoul-text-secondary hover:text-white hover:border-arvdoul-purple/50",
                  "flex items-center justify-center gap-2 transition-all"
                )}
              >
                <Plus className="w-5 h-5" />
                Add Content
              </motion.button>
            ))}
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-3">
            {team.length === 0 && (
              <p className="py-12 text-center text-sm text-arvdoul-text-secondary">No team members yet.</p>
            )}
            {team.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-arvdoul-lg",
                  "bg-arvdoul-surface border border-arvdoul-border"
                )}
              >
                {member.avatar ? (
                  <img src={member.avatar} alt={member.name || member.userId} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-arvdoul-purple/20 flex items-center justify-center text-arvdoul-purple font-semibold">
                    {(member.name || member.userId || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{member.name || member.userId}</h4>
                  {member.email && <p className="text-sm text-gray-400 truncate">{member.email}</p>}
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs capitalize",
                  member.role === 'owner' ? "bg-arvdoul-purple/20 text-arvdoul-purple" : "bg-gray-500/20 text-gray-400"
                )}>
                  {member.role}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {pendingReviews.length === 0 && decidedReviews.length === 0 && (
              <p className="py-12 text-center text-sm text-arvdoul-text-secondary">No versions in the review workflow.</p>
            )}

            {pendingReviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-arvdoul-text-secondary">Awaiting review</h3>
                {pendingReviews.map((version) => (
                  <div key={version.id} className={cn("p-4 rounded-arvdoul-lg bg-arvdoul-surface border border-arvdoul-border")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-medium text-white truncate">{version.content?.title || 'Untitled version'}</h4>
                        <p className="text-xs text-gray-400">Submitted {formatRelativeTime(version.submittedAt)}</p>
                      </div>
                      {canReview && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReview(version.id, 'approve')}
                            disabled={busyVersionId === version.id}
                            className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(version.id, 'request_changes')}
                            disabled={busyVersionId === version.id}
                            className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
                          >
                            Request changes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {decidedReviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-arvdoul-text-secondary">Decided</h3>
                {decidedReviews.map((version) => {
                  const status = STATUS_CONFIG[version.state] || STATUS_CONFIG.draft;
                  const StatusIcon = status.icon;
                  return (
                    <div key={version.id} className={cn("p-4 rounded-arvdoul-lg bg-arvdoul-surface border border-arvdoul-border")}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h4 className="font-medium text-white truncate">{version.content?.title || 'Untitled version'}</h4>
                        <div className={cn("flex items-center gap-1.5 text-xs font-medium", status.text)}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="capitalize">{version.state?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      {version.reviewFeedback && (
                        <p className="text-sm text-gray-300">{version.reviewFeedback}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
