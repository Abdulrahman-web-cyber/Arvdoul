// src/screens/Collaboration/ProjectDashboardScreen.jsx
//
// Per Constitution v5.0 - Grid of collaboration projects

import { useState, useMemo, useEffect, useCallback } from "react";
import { brandCanvasBackground, BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../../lib/utils';
import collaborationService from '../../services/collaborationService';
import { copyToClipboard } from '../../utils/shareUtils';
import { Dialog } from '../../components/UI/Dialog';
import {
  Plus, Folder, Clock, Search, Filter, Loader2, Users,
  Handshake, KeyRound, CheckCircle2, XCircle, Copy, BarChart3, ShieldCheck, ExternalLink,
} from "lucide-react";
import { LazyImage } from '../../components/Shared/LazyImage';

const STATUS_COLORS = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Draft' },
  in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Progress' },
  review: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Review' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
};

const PARTNERSHIP_STATUS_STYLE = {
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  completed: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  declined: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  cancelled: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const CONTENT_TYPES = [
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'article', label: 'Article' },
  { id: 'thumbnail', label: 'Thumbnail' },
];

export default function ProjectDashboardScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postIdParam = searchParams.get('postId') || '';
  const tabParam = searchParams.get('tab') || (postIdParam ? 'partnerships' : 'projects');

  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark' || theme === 'midnight';
  const [hubTab, setHubTab] = useState(tabParam === 'partnerships' ? 'partnerships' : 'projects');

  // Projects state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newProject, setNewProject] = useState({ name: '', description: '', contentType: 'video' });

  // Brand Partnerships & Ad Authorizations state
  const [partnerships, setPartnerships] = useState([]);
  const [authorizations, setAuthorizations] = useState([]);
  const [partnershipsLoading, setPartnershipsLoading] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [creatingPartnership, setCreatingPartnership] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    title: '',
    brandName: '',
    brandId: '',
    creatorId: '',
    compensationUsd: '',
    disclosureType: 'paid_partnership',
    deliverableText: '1 Main Post + 1 Spark Story',
  });
  const [busyPartnershipId, setBusyPartnershipId] = useState(null);
  const [expandedAnalytics, setExpandedAnalytics] = useState({});
  const [analyticsBusyId, setAnalyticsBusyId] = useState(null);

  const [authForm, setAuthForm] = useState({
    postId: postIdParam,
    partnerId: '',
    partnerName: '',
    expiresInDays: 30,
  });
  const [grantingAuth, setGrantingAuth] = useState(false);
  const [revokingAuthId, setRevokingAuthId] = useState(null);

  const loadProjects = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const stats = await collaborationService.getStats(user.uid);
      setProjects(stats?.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const loadPartnershipsAndAuth = useCallback(async () => {
    if (!user?.uid) return;
    setPartnershipsLoading(true);
    try {
      const [pRes, aRes] = await Promise.allSettled([
        collaborationService.listBrandPartnerships(),
        collaborationService.listAdAuthorizations(),
      ]);
      if (pRes.status === 'fulfilled') {
        setPartnerships(Array.isArray(pRes.value?.partnerships) ? pRes.value.partnerships : []);
      }
      if (aRes.status === 'fulfilled') {
        setAuthorizations(Array.isArray(aRes.value?.authorizations) ? aRes.value.authorizations : []);
      }
    } catch (err) {
      console.warn('Failed to load brand partnerships:', err);
    } finally {
      setPartnershipsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadProjects();
    loadPartnershipsAndAuth();
  }, [loadProjects, loadPartnershipsAndAuth]);

  const handleCreateProject = async () => {
    const name = newProject.name.trim();
    if (!name || creating) return;
    try {
      setCreating(true);
      setCreateError(null);
      const project = await collaborationService.createProject({
        name,
        description: newProject.description.trim(),
        contentType: newProject.contentType,
      });
      setCreateOpen(false);
      setNewProject({ name: '', description: '', contentType: 'video' });
      if (project?.id) navigate(`/collaboration/${project.id}`);
      else await loadProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
      setCreateError(err.message || 'Could not create the project.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePartnership = async (e) => {
    e.preventDefault();
    if (!user?.uid || creatingPartnership) return;
    const title = partnerForm.title.trim();
    const brandName = partnerForm.brandName.trim();
    if (!title || !brandName) {
      toast.error('Campaign title and brand name are required.');
      return;
    }
    const compensationCents = Math.max(0, Math.round((Number(partnerForm.compensationUsd) || 0) * 100));
    const deliverables = partnerForm.deliverableText
      .split(',')
      .map((s, idx) => ({ id: `del_${idx + 1}`, title: s.trim(), completed: false, postId: postIdParam || null }))
      .filter((d) => d.title.length > 0);

    setCreatingPartnership(true);
    try {
      await collaborationService.createBrandPartnership({
        creatorId: partnerForm.creatorId.trim() || user.uid,
        brandId: partnerForm.brandId.trim() || user.uid,
        brandName,
        title,
        compensationCents,
        currency: 'USD',
        deliverables,
        disclosureType: partnerForm.disclosureType,
      });
      toast.success('Brand partnership created');
      setPartnerModalOpen(false);
      setPartnerForm({
        title: '',
        brandName: '',
        brandId: '',
        creatorId: '',
        compensationUsd: '',
        disclosureType: 'paid_partnership',
        deliverableText: '1 Main Post + 1 Spark Story',
      });
      await loadPartnershipsAndAuth();
    } catch (err) {
      toast.error(err?.message || 'Could not create partnership');
    } finally {
      setCreatingPartnership(false);
    }
  };

  const handleRespondPartnership = async (partnershipId, decision) => {
    setBusyPartnershipId(partnershipId);
    try {
      await collaborationService.respondBrandPartnership(partnershipId, decision);
      toast.success(`Partnership ${decision}ed`);
      await loadPartnershipsAndAuth();
    } catch (err) {
      toast.error(err?.message || 'Could not update partnership');
    } finally {
      setBusyPartnershipId(null);
    }
  };

  const handleToggleDeliverable = async (partnershipId, deliverable) => {
    setBusyPartnershipId(partnershipId);
    try {
      await collaborationService.updatePartnershipDeliverable(
        partnershipId,
        deliverable.id,
        !deliverable.completed,
        deliverable.postId || postIdParam || null,
      );
      toast.success('Deliverable updated');
      await loadPartnershipsAndAuth();
    } catch (err) {
      toast.error(err?.message || 'Could not update deliverable');
    } finally {
      setBusyPartnershipId(null);
    }
  };

  const handleToggleAnalytics = async (partnershipId) => {
    if (expandedAnalytics[partnershipId]) {
      setExpandedAnalytics((prev) => {
        const next = { ...prev };
        delete next[partnershipId];
        return next;
      });
      return;
    }
    setAnalyticsBusyId(partnershipId);
    try {
      const res = await collaborationService.getPartnershipAnalytics(partnershipId);
      setExpandedAnalytics((prev) => ({ ...prev, [partnershipId]: res }));
    } catch (err) {
      toast.error(err?.message || 'Could not load partnership analytics');
    } finally {
      setAnalyticsBusyId(null);
    }
  };

  const handleGrantAuth = async (e) => {
    e.preventDefault();
    const postId = authForm.postId.trim();
    if (!postId || grantingAuth) {
      if (!postId) toast.error('Post ID is required to generate an ad authorization code.');
      return;
    }
    setGrantingAuth(true);
    try {
      const res = await collaborationService.grantAdAuthorization({
        postId,
        partnerId: authForm.partnerId.trim() || null,
        partnerName: authForm.partnerName.trim(),
        expiresInDays: Number(authForm.expiresInDays) || 30,
      });
      toast.success(res?.authCode ? `Authorization granted: ${res.authCode}` : 'Ad authorization granted');
      setAuthForm((f) => ({ ...f, partnerId: '', partnerName: '' }));
      await loadPartnershipsAndAuth();
    } catch (err) {
      toast.error(err?.message || 'Could not grant ad authorization');
    } finally {
      setGrantingAuth(false);
    }
  };

  const handleRevokeAuth = async (authorizationId) => {
    setRevokingAuthId(authorizationId);
    try {
      await collaborationService.revokeAdAuthorization(authorizationId);
      toast.success('Ad authorization revoked');
      await loadPartnershipsAndAuth();
    } catch (err) {
      toast.error(err?.message || 'Could not revoke authorization');
    } finally {
      setRevokingAuthId(null);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = (project.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const backgroundStyle = useMemo(() => ({
    background: brandCanvasBackground(isDark),
  }), [isDark]);

  return (
    <div className="min-h-screen pb-24" style={backgroundStyle}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Go back"
              onClick={() => navigate(-1)}
              className={cn("p-2 rounded-full", isDark ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-slate-800")}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className={cn("text-2xl font-display font-bold", isDark ? "text-white" : "text-slate-900")}>
                Collaboration Studio
              </h1>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                Shared creator projects, brand partnerships, and partner ad authorizations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hubTab === 'projects' ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setCreateError(null); setCreateOpen(true); }}
                style={{ background: BRAND_GRADIENT }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Project
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setPartnerModalOpen(true)}
                style={{ background: BRAND_GRADIENT }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-md cursor-pointer"
              >
                <Handshake className="w-4 h-4" />
                New Brand Partnership
              </motion.button>
            )}
          </div>
        </div>

        {/* Mode Switcher */}
        <div className={cn(
          "inline-flex p-1 rounded-2xl border",
          isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <button
            type="button"
            onClick={() => setHubTab('projects')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              hubTab === 'projects'
                ? "text-white shadow-sm"
                : isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}
            style={hubTab === 'projects' ? { background: BRAND_GRADIENT } : undefined}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Projects ({projects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setHubTab('partnerships')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              hubTab === 'partnerships'
                ? "text-white shadow-sm"
                : isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}
            style={hubTab === 'partnerships' ? { background: BRAND_GRADIENT } : undefined}
          >
            <Handshake className="w-3.5 h-3.5" />
            <span>Brand Partnerships &amp; Ad Auth ({partnerships.length})</span>
          </button>
        </div>

        {hubTab === 'projects' && (
          <div className="flex gap-3">
            <div className={cn(
              "flex-1 flex items-center gap-2 px-4 py-2 rounded-arvdoul-md border",
              isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
            )}>
              <Search className="w-5 h-5 text-arvdoul-text-secondary" />
              <input aria-label="Search projects"
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("flex-1 bg-transparent placeholder:text-arvdoul-text-secondary outline-none text-sm", isDark ? "text-white" : "text-slate-900")}
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterMenu(v => !v)}
                aria-label="Filter projects by status"
                aria-expanded={showFilterMenu}
                className={cn(
                  "p-3 rounded-arvdoul-md border",
                  isDark ? "bg-arvdoul-surface border-arvdoul-border text-white" : "bg-white border-slate-200 text-slate-700",
                  statusFilter !== 'all' && "ring-1 ring-arvdoul-purple"
                )}
              >
                <Filter className="w-5 h-5" />
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className={cn(
                    "absolute right-0 mt-2 z-50 w-44 rounded-arvdoul-md border shadow-xl overflow-hidden",
                    isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
                  )}>
                    {[{ id: 'all', label: 'All statuses' }, ...Object.entries(STATUS_COLORS).map(([id, cfg]) => ({ id, label: cfg.label }))].map(opt => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => { setStatusFilter(opt.id); setShowFilterMenu(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm transition-colors",
                          statusFilter === opt.id ? "text-arvdoul-purple font-semibold" : "text-arvdoul-text-secondary hover:text-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4">
        {hubTab === 'projects' ? (
          <>
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-arvdoul-purple" />
              </div>
            )}

            {error && !loading && (
              <div className="text-center py-12">
                <p className="text-red-400 mb-4">Failed to load projects: {error}</p>
                <button
                  type="button"
                  onClick={loadProjects}
                  className="px-4 py-2 rounded-lg bg-arvdoul-purple text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <Folder className="w-12 h-12 mx-auto text-arvdoul-text-secondary mb-4" />
                <p className="text-arvdoul-text-secondary mb-2">No projects yet</p>
                <p className="text-sm text-arvdoul-text-secondary/70">Create your first collaboration project</p>
              </div>
            )}

            {!loading && !error && filteredProjects.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredProjects.map((project, index) => {
                  const status = STATUS_COLORS[project.status] || STATUS_COLORS.draft;
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -4 }}
                      className={cn(
                        "rounded-arvdoul-xl overflow-hidden border cursor-pointer transition-all duration-300",
                        isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200 shadow-sm"
                      )}
                      onClick={() => navigate(`/collaboration/${project.id}`)}
                    >
                      <div className="h-32 relative">
                        {project.thumbnail ? (
                          <LazyImage
                            src={project.thumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-800/70 via-indigo-800/70 to-blue-900/70 flex items-center justify-center">
                            <Folder className="w-10 h-10 text-white/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className={cn(
                          "absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium",
                          status.bg, status.text
                        )}>
                          {status.label}
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className={cn("font-semibold mb-1", isDark ? "text-white" : "text-slate-900")}>{project.name}</h3>
                        <p className="text-sm text-arvdoul-text-secondary mb-3 line-clamp-1">
                          {project.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-arvdoul-text-secondary">
                            <Users className="w-3.5 h-3.5" />
                            {project.memberCount != null
                              ? `${project.memberCount} member${project.memberCount === 1 ? '' : 's'}`
                              : 'Members unavailable'}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-arvdoul-text-secondary">
                            <Clock className="w-3 h-3" />
                            {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {/* Spark & Post Ad Authorizations Section */}
            <section className={cn(
              "p-5 rounded-3xl border space-y-4",
              isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            )}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className={cn("text-base font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                    <KeyRound className="w-4 h-4 text-purple-500" />
                    <span>Spark &amp; Post Ad Authorizations</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generate time-bounded ad authorization codes so brand partners can amplify an existing organic post without duplicating it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/ads/create')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 text-purple-500 hover:bg-purple-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ads Center</span>
                </button>
              </div>

              <form onSubmit={handleGrantAuth} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  aria-label="Post ID to authorize"
                  type="text"
                  value={authForm.postId}
                  onChange={(e) => setAuthForm((f) => ({ ...f, postId: e.target.value }))}
                  placeholder="Post ID *"
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl border text-xs outline-none",
                    isDark ? "bg-white/[0.04] border-white/[0.1] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
                <input
                  aria-label="Brand partner name"
                  type="text"
                  value={authForm.partnerName}
                  onChange={(e) => setAuthForm((f) => ({ ...f, partnerName: e.target.value }))}
                  placeholder="Partner / Brand name"
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl border text-xs outline-none",
                    isDark ? "bg-white/[0.04] border-white/[0.1] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
                <select
                  aria-label="Authorization duration"
                  value={authForm.expiresInDays}
                  onChange={(e) => setAuthForm((f) => ({ ...f, expiresInDays: Number(e.target.value) }))}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl border text-xs outline-none",
                    isDark ? "bg-[#0B1437] border-white/[0.1] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
                <button
                  type="submit"
                  disabled={grantingAuth || !authForm.postId.trim()}
                  style={{ background: BRAND_GRADIENT }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {grantingAuth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{grantingAuth ? 'Generating…' : 'Generate Auth Code'}</span>
                </button>
              </form>

              {authorizations.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No ad authorization codes issued yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {authorizations.map((auth) => {
                    const isRevoked = auth.status === 'revoked';
                    return (
                      <div
                        key={auth.id}
                        className={cn(
                          "p-3.5 rounded-2xl border flex items-center justify-between gap-3",
                          isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-purple-500 truncate">{auth.authCode}</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              isRevoked ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-500"
                            )}>
                              {auth.status || 'active'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Post: <span className="font-mono">{auth.postId}</span> · Partner: {auth.partnerName || 'Any'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            aria-label={`Copy auth code ${auth.authCode}`}
                            onClick={async () => {
                              await copyToClipboard(auth.authCode);
                              toast.success('Auth code copied');
                            }}
                            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {!isRevoked && (
                            <button
                              type="button"
                              disabled={revokingAuthId === auth.id}
                              onClick={() => handleRevokeAuth(auth.id)}
                              className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                            >
                              {revokingAuthId === auth.id ? 'Revoking…' : 'Revoke'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Brand Partnerships List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className={cn("text-base font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
                  <Handshake className="w-4 h-4 text-blue-500" />
                  <span>Brand Partnerships ({partnerships.length})</span>
                </h2>
                {partnershipsLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
              </div>

              {!partnershipsLoading && partnerships.length === 0 ? (
                <div className={cn(
                  "p-8 rounded-3xl border text-center space-y-2",
                  isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <Handshake className="w-10 h-10 mx-auto text-slate-400" />
                  <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    No brand partnerships yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Create a formal partnership with deliverables, disclosure type, and campaign performance reporting.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {partnerships.map((p) => {
                    const busy = busyPartnershipId === p.id;
                    const analyticsData = expandedAnalytics[p.id];
                    const statusCls = PARTNERSHIP_STATUS_STYLE[p.status] || PARTNERSHIP_STATUS_STYLE.pending;
                    const compDollars = typeof p.compensationCents === 'number'
                      ? `$${(p.compensationCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—';

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "p-5 rounded-3xl border space-y-4",
                          isDark ? "bg-[#080F2E] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
                                {p.title}
                              </h3>
                              <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize", statusCls)}>
                                {p.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Brand: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{p.brandName}</strong> · Disclosure: {(p.disclosureType || 'paid_partnership').replace(/_/g, ' ')} · Compensation: <span className="tabular-nums font-semibold">{compDollars} {p.currency || 'USD'}</span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {p.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleRespondPartnership(p.id, 'accept')}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleRespondPartnership(p.id, 'decline')}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Decline
                                </button>
                              </>
                            )}
                            {p.status === 'active' && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleRespondPartnership(p.id, 'complete')}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 disabled:opacity-50 cursor-pointer"
                                >
                                  Mark Complete
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleRespondPartnership(p.id, 'cancel')}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              disabled={analyticsBusyId === p.id}
                              onClick={() => handleToggleAnalytics(p.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                            >
                              {analyticsBusyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5 text-purple-500" />}
                              <span>{analyticsData ? 'Hide Analytics' : 'Analytics'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Deliverables */}
                        {Array.isArray(p.deliverables) && p.deliverables.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Deliverables
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {p.deliverables.map((del) => (
                                <button
                                  type="button"
                                  key={del.id}
                                  disabled={busy}
                                  onClick={() => handleToggleDeliverable(p.id, del)}
                                  className={cn(
                                    "p-2.5 rounded-xl border text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer",
                                    del.completed
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                      : isDark ? "bg-white/[0.03] border-white/[0.08] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                                  )}
                                >
                                  <span className="truncate font-medium">{del.title}</span>
                                  <span className="text-[10px] font-bold uppercase shrink-0">
                                    {del.completed ? 'Done' : 'Pending'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Expanded Partnership Analytics */}
                        {analyticsData && (
                          <div className={cn(
                            "p-3.5 rounded-2xl border space-y-2",
                            isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                          )}>
                            <p className="text-xs font-bold text-purple-500">Linked Post Performance</p>
                            {!analyticsData.posts || analyticsData.posts.length === 0 ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                No deliverable posts linked yet. Complete a deliverable while linking a Post ID to measure reach here.
                              </p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {analyticsData.posts.map((postStat) => (
                                  <div key={postStat.postId} className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono font-semibold truncate">{postStat.postId}</span>
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/post/${postStat.postId}/analytics`)}
                                        className="text-purple-500 font-semibold hover:underline"
                                      >
                                        Details
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                      <span>Views: {postStat.views ?? '—'}</span>
                                      <span>Likes: {postStat.likes ?? '—'}</span>
                                      <span>Comments: {postStat.comments ?? '—'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Create Collaboration Project Dialog */}
      <Dialog
        isOpen={createOpen}
        onClose={() => { if (!creating) setCreateOpen(false); }}
        title="New collaboration project"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="collab-name" className="block text-sm font-medium mb-1.5">
              Project name
            </label>
            <input
              id="collab-name"
              type="text"
              value={newProject.name}
              maxLength={120}
              onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Launch film — co-authored cut"
              className={cn(
                "w-full px-4 py-2.5 rounded-arvdoul-md outline-none border",
                "bg-arvdoul-surface border-arvdoul-border focus:border-arvdoul-purple text-white placeholder:text-arvdoul-text-secondary"
              )}
            />
          </div>

          <div>
            <label htmlFor="collab-desc" className="block text-sm font-medium mb-1.5">
              Description <span className="text-arvdoul-text-secondary">(optional)</span>
            </label>
            <textarea
              id="collab-desc"
              value={newProject.description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setNewProject(p => ({ ...p, description: e.target.value }))}
              placeholder="What are you and your team building?"
              className={cn(
                "w-full px-4 py-2.5 rounded-arvdoul-md outline-none border resize-none",
                "bg-arvdoul-surface border-arvdoul-border focus:border-arvdoul-purple text-white placeholder:text-arvdoul-text-secondary"
              )}
            />
          </div>

          <div>
            <span className="block text-sm font-medium mb-1.5">Content type</span>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setNewProject(p => ({ ...p, contentType: type.id }))}
                  className={cn(
                    "px-3.5 py-2 rounded-arvdoul-md text-sm border transition-colors",
                    newProject.contentType === type.id
                      ? "bg-arvdoul-purple text-white border-arvdoul-purple"
                      : "bg-arvdoul-surface border-arvdoul-border text-arvdoul-text-secondary hover:text-white"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {createError && (
            <p role="alert" className="text-sm text-red-400">{createError}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              className={cn(
                "px-4 py-2.5 rounded-arvdoul-md border text-sm font-medium",
                "bg-arvdoul-surface border-arvdoul-border text-arvdoul-text-secondary",
                creating && "opacity-50"
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={creating || !newProject.name.trim()}
              onClick={handleCreateProject}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-arvdoul-md text-sm font-medium text-white",
                "bg-arvdoul-gradient shadow-arvdoul-button",
                (creating || !newProject.name.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* New Brand Partnership Dialog */}
      <Dialog
        isOpen={partnerModalOpen}
        onClose={() => { if (!creatingPartnership) setPartnerModalOpen(false); }}
        title="New Brand Partnership"
      >
        <form onSubmit={handleCreatePartnership} className="space-y-4">
          <div>
            <label htmlFor="bp-title" className="block text-xs font-semibold mb-1">Partnership Title *</label>
            <input
              id="bp-title"
              type="text"
              required
              value={partnerForm.title}
              onChange={(e) => setPartnerForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Summer Collection Launch"
              className="w-full px-3.5 py-2.5 rounded-xl bg-arvdoul-surface border border-arvdoul-border text-sm text-white outline-none"
            />
          </div>
          <div>
            <label htmlFor="bp-brand" className="block text-xs font-semibold mb-1">Brand Name *</label>
            <input
              id="bp-brand"
              type="text"
              required
              value={partnerForm.brandName}
              onChange={(e) => setPartnerForm((f) => ({ ...f, brandName: e.target.value }))}
              placeholder="Partner company or brand"
              className="w-full px-3.5 py-2.5 rounded-xl bg-arvdoul-surface border border-arvdoul-border text-sm text-white outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bp-comp" className="block text-xs font-semibold mb-1">Compensation (USD)</label>
              <input
                id="bp-comp"
                type="number"
                min="0"
                step="0.01"
                value={partnerForm.compensationUsd}
                onChange={(e) => setPartnerForm((f) => ({ ...f, compensationUsd: e.target.value }))}
                placeholder="500.00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-arvdoul-surface border border-arvdoul-border text-sm text-white outline-none tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="bp-disc" className="block text-xs font-semibold mb-1">Disclosure Label</label>
              <select
                id="bp-disc"
                value={partnerForm.disclosureType}
                onChange={(e) => setPartnerForm((f) => ({ ...f, disclosureType: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-arvdoul-surface border border-arvdoul-border text-sm text-white outline-none"
              >
                <option value="paid_partnership">Paid partnership</option>
                <option value="sponsored">Sponsored</option>
                <option value="gifted">Gifted product</option>
                <option value="affiliate">Affiliate</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="bp-del" className="block text-xs font-semibold mb-1">Deliverables (comma-separated)</label>
            <input
              id="bp-del"
              type="text"
              value={partnerForm.deliverableText}
              onChange={(e) => setPartnerForm((f) => ({ ...f, deliverableText: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-arvdoul-surface border border-arvdoul-border text-sm text-white outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={creatingPartnership}
              onClick={() => setPartnerModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-arvdoul-border text-xs font-semibold text-arvdoul-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingPartnership}
              style={{ background: BRAND_GRADIENT }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {creatingPartnership && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{creatingPartnership ? 'Creating…' : 'Create Partnership'}</span>
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
