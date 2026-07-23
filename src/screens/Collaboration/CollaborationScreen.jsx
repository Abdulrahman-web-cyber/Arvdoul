// src/screens/Collaboration/CollaborationScreen.jsx – ARVDOUL COLLABORATION SCREEN V1
// 🤝 Content Collaboration with Roles, Permissions, Review Workflow
// ✅ WCAG 2.1 AA Compliant • Keyboard Navigation • Screen Reader Support

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaChevronLeft, FaUsers, FaUserPlus, FaUserMinus, FaCrown,
  FaEdit, FaEye, FaCheck, FaTimes, FaClock, FaEnvelope,
  FaTrash, FaPen, FaPaperPlane, FaClipboardCheck
} from 'react-icons/fa';
import { COLLABORATION_CONFIG } from '../../services/collaborationService.js';
import collaborationService from '../../services/collaborationService.js';

// ==================== UTILITY COMPONENTS ====================
const IconButton = ({ icon: Icon, onClick, disabled, variant = 'default', className = '', title, ariaLabel }) => {
  const variants = {
    default: 'bg-gray-700 hover:bg-gray-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'bg-transparent border border-gray-600 hover:bg-gray-700 text-white',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      className={`
        p-2 rounded-lg transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
        ${variants[variant]}
        ${className}
      `}
    >
      <Icon className="text-lg" />
    </button>
  );
};

const RoleBadge = ({ role }) => {
  const roleConfig = COLLABORATION_CONFIG.ROLES[role.toUpperCase()];
  const colors = {
    owner: 'bg-yellow-500 text-black',
    admin: 'bg-purple-600 text-white',
    editor: 'bg-blue-600 text-white',
    viewer: 'bg-gray-600 text-white',
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${colors[role] || colors.viewer}`}>
      {roleConfig?.name || role}
    </span>
  );
};

const UserCard = ({ user, role, currentUserRole, onRoleChange, onRemove }) => {
  const canManage = collaborationService.canManageTeam(currentUserRole);
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = role === 'owner';

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
        {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-semibold truncate">
          {user?.displayName || 'Unknown User'}
          {isOwner && <FaCrown className="inline ml-2 text-yellow-400" />}
        </h4>
        <p className="text-gray-400 text-sm truncate">@{user?.username || 'unknown'}</p>
      </div>

      {/* Role */}
      <RoleBadge role={role} />

      {/* Actions */}
      {canManage && !isOwner && (
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1"
            aria-label="Change role"
          >
            {Object.values(COLLABORATION_CONFIG.ROLES)
              .filter(r => r.id !== 'owner')
              .map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
          </select>
          <IconButton
            icon={FaUserMinus}
            onClick={() => onRemove()}
            variant="danger"
            title="Remove from team"
          />
        </div>
      )}
    </div>
  );
};

const InviteCard = ({ invite, onAccept, onDecline }) => {
  const isExpired = new Date(invite.expiresAt) < new Date();

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white">
        <FaEnvelope />
      </div>

      <div className="flex-1">
        <p className="text-white">{invite.email}</p>
        <p className="text-gray-400 text-sm">
          <RoleBadge role={invite.role} /> • Expires {new Date(invite.expiresAt).toLocaleDateString()}
        </p>
      </div>

      {!isExpired && (
        <div className="flex gap-2">
          <IconButton
            icon={FaCheck}
            onClick={() => onAccept()}
            variant="success"
            title="Accept invite"
          />
          <IconButton
            icon={FaTimes}
            onClick={() => onDecline()}
            variant="danger"
            title="Decline invite"
          />
        </div>
      )}
    </div>
  );
};

const ContentVersionCard = ({ version, onReview, canReview }) => {
  const stateColors = {
    draft: 'bg-gray-600',
    pending_review: 'bg-yellow-600',
    changes_requested: 'bg-orange-600',
    approved: 'bg-green-600',
    published: 'bg-blue-600',
  };

  const stateIcons = {
    draft: <FaEdit />,
    pending_review: <FaClock />,
    changes_requested: <FaPen />,
    approved: <FaCheck />,
    published: <FaPaperPlane />,
  };

  return (
    <div className="p-4 bg-gray-800 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`p-2 rounded ${stateColors[version.state]}`}>
            {stateIcons[version.state]}
          </span>
          <div>
            <h4 className="text-white font-medium capitalize">{version.state.replace('_', ' ')}</h4>
            <p className="text-gray-400 text-sm">
              {version.createdAt?.toDate?.()?.toLocaleString() || 'Unknown date'}
            </p>
          </div>
        </div>
        
        {canReview && version.state === 'pending_review' && (
          <button
            onClick={() => onReview(version)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
          >
            <FaClipboardCheck /> Review
          </button>
        )}
      </div>

      {version.reviewFeedback && (
        <div className="mt-3 p-3 bg-gray-700/50 rounded">
          <p className="text-gray-400 text-sm mb-1">Feedback:</p>
          <p className="text-white">{version.reviewFeedback}</p>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COLLABORATION SCREEN ====================
export default function CollaborationScreen() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [team, setTeam] = useState([]);
  const [invites, setInvites] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [contentVersions, setContentVersions] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('team');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');

  // Load project data
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);

    try {
      const projectData = await collaborationService.getProject(projectId);
      setProject(projectData);

      const teamData = await collaborationService.getTeam(projectId);
      setTeam(teamData);

      const versionsData = await collaborationService.getContentVersions(projectId);
      setContentVersions(versionsData);

      // Get current user's role
      const currentUser = teamData.find(m => m.userId === projectData.ownerId);
      setCurrentUserRole(currentUser?.role || 'viewer');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      await collaborationService.createInvite(projectId, inviteEmail, inviteRole, project.ownerId);
      setInviteEmail('');
      setShowInviteModal(false);
      alert('Invitation sent!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await collaborationService.updateMemberRole(projectId, userId, newRole, project.ownerId, currentUserRole);
      await loadProject();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      await collaborationService.removeTeamMember(projectId, userId, project.ownerId, currentUserRole);
      await loadProject();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReview = async (version, decision, feedback) => {
    try {
      await collaborationService.reviewContent(projectId, version.id, decision, feedback, project.ownerId, currentUserRole);
      await loadProject();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      await collaborationService.acceptInvite(inviteId, project.ownerId, invite.email);
      await loadProject();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      await collaborationService.declineInvite(inviteId, project.ownerId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadProject}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const canManageTeam = collaborationService.canManageTeam(currentUserRole);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-700 rounded-lg"
              aria-label="Go back"
            >
              <FaChevronLeft />
            </button>
            <div>
              <h1 className="text-xl font-bold">{project?.name || 'Collaboration'}</h1>
              <p className="text-gray-400 text-sm">{project?.description || 'Team collaboration'}</p>
            </div>
          </div>
          
          {canManageTeam && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
            >
              <FaUserPlus /> Invite
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'team' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'
            }`}
          >
            <FaUsers className="inline mr-2" /> Team ({team.length})
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'content' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'
            }`}
          >
            <FaEdit className="inline mr-2" /> Content ({contentVersions.length})
          </button>
          {invites.length > 0 && (
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === 'invites' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              <FaEnvelope className="inline mr-2" /> Invites ({invites.length})
            </button>
          )}
        </div>

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            {team.map((member) => (
              <UserCard
                key={member.id}
                user={member}
                role={member.role}
                currentUserRole={currentUserRole}
                onRoleChange={(newRole) => handleRoleChange(member.userId, newRole)}
                onRemove={() => handleRemoveMember(member.userId)}
              />
            ))}
            
            {team.length === 0 && (
              <div className="text-center py-12">
                <FaUsers className="text-6xl text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No team members yet</p>
              </div>
            )}
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            {contentVersions.map((version) => (
              <ContentVersionCard
                key={version.id}
                version={version}
                canReview={canManageTeam}
                onReview={(v) => {
                  const decision = prompt('Enter decision (approve/request_changes):');
                  if (decision) {
                    const feedback = prompt('Enter feedback:') || '';
                    handleReview(v, decision, feedback);
                  }
                }}
              />
            ))}
            
            {contentVersions.length === 0 && (
              <div className="text-center py-12">
                <FaEdit className="text-6xl text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No content versions yet</p>
              </div>
            )}
          </div>
        )}

        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <div className="space-y-4">
            {invites.map((invite) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                onAccept={() => handleAcceptInvite(invite.id)}
                onDecline={() => handleDeclineInvite(invite.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
                  placeholder="email@example.com"
                  aria-label="Email address"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
                  aria-label="Select role"
                >
                  {Object.values(COLLABORATION_CONFIG.ROLES)
                    .filter(r => r.id !== 'owner')
                    .map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { COLLABORATION_CONFIG };
