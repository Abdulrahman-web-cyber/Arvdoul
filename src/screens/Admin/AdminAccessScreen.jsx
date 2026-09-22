// src/screens/Admin/AdminAccessScreen.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  fetchAdminStatus,
  bootstrapOwner,
  grantAdmin,
  revokeAdmin,
  listAdmins
} from '../../services/callableService.js';
import { Shield, Key, UserCheck, UserX, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAccessScreen() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [adminsList, setAdminsList] = useState([]);
  const [targetUid, setTargetUid] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [submittingGrant, setSubmittingGrant] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await fetchAdminStatus();
      setIsAdmin(status);
      if (status) {
        try {
          const res = await listAdmins();
          if (res?.admins) {
            setAdminsList(res.admins);
          }
        } catch {
          // ignore if listAdmins not allowed
        }
      }
    } catch (err) {
      console.warn('Failed to load admin status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleClaimOwnership = async () => {
    setClaiming(true);
    try {
      const res = await bootstrapOwner();
      if (res?.success) {
        toast.success(res.created ? 'Successfully claimed ownership and admin grant!' : 'Ownership already verified!');
        setIsAdmin(true);
        loadStatus();
      } else {
        toast.error('Unable to claim ownership.');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to claim ownership. Ensure your email is verified and in OWNER_EMAILS.');
    } finally {
      setClaiming(false);
    }
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!targetUid.trim()) return;
    setSubmittingGrant(true);
    try {
      await grantAdmin(targetUid.trim(), grantReason.trim());
      toast.success(`Admin access granted to ${targetUid}`);
      setTargetUid('');
      setGrantReason('');
      loadStatus();
    } catch (err) {
      toast.error(err?.message || 'Failed to grant admin access.');
    } finally {
      setSubmittingGrant(false);
    }
  };

  const handleRevoke = async (uidToRevoke) => {
    if (!window.confirm(`Are you sure you want to revoke admin access for ${uidToRevoke}?`)) return;
    try {
      await revokeAdmin(uidToRevoke);
      toast.success(`Admin access revoked for ${uidToRevoke}`);
      loadStatus();
    } catch (err) {
      toast.error(err?.message || 'Failed to revoke admin access.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#03071B] text-gray-900 dark:text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-500">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin & Owner Access</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage platform administration and bootstrap ownership</p>
            </div>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-gray-600 dark:text-gray-300"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Current status card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Your Status</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Account: {user?.email || user?.uid || 'Not signed in'}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              isAdmin
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            }`}>
              {isAdmin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {isAdmin ? 'Admin Active' : 'Non-Admin'}
            </div>
          </div>

          {!isAdmin && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                If your email is configured in <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">OWNER_EMAILS</code> and your email is verified, click below to claim platform ownership.
              </p>
              <button
                onClick={handleClaimOwnership}
                disabled={claiming}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-60"
              >
                <Key className="w-4 h-4" />
                {claiming ? 'Claiming Ownership...' : 'Claim Ownership'}
              </button>
            </div>
          )}
        </div>

        {/* Admin Management Section */}
        {isAdmin && (
          <>
            {/* Grant Admin Form */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-violet-500" />
                Grant Admin Access
              </h2>
              <form onSubmit={handleGrant} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">User UID</label>
                  <input
                    type="text"
                    required
                    value={targetUid}
                    onChange={(e) => setTargetUid(e.target.value)}
                    placeholder="e.g. 5xYk8..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#04081D] border border-gray-200 dark:border-gray-800 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    placeholder="e.g. Senior moderator"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#04081D] border border-gray-200 dark:border-gray-800 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingGrant}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-all disabled:opacity-60"
                >
                  {submittingGrant ? 'Granting...' : 'Grant Admin'}
                </button>
              </form>
            </div>

            {/* Admin Roster */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-500" />
                Active Admin Roster
              </h2>
              {adminsList.length === 0 ? (
                <p className="text-sm text-gray-500">No other admins enumerated or access restricted.</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {adminsList.map((adm) => (
                    <div key={adm.uid} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-mono font-medium">{adm.uid}</div>
                        {adm.reason && <div className="text-xs text-gray-500">{adm.reason}</div>}
                      </div>
                      {adm.uid !== user?.uid && (
                        <button
                          onClick={() => handleRevoke(adm.uid)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
