// src/screens/CallScreen.jsx - ARVDOUL VIDEO CALL (REAL WebRTC)
// 1:1 WebRTC video/audio call with Firestore signaling:
//   - Local stream via getUserMedia
//   - RTCPeerConnection with STUN
//   - Offer/answer/ICE-candidate exchange through a `calls/{id}` doc
// Works across tabs/devices on the same Firestore project.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFirestoreInstance } from '../firebase/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { ArrowLeft, Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Loader2 } from 'lucide-react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CALL_STATUS = { RINGING: 'ringing', ACTIVE: 'active', ENDED: 'ended' };

export default function CallScreen() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [peer, setPeer] = useState(null); // { id, name, avatar }
  const [status, setStatus] = useState('connecting'); // connecting|ringing|active|ended
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);

  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const unsubRef = useRef(null);
  const timerRef = useRef(null);
  const endedRef = useRef(false);

  const colors = {
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  // ---------- cleanup ----------
  const endCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (unsubRef.current) unsubRef.current();
    if (timerRef.current) clearInterval(timerRef.current);
    if (callIdRef.current && user?.uid) {
      try {
        const firestore = await getFirestoreInstance();
        await updateDoc(doc(firestore, 'calls', callIdRef.current), {
          status: CALL_STATUS.ENDED,
          endedAt: serverTimestamp(),
          endedBy: user.uid,
        });
      } catch (e) { /* best-effort */ }
    }
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus(CALL_STATUS.ENDED);
  }, [user?.uid]);

  useEffect(() => () => { endCall(); }, [endCall]);

  // ---------- init ----------
  useEffect(() => {
    if (!user?.uid || !conversationId) return;
    const init = async () => {
      try {
        const firestore = await getFirestoreInstance();

        // Resolve peer from conversation
        const convSnap = await getDoc(doc(firestore, 'conversations', conversationId));
        if (!convSnap.exists()) throw new Error('Conversation not found');
        const participants = convSnap.data().participants || [];
        const peerId = participants.find((p) => p !== user.uid);
        if (!peerId) throw new Error('No peer in conversation');
        setPeer({ id: peerId, name: 'User', avatar: null });

        // Try to load peer profile
        try {
          const pSnap = await getDoc(doc(firestore, 'users', peerId));
          if (pSnap.exists()) {
            const d = pSnap.data();
            setPeer({ id: peerId, name: d.displayName || d.username || 'User', avatar: d.photoURL });
          }
        } catch (e) { /* optional */ }

        // Local media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        // Peer connection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.ontrack = (e) => {
          if (remoteRef.current && e.streams[0]) remoteRef.current.srcObject = e.streams[0];
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setStatus(CALL_STATUS.ACTIVE);
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
          } else if (['failed', 'disconnected'].includes(pc.connectionState) && !endedRef.current) {
            setError('Connection lost.');
          }
        };

        // Create the call doc (signaling channel)
        const callRef = await addDoc(collection(firestore, 'calls'), {
          conversationId,
          callerId: user.uid,
          calleeId: peerId,
          status: CALL_STATUS.RINGING,
          createdAt: serverTimestamp(),
        });
        callIdRef.current = callRef.id;
        setStatus(CALL_STATUS.RINGING);

        // Role: caller creates offer; callee answers.
        const isCaller = user.uid < peerId; // deterministic role split

        // Listen for signaling
        unsubRef.current = onSnapshot(doc(firestore, 'calls', callRef.id), async (snap) => {
          const data = snap.data();
          if (!data) return;
          if (data.status === CALL_STATUS.ENDED && !endedRef.current) {
            endCall();
            toast.info('Call ended');
            return;
          }
          if (data.offer && !isCaller) {
            await pc.setRemoteDescription(data.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(callRef, { answer, status: CALL_STATUS.ACTIVE });
            setStatus(CALL_STATUS.ACTIVE);
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
          } else if (data.answer && isCaller) {
            await pc.setRemoteDescription(data.answer);
            setStatus(CALL_STATUS.ACTIVE);
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
          }
        });

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            addDoc(collection(firestore, 'calls', callRef.id, 'ice'), { candidate: e.candidate, from: user.uid })
              .catch(() => {});
          }
        };

        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await updateDoc(callRef, { offer });
        }
      } catch (err) {
        setError(err?.message || 'Could not start the call.');
        toast.error('Could not start the call.');
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.uid]);

  const toggleMute = () => {
    const audio = localStreamRef.current?.getAudioTracks()[0];
    if (audio) { audio.enabled = !audio.enabled; setMuted(!audio.enabled); }
  };
  const toggleCamera = () => {
    const video = localStreamRef.current?.getVideoTracks()[0];
    if (video) { video.enabled = !video.enabled; setCameraOff(!video.enabled); }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={() => { endCall(); navigate(-1); }} aria-label="Back" className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="font-semibold">{peer?.name || 'Call'}</p>
          <p className="text-xs text-gray-400">{status === 'active' ? fmt(elapsed) : status === 'ringing' ? 'Ringing…' : status}</p>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        {/* Remote video */}
        <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        {status !== 'active' && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            {peer?.avatar ? (
              <img src={peer.avatar} alt={peer.name} className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-4xl font-bold">
                {(peer?.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-gray-300 text-sm">{error || (status === 'ringing' ? 'Waiting for answer…' : 'Connecting…')}</p>
          </div>
        )}

        {/* Local video (PiP) */}
        <div className="absolute bottom-4 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/20 bg-gray-900">
          <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 py-6">
        <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className={cn('p-4 rounded-full transition', muted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20')}>
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={() => { endCall(); navigate(-1); }} aria-label="End call" className="p-5 rounded-full bg-red-500 hover:bg-red-600">
          <PhoneOff className="w-7 h-7" />
        </button>
        <button onClick={toggleCamera} aria-label={cameraOff ? 'Camera on' : 'Camera off'} className={cn('p-4 rounded-full transition', cameraOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20')}>
          {cameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}
