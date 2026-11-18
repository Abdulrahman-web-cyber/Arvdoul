// src/screens/ConversationSettingsScreen.jsx
//
// Conversation info, mute/unmute, pin/unpin, leave group — backed by messagesService.

import { useState, useEffect, useCallback } from "react";
import { useConfirm } from '../components/Shared/ConfirmProvider.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { unknownNumber } from '../lib/unknownNumber.js';
import { ArrowLeft, Settings, Bell, BellOff, Users, LogOut, Loader2, Pin, Info, Archive, ArchiveRestore } from 'lucide-react';
import ErrorState from '../design-system/ErrorState.jsx';

export default function ConversationSettingsScreen() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [acting, setActing] = useState(false);

  const colors = {
    bg: isDark ? 'bg-[#03071B]' : 'bg-[#F8FAFC]',
    card: isDark ? 'bg-[#090F2D] border border-white/[0.08]' : 'bg-white border border-slate-200',
    text: isDark ? 'text-white' : 'text-slate-900',
    secondary: isDark ? 'text-slate-400' : 'text-slate-600',
  };

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const messagingService = (await import('../services/messagesService.js')).default || (await import('../services/messagesService.js'));
      const service = messagingService.getMessagingService ? messagingService.getMessagingService() : messagingService.default?.getMessagingService?.() || messagingService;
      const res = await service.getConversation(conversationId, { cacheFirst: false });
      if (res?.success && res.conversation) {
        setConv(res.conversation);
        setMuted(res.conversation.mutedBy?.includes(user?.uid) || false);
        setPinned(res.conversation.pinnedBy?.includes(user?.uid) || false);
        setArchived(res.conversation.archivedBy?.includes(user?.uid) || false);
      } else {
        setLoadError(res?.error || 'Conversation not found.');
      }
    } catch (err) {
      setLoadError(err?.message || 'Could not load conversation settings.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.uid]);

  useEffect(() => { load(); }, [load]);

  const toggleMute = async () => {
    if (!user?.uid || acting) return;
    setActing(true);
    try {
      const mod = await import('../services/messagesService.js');
      const service = mod.getMessagingService ? mod.getMessagingService() : mod.default?.getMessagingService?.() || mod;
      if (muted) await service.unmuteConversation(conversationId, user.uid);
      else await service.muteConversation(conversationId, user.uid);
      setMuted(!muted);
      window.dispatchEvent(new CustomEvent('arvdoul:messages-read'));
      toast.success(muted ? 'Conversation unmuted.' : 'Conversation muted.');
    } catch {
      toast.error('Action failed.');
    } finally {
      setActing(false);
    }
  };

  const togglePin = async () => {
    if (!user?.uid || acting) return;
    setActing(true);
    try {
      const mod = await import('../services/messagesService.js');
      const service = mod.getMessagingService ? mod.getMessagingService() : mod.default?.getMessagingService?.() || mod;
      if (pinned) await service.unpinConversation(conversationId, user.uid);
      else await service.pinConversation(conversationId, user.uid);
      setPinned(!pinned);
      window.dispatchEvent(new CustomEvent('arvdoul:messages-read'));
      toast.success(pinned ? 'Conversation unpinned.' : 'Conversation pinned');
    } catch {
      toast.error('Action failed.');
    } finally {
      setActing(false);
    }
  };

  const toggleArchive = async () => {
    if (!user?.uid || acting) return;
    setActing(true);
    try {
      const mod = await import('../services/messagesService.js');
      const service = mod.getMessagingService ? mod.getMessagingService() : mod.default?.getMessagingService?.() || mod;
      if (archived) await service.unarchiveConversation(conversationId, user.uid);
      else await service.archiveConversation(conversationId, user.uid);
      setArchived(!archived);
      window.dispatchEvent(new CustomEvent('arvdoul:messages-read'));
      toast.success(archived ? 'Conversation unarchived.' : 'Conversation archived.');
    } catch {
      toast.error('Action failed.');
    } finally {
      setActing(false);
    }
  };

  const handleLeave = async () => {
    if (!user?.uid || acting) return;
    const ok = await confirm({ title: 'Leave conversation?', description: 'You will no longer receive messages from this conversation.', confirmText: 'Leave', tone: 'danger' });
    if (!ok) return;
    setActing(true);
    try {
      const { getMessagingService } = await import('../services/messagesService.js');
      await getMessagingService().leaveGroup(conversationId, user.uid);
      window.dispatchEvent(new CustomEvent('arvdoul:messages-read'));
      toast.success('You left the conversation.');
      navigate('/messages');
    } catch {
      toast.error('Could not leave conversation.');
      setActing(false);
    }
  };

  const memberCount = unknownNumber(conv?.participants?.length);
  const memberNames = (conv?.participantDetails || []).map((p) => p.displayName || p.username).filter(Boolean).join(', ');

  return (
    <div className={cn("flex-1 min-h-0 h-full overflow-y-auto", colors.bg)}>
      <div className={cn("sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-xl", isDark ? "bg-[#050B24]/90 border-white/[0.08]" : "bg-white/90 border-slate-200")}>
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className={cn("flex-1 text-lg font-semibold", colors.text)}>Conversation Settings</h1>
      </div>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-arvdoul-purple animate-spin" /></div>
        ) : loadError ? (
          <ErrorState
            title="Unable to load conversation"
            message={loadError}
            onRetry={load}
          />
        ) : (
          <>
            {/* Info card */}
            <div className={cn("rounded-2xl p-5 text-center", colors.card)}>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-arvdoul-purple/15 flex items-center justify-center">
                <Users className="w-8 h-8 text-arvdoul-purple" />
              </div>
              <h2 className={cn("font-bold text-lg", colors.text)}>{conv?.title || conv?.name || 'Conversation'}</h2>
              <p className={cn("text-sm mt-1 tabular-nums", colors.secondary)}>{memberCount === null ? 'Member count unavailable' : `${memberCount} members`}{memberNames ? ` · ${memberNames}` : ''}</p>
            </div>

            {/* Actions */}
            {conv?.type === 'group' && (
              <button
                type="button"
                onClick={() => navigate(`/messages/${conversationId}/info`)}
                className={cn("w-full flex items-center gap-3 p-4 rounded-xl transition-opacity hover:opacity-90", colors.card)}
              >
                <div className="w-10 h-10 rounded-xl bg-arvdoul-purple/15 text-arvdoul-purple flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className={cn("font-medium text-sm", colors.text)}>Group Information</p>
                  <p className={cn("text-xs", colors.secondary)}>Manage members, invite links, and group description</p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={togglePin}
              disabled={acting}
              className={cn("w-full flex items-center gap-3 p-4 rounded-xl transition-opacity hover:opacity-90", colors.card)}
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                <Pin className={cn("w-5 h-5", pinned && "rotate-45 text-arvdoul-purple")} />
              </div>
              <div className="flex-1 text-left">
                <p className={cn("font-medium text-sm", colors.text)}>{pinned ? 'Unpin Conversation' : 'Pin Conversation'}</p>
                <p className={cn("text-xs", colors.secondary)}>{pinned ? 'Remove from top of message list' : 'Keep at the top of your messages'}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              disabled={acting}
              className={cn("w-full flex items-center gap-3 p-4 rounded-xl transition-opacity hover:opacity-90", colors.card)}
            >
              <div className="w-10 h-10 rounded-xl bg-arvdoul-purple/15 text-arvdoul-purple flex items-center justify-center">
                {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div className="flex-1 text-left">
                <p className={cn("font-medium text-sm", colors.text)}>{muted ? 'Unmute Conversation' : 'Mute Conversation'}</p>
                <p className={cn("text-xs", colors.secondary)}>{muted ? 'You will receive notifications again' : 'Stop receiving notifications'}</p>
              </div>
              {acting && <Loader2 className="w-4 h-4 animate-spin text-arvdoul-purple" />}
            </button>

            <button
              type="button"
              onClick={toggleArchive}
              disabled={acting}
              className={cn("w-full flex items-center gap-3 p-4 rounded-xl transition-opacity hover:opacity-90", colors.card)}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                {archived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
              </div>
              <div className="flex-1 text-left">
                <p className={cn("font-medium text-sm", colors.text)}>{archived ? 'Unarchive Conversation' : 'Archive Conversation'}</p>
                <p className={cn("text-xs", colors.secondary)}>{archived ? 'Move back to your main inbox' : 'Move to the Archived folder'}</p>
              </div>
              {acting && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
            </button>

            {conv?.type === 'group' && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={acting}
                className={cn("w-full flex items-center gap-3 p-4 rounded-xl transition-opacity hover:opacity-90", colors.card)}
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-red-500">Leave Conversation</p>
                  <p className={cn("text-xs", colors.secondary)}>You will no longer see messages</p>
                </div>
              </button>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <Settings className="w-4 h-4 text-gray-400" />
              <p className={cn("text-xs", colors.secondary)}>Arvdoul messaging</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
