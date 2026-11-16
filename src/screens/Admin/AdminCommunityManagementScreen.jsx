// src/screens/Admin/AdminCommunityManagementScreen.jsx

import { useState, useEffect } from "react";
import { usePrompt } from '../../components/Shared/ConfirmProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, CheckCircle2, Lock, Globe, Flag } from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { callFunction, FUNCTIONS, fetchAdminStatus } from '../../services/callableService.js';
import { unknownNumber } from '../../lib/unknownNumber.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const AdminCommunityManagementScreen = () => {
  const prompt = usePrompt();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('all');
  const [communities, setCommunities] = useState([]);

  useEffect(() => {
    const loadCommunities = async () => {
      setLoading(true);
      try {
        if (!user?.uid || !(await fetchAdminStatus())) {
          setDenied(true);
          setLoading(false);
          return;
        }
        const res = await callFunction(FUNCTIONS.ADMIN_LIST_COMMUNITIES, { limit: 50 });
        setCommunities(Array.isArray(res?.communities) ? res.communities : []);
      } catch {
        toast.error('Could not load the community directory.');
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    };
    loadCommunities();
  }, [user?.uid]);

  const handleToggleVerified = async (comm) => {
    const newStatus = !comm.isVerified;
    try {
      await callFunction(FUNCTIONS.ADMIN_SET_COMMUNITY_VERIFIED, {
        communityId: comm.id,
        verified: newStatus,
      });
      setCommunities((prev) =>
        prev.map((c) => (c.id === comm.id ? { ...c, isVerified: newStatus } : c))
      );
      toast.success(`Community "${comm.name || comm.id}" marked as ${newStatus ? 'verified' : 'unverified'}`);
    } catch {
      toast.error('Could not update community verification.');
    }
  };

  const handleIssueStrike = async (comm) => {
    const reason = await prompt({
      title: 'Issue policy strike',
      description: `Strike "${comm.name || comm.id}" for a guideline breach.`,
      placeholder: 'Describe the breach',
      confirmText: 'Issue strike',
    });
    if (!reason) return;
    try {
      await callFunction(FUNCTIONS.ADMIN_ISSUE_COMMUNITY_STRIKE, {
        communityId: comm.id,
        reason,
      });
      setCommunities((prev) =>
        prev.map((c) => (c.id === comm.id ? { ...c, strikesCount: (c.strikesCount || 0) + 1 } : c))
      );
      toast.warning(`Strike issued to "${comm.name || comm.id}".`);
    } catch {
      toast.error('Could not issue the strike.');
    }
  };

  const filtered = communities.filter((c) => {
    if (privacyFilter !== 'all' && c.privacy !== privacyFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.slug || '').toLowerCase().includes(q) ||
      String(c.ownerHandle || c.ownerId || '').toLowerCase().includes(q)
    );
  });

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-communities-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Community Governance"
        subtitle="Hub verification, policy adherence, member health, and community strike records"
        actions={
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {['all', 'public', 'private'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrivacyFilter(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition whitespace-nowrap shrink-0 cursor-pointer ${
                  privacyFilter === p
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Search community name, slug, or creator"
              type="text"
              placeholder="Search community name, slug, or creator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium tabular-nums">
            {loading ? 'Loading communities…' : `${filtered.length} communities listed`}
          </div>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {communities.length === 0
              ? 'No communities have been created yet.'
              : 'No communities match this filter.'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((comm) => (
            <div
              key={comm.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-slate-900 dark:text-white truncate">{comm.name || comm.id}</h3>
                      {comm.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" aria-label="Verified community" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono">c/{comm.slug || comm.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 capitalize">
                        {comm.privacy === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {comm.privacy || 'public'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                  {comm.description || 'No description provided.'}
                </p>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 text-xs tabular-nums">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Members</span>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {(() => { const v = comm.stats?.memberCount ?? comm.memberCount; return typeof v === 'number' ? v.toLocaleString() : '—'; })()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Posts</span>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {(() => { const v = comm.stats?.postCount ?? comm.postCount; return typeof v === 'number' ? v.toLocaleString() : '—'; })()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Strikes</span>
                    <div className={`font-semibold mt-0.5 ${Number(comm.strikesCount) > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {unknownNumber(comm.strikesCount) ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Lead: <span className="font-semibold text-slate-800 dark:text-slate-200">{comm.ownerHandle || comm.ownerId || '—'}</span>
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleVerified(comm)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                      comm.isVerified
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {comm.isVerified ? 'Remove Badge' : 'Grant Verified'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleIssueStrike(comm)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                    aria-label={`Issue strike to ${comm.name || comm.id}`}
                    title="Issue Strike"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminCommunityManagementScreen;
