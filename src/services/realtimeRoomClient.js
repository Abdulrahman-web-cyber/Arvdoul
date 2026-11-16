// src/services/realtimeRoomClient.js
//
// Real-time WebSocket signaling + presence + WebRTC multi-peer room client backed by /ws on Express.
// Handles:
//   - Room join/leave/heartbeat
//   - Peer roster updates
//   - Multi-peer WebRTC signaling (rtc-offer / rtc-answer / rtc-ice) for Live video & Spaces audio
//   - Ephemeral low-latency room events (live-comment, space-reaction, speaking-level)

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function createRealtimeRoomClient() {
  let ws = null;
  let activeRoomId = null;
  let localPeerId = null;
  let localRole = 'listener';
  let localMediaStream = null;
  let pingTimer = null;
  const peers = new Map(); // remotePeerId -> RTCPeerConnection
  const listeners = new Set();

  const emit = (event) => {
    listeners.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // listener errors must not break the signaling loop
      }
    });
  };

  const sendJson = (payload) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  const closePeer = (remotePeerId) => {
    const pc = peers.get(remotePeerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // noop
      }
      peers.delete(remotePeerId);
    }
  };

  const closeAllPeers = () => {
    for (const remoteId of Array.from(peers.keys())) {
      closePeer(remoteId);
    }
  };

  const getOrCreatePeer = (remotePeerId) => {
    if (peers.has(remotePeerId)) return peers.get(remotePeerId);
    if (typeof RTCPeerConnection === 'undefined') return null;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    peers.set(remotePeerId, pc);

    if (localMediaStream) {
      localMediaStream.getTracks().forEach((track) => {
        pc.addTrack(track, localMediaStream);
      });
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendJson({
          type: 'rtc-ice',
          targetPeerId: remotePeerId,
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0];
      if (stream) {
        emit({ type: 'remote-stream', peerId: remotePeerId, stream });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(remotePeerId);
      }
    };

    return pc;
  };

  const initiateOffer = async (remotePeerId) => {
    if (!remotePeerId || remotePeerId === localPeerId) return;
    const pc = getOrCreatePeer(remotePeerId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendJson({
        type: 'rtc-offer',
        targetPeerId: remotePeerId,
        sdp: { type: offer.type, sdp: offer.sdp },
      });
    } catch {
      // peer may have disconnected mid-negotiation
    }
  };

  const handleMessage = async (msg) => {
    if (!msg || typeof msg !== 'object') return;
    const type = msg.type;

    if (type === 'joined') {
      localPeerId = msg.peerId || localPeerId;
      emit({ type: 'roster', roster: msg.roster || [], peerId: localPeerId });
      if (localRole === 'broadcaster' || localRole === 'speaker') {
        for (const entry of msg.roster || []) {
          if (entry.peerId && entry.peerId !== localPeerId) {
            await initiateOffer(entry.peerId);
          }
        }
      }
      return;
    }

    if (type === 'peer-joined') {
      emit({ type: 'roster', roster: msg.roster || [] });
      if (
        (localRole === 'broadcaster' || localRole === 'speaker') &&
        msg.peer?.peerId &&
        msg.peer.peerId !== localPeerId
      ) {
        await initiateOffer(msg.peer.peerId);
      }
      return;
    }

    if (type === 'peer-left') {
      if (msg.peerId) closePeer(msg.peerId);
      emit({ type: 'roster', roster: msg.roster || [] });
      return;
    }

    if (type === 'rtc-offer' && msg.fromPeerId && msg.sdp) {
      const pc = getOrCreatePeer(msg.fromPeerId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendJson({
          type: 'rtc-answer',
          targetPeerId: msg.fromPeerId,
          sdp: { type: answer.type, sdp: answer.sdp },
        });
      } catch {
        // ignore stale offer
      }
      return;
    }

    if (type === 'rtc-answer' && msg.fromPeerId && msg.sdp) {
      const pc = peers.get(msg.fromPeerId);
      if (!pc) return;
      try {
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
      } catch {
        // ignore duplicate answer
      }
      return;
    }

    if (type === 'rtc-ice' && msg.fromPeerId && msg.candidate) {
      const pc = peers.get(msg.fromPeerId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch {
        // ignore invalid ice
      }
      return;
    }

    emit(msg);
  };

  return {
    joinRoom(roomId, { userId = '', displayName = 'Participant', role = 'listener', stream = null } = {}) {
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined' || !roomId) return;

      this.leaveRoom();
      activeRoomId = roomId;
      localRole = role;
      localMediaStream = stream;
      localPeerId = `peer_${userId || 'anon'}_${Date.now().toString(36)}`;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }

      ws.onopen = () => {
        sendJson({
          type: 'join',
          roomId: activeRoomId,
          peerId: localPeerId,
          userId,
          displayName,
          role: localRole,
        });
        pingTimer = setInterval(() => {
          sendJson({ type: 'ping' });
        }, 25000);
        emit({ type: 'connected', roomId: activeRoomId });
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        try {
          const parsed = JSON.parse(ev.data);
          handleMessage(parsed);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        emit({ type: 'disconnected' });
      };
    },

    setLocalStream(stream, role = 'speaker') {
      localMediaStream = stream;
      localRole = role;
      sendJson({ type: 'speaker-state', role });
      for (const [remotePeerId, pc] of peers.entries()) {
        if (stream) {
          stream.getTracks().forEach((track) => {
            const existing = pc.getSenders().find((s) => s.track && s.track.kind === track.kind);
            if (existing) {
              existing.replaceTrack(track).catch(() => {});
            } else {
              pc.addTrack(track, stream);
            }
          });
          initiateOffer(remotePeerId);
        }
      }
    },

    broadcast(eventType, data = {}) {
      return sendJson({ type: eventType, ...data });
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    leaveRoom() {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      closeAllPeers();
      if (ws) {
        try {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'leave' }));
          }
          ws.close();
        } catch {
          // noop
        }
        ws = null;
      }
      activeRoomId = null;
      localMediaStream = null;
    },
  };
}

export default createRealtimeRoomClient;
