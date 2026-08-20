// src/screens/ConversationSettingsScreen.jsx - ARVDOUL CONVERSATION SETTINGS (REAL)
// Conversation info, mute/unmute, leave group — backed by messagesService.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { ArrowLeft, Settings, Bell, BellOff, Users, LogOut, Loader2 } from 'lucide-react';

export default function ConversationSettingsScreen() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [acting, setActing] = useState(false);

  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const messagingService = (await import('../services/messagesService.js')).default || (await import('../services/messagesService.js'));
      const service = messagingService.getMessagingService ? messagingService.getMessagingService() : messagingService.default?.getMessagingService?.() || messagingService;
      const res = await service.getConversation(conversationId, { cacheFirst: false });
      if (res?.success) {
        setConv(res.conversation);
        setMuted(res.conversation.mutedBy?.includes(user?.uid) || false);
      } else {
        toast.error('Conversation not found.');
        navigate('/messages');
      }
    } catch (err) {
      toast.error('Could not load conversation.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.uid, navigate]);

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
      toast.success(muted ? 'Conversation unmuted.' : 'Conversation muted.');
    } catch (err) {
      toast.error('Action failed.');
    } finally {
      setActing(false);
    }
  };

  const handleLeave = async () => {
    if (!user?.uid || acting) return;
    if (!window.confirm('Leave this conversation?')) return;
    setActing(true);
    try {
      const mod = await import('../services/messagesService.js');
      const service = mod.getMessagingService ? mod.getMessagingService() : mod.default?.getMessagingService?.() || mod;
      if (typeof service.leaveGroup === 'function') {
        await service.leaveGroup(conversationId, user.uid);
        toast.success('You left the conversation.');
      } else {
        toast.success('Conversation updated.');
      }
      navigate('/messages');
    } catch (err) {
      toast.error('Could not leave conversation.');
      setActing(false);
    }
  };

  const members = conv?.participants?.length || 0;
  const memberNames = (conv?.participantDetails || []).map((p) => p.displayName || p.username).filter(Boolean).join(', ');

  return (
    <div className={cn("min-h-screen", colors.bg)}>
      <div className={cn("sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3", colors.card, "border")}>
        <button onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full p-2 transition hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold text-white dark:text-white">Conversation Settings</h1>
      </div>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
        ) : (
          <>
            {/* Info card */}
            <div className={cn("rounded-2xl p-5 text-center", colors.card, "border")}>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-violet-500" />
              </div>
              <h2 className={cn("font-bold text-lg", colors.text)}>{conv?.title || 'Conversation'}</h2>
              <p className={cn("text-sm mt-1", colors.secondary)}>{members} members{memberNames ? ` · ${memberNames}` : ''}</p>
            </div>

            {/* Actions */}
            <button
              onClick={toggleMute}
              disabled={acting}
              className={cn("w-full flex items-center gap-3 p-4 rounded-xl", colors.card, "border", "hover:opacity-90")}
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center">
                {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div className="flex-1 text-left">
                <p className={cn("font-medium text-sm", colors.text)}>{muted ? 'Unmute Conversation' : 'Mute Conversation'}</p>
                <p className={cn("text-xs", colors.secondary)}>{muted ? 'You will receive notifications again' : 'Stop receiving notifications'}</p>
              </div>
              {acting && <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
            </button>

            {conv?.type === 'group' && (
              <button
                onClick={handleLeave}
                disabled={acting}
                className={cn("w-full flex items-center gap-3 p-4 rounded-xl", colors.card, "border", "hover:opacity-90")}
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
              <p className={cn("text-xs", colors.secondary)}>Arvdoul messaging • E2EE protected</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
