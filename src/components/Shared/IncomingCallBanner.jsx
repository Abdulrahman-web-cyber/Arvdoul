// src/components/Shared/IncomingCallBanner.jsx
//
// Global incoming-call ring. callService writes `calls/{id}` with
// status:'ringing', but nothing listened for it, so a callee only ever saw a
// call if they happened to already be on the call route. This subscribes once
// per signed-in session and offers Accept/Decline wherever the callee is.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCallService } from '../../services/callService.js';
import { getUserService } from '../../services/userService.js';
import { getSafeAvatarUrl } from '../../utils/avatarUtils.js';

export default function IncomingCallBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incoming, setIncoming] = useState(null);
  const [caller, setCaller] = useState(null);
  const onCallRouteRef = useRef(false);
  onCallRouteRef.current = location.pathname.startsWith('/call/');

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setIncoming(null);
      return undefined;
    }

    let cancelled = false;
    let stop = null;
    getCallService()
      .watchIncomingCalls(uid, (call) => {
        // Already on the call route for this call — the CallScreen owns it.
        if (cancelled || onCallRouteRef.current) return;
        setIncoming(call);
      })
      .then((stopFn) => {
        if (cancelled) stopFn();
        else stop = stopFn;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (stop) stop();
    };
  }, [user?.uid]);

  // Resolve the caller's name/avatar for the ring.
  useEffect(() => {
    if (!incoming?.callerId) {
      setCaller(null);
      return undefined;
    }
    let cancelled = false;
    getUserService()
      .getUserProfile(incoming.callerId)
      .then((profile) => {
        if (cancelled || !profile) return;
        const name = profile.displayName || profile.username || 'Someone';
        setCaller({
          name,
          avatar: getSafeAvatarUrl(profile.photoURL, name, incoming.callerId),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [incoming?.callerId]);

  const accept = () => {
    const call = incoming;
    setIncoming(null);
    if (call?.conversationId) navigate(`/call/${call.conversationId}`);
  };

  const decline = () => {
    const call = incoming;
    setIncoming(null);
    if (call?.callId && user?.uid) {
      getCallService().endCall(call.callId, user.uid).catch(() => {});
    }
  };

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="fixed top-3 inset-x-3 z-[100] max-w-md mx-auto rounded-2xl border border-[#8B1EF3]/40 bg-[#0b1220]/95 backdrop-blur-xl shadow-arvdoul-glass p-3 flex items-center gap-3"
          role="dialog"
          aria-label="Incoming call"
        >
          <img
            src={caller?.avatar}
            alt=""
            className="w-11 h-11 rounded-full object-cover border border-[#8B1EF3]/50"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {caller?.name || 'Incoming call'}
            </p>
            <p className="text-[11px] text-arvdoul-text-secondary">Incoming call…</p>
          </div>
          <button
            onClick={decline}
            aria-label="Decline call"
            className="w-10 h-10 rounded-full bg-red-500/90 hover:bg-red-500 flex items-center justify-center text-white"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
          <button
            onClick={accept}
            aria-label="Accept call"
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] flex items-center justify-center text-white shadow-arvdoul-glow"
          >
            <Phone className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
