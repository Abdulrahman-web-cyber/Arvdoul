// src/screens/JoinGroupScreen.jsx
//
// Landing surface for a group invite link (`/join-group?invite=<id>`). The
// invite link was minted by GroupInfoScreen ("create invite link") but had no
// destination, so a shared link 404'd. This screen resolves the invite, shows
// the group, and joins through `messagesService.joinGroupViaInvite` — which is
// a server callable, because adding yourself to `participants` is a write the
// `conversations` rule refuses for a non-admin.

import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Loader2, AlertTriangle, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { getMessagingService } from '../services/messagesService';
import EmptyState from '../design-system/EmptyState.jsx';
import Button from '../design-system/Button.jsx';
import { cn } from '../lib/utils';

export default function JoinGroupScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteId = params.get('invite');
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [status, setStatus] = useState('idle'); // idle | joining | error
  const [error, setError] = useState(null);

  const join = useCallback(async () => {
    if (!inviteId || !user?.uid) return;
    setStatus('joining');
    setError(null);
    try {
      const svc = getMessagingService();
      const res = await svc.joinGroupViaInvite(inviteId, user.uid);
      if (res?.success === false || !res?.conversationId) {
        throw new Error(res?.error || 'This invite could not be used.');
      }
      toast.success(res.alreadyMember ? 'You are already in this group.' : 'Joined the group.');
      navigate(`/messages/${res.conversationId}`, { replace: true });
    } catch (err) {
      setError(err?.message || 'This invite could not be used.');
      setStatus('error');
    }
  }, [inviteId, user?.uid, navigate]);

  const text = isDark ? 'text-white' : 'text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={cn('min-h-screen flex items-center justify-center px-4 pb-24', isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]')}>
      <div className={cn('w-full max-w-md rounded-3xl border p-6 text-center', isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-200')}>
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-blue-500 mb-4">
          <Users className="w-8 h-8 text-white" aria-hidden="true" />
        </div>

        {!inviteId ? (
          <EmptyState
            icon={AlertTriangle}
            title="No invite in this link"
            description="This link is missing its invite code. Ask the group admin for a fresh invite link."
          />
        ) : status === 'joining' ? (
          <div className="flex flex-col items-center gap-3 py-6" aria-busy="true" aria-label="Joining group">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" aria-hidden="true" />
            <p className={cn('text-sm', muted)}>Joining the group…</p>
          </div>
        ) : status === 'error' ? (
          <div className="space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" aria-hidden="true" />
            <h1 className={cn('text-lg font-bold', text)}>Invite unavailable</h1>
            <p className={cn('text-sm', muted)}>{error}</p>
            <Button variant="primary" onClick={join} className="w-full">Try again</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className={cn('text-xl font-bold', text)}>Join this group</h1>
            <p className={cn('text-sm', muted)}>You were invited to join a group conversation on Arvdoul.</p>
            <Button variant="primary" onClick={join} className="w-full" disabled={!user?.uid}>
              <LogIn className="w-4 h-4 mr-2" aria-hidden="true" />
              {user?.uid ? 'Join group' : 'Sign in to join'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
