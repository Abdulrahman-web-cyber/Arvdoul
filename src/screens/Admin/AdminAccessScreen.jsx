// src/screens/Admin/AdminAccessScreen.jsx
//
// Owner-facing admin access management. Two audiences share one screen:
//
//  * A signed-in platform owner (email listed in the functions OWNER_EMAILS
//    env var, with a verified address) sees a Claim button. This is the only
//    way the very first admin is created, because `admins/{uid}` is
//    server-write-only.
//  * An existing admin sees the current roster and can grant or revoke.
//
// Every action goes through a Cloud Function that re-checks the caller, so the
// UI is a convenience over an enforced server contract, never the contract.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldOff,
  Crown,
  Users,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { callFunction, fetchAdminStatus, FUNCTIONS, CallableError } from '../../services/callableService.js';

const errorMessage = (error, fallback) =>
  error instanceof CallableError ? error.message : fallback;

const AdminAccessScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isAdmin, setIsAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [grantUid, setGrantUid] = useState('');
  const [grantReason, setGrantReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const admin = await fetchAdminStatus();
      setIsAdmin(admin);
      if (admin) {
        const data = await callFunction(FUNCTIONS.LIST_ADMINS);
        setAdmins(data?.admins || []);
      } else {
        setAdmins([]);
      }
    } catch (error) {
      setIsAdmin(false);
      setAdmins([]);
      // A failed status check is not fatal — the claim path may still apply.
      if (!(error instanceof CallableError)) {
        toast.error('Could not check admin status.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async () => {
    setBusy('claim');
    try {
      const result = await callFunction(FUNCTIONS.BOOTSTRAP_OWNER);
      if (result?.created) {
        toast.success('Ownership claimed. Admin tools are now unlocked.');
      } else {
        toast.info('This account already holds an admin grant.');
      }
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not claim ownership.'));
    } finally {
      setBusy(null);
    }
  };

  const handleGrant = async (event) => {
    event.preventDefault();
    const userId = grantUid.trim();
    if (!userId) {
      toast.error('Enter the user ID to grant admin access to.');
      return;
    }
    setBusy('grant');
    try {
      const result = await callFunction(FUNCTIONS.GRANT_ADMIN, { userId, reason: grantReason.trim() });
      toast.success(result?.created ? 'Admin access granted.' : 'That account is already an admin.');
      setGrantUid('');
      setGrantReason('');
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not grant admin access.'));
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (userId) => {
    setBusy(userId);
    try {
      await callFunction(FUNCTIONS.REVOKE_ADMIN, { userId });
      toast.success('Admin access revoked.');
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not revoke admin access.'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full p-2 hover:bg-[var(--color-surface-hover)]"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Admin access</h1>
        <button
          type="button"
          onClick={load}
          className="ml-auto rounded-full p-2 hover:bg-[var(--color-surface-hover)]"
          aria-label="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-start gap-3">
            {isAdmin ? (
              <ShieldCheck className="mt-0.5 w-6 h-6 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <ShieldOff className="mt-0.5 w-6 h-6 shrink-0 text-amber-500" aria-hidden />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold">
                {isAdmin ? 'This account is an admin' : 'This account is not an admin'}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {isAdmin
                  ? 'You can moderate users, content and reports, and manage who else holds admin access.'
                  : 'Admin tools are gated server-side. If you are the platform owner, claim access below.'}
              </p>
            </div>
          </div>

          {!isAdmin && (
            <button
              type="button"
              onClick={handleClaim}
              disabled={busy === 'claim'}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {busy === 'claim' ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <Crown className="w-4 h-4" aria-hidden />
              )}
              Claim ownership
            </button>
          )}

          {!isAdmin && (
            <p className="mt-3 flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
              <Info className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden />
              Claiming requires this account&apos;s email to be verified and listed in the
              platform&apos;s OWNER_EMAILS configuration.
            </p>
          )}
        </section>

        {isAdmin && (
          <>
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Users className="w-5 h-5" aria-hidden />
                Current admins
              </h2>
              {admins.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No admin grants found.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--color-border)]">
                  {admins.map((admin) => {
                    const isSelf = admin.uid === user?.uid;
                    const isLast = admins.length <= 1;
                    return (
                      <li key={admin.uid} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm">{admin.uid}</p>
                          {admin.reason ? (
                            <p className="truncate text-xs text-[var(--color-text-secondary)]">{admin.reason}</p>
                          ) : null}
                        </div>
                        {isSelf && (
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-500">
                            You
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRevoke(admin.uid)}
                          disabled={busy === admin.uid || isLast}
                          title={isLast ? 'The last admin cannot be removed' : 'Revoke admin access'}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm transition hover:bg-[var(--color-surface-hover)] disabled:opacity-40"
                        >
                          {busy === admin.uid ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          ) : (
                            'Revoke'
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                The final admin cannot be revoked, so the platform always retains moderation access.
              </p>
            </section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h2 className="font-semibold">Grant admin access</h2>
              <form onSubmit={handleGrant} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="grant-uid" className="block text-sm font-medium">
                    User ID
                  </label>
                  <input
                    id="grant-uid"
                    value={grantUid}
                    onChange={(event) => setGrantUid(event.target.value)}
                    placeholder="Firebase Auth UID"
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label htmlFor="grant-reason" className="block text-sm font-medium">
                    Reason <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
                  </label>
                  <input
                    id="grant-reason"
                    value={grantReason}
                    onChange={(event) => setGrantReason(event.target.value)}
                    placeholder="Why this account needs admin access"
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy === 'grant'}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy === 'grant' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                  Grant access
                </button>
              </form>
            </motion.section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminAccessScreen;
