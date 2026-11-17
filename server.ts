import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Lazy shared Gemini client (never exposed to browser, User-Agent header set per telemetry spec)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function parseGeminiError(err: unknown, fallbackMessage: string): { status: number; message: string; retryable: boolean } {
  const raw = err instanceof Error ? err.message : fallbackMessage;
  let status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 502;
  let message = raw || fallbackMessage;

  // @google/genai ApiError often serializes JSON into err.message
  if (message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      const inner = parsed?.error || parsed;
      if (typeof inner?.code === 'number') status = inner.code;
      if (typeof inner?.message === 'string' && inner.message.trim()) {
        message = inner.message.trim();
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  if (
    (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) ||
    /operation was aborted|timed out/i.test(message)
  ) {
    status = 504;
    message = 'AI request timed out while waiting for Gemini.';
  }

  const retryable = status === 429 || status === 503 || status === 504 || /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|timeout/i.test(message);
  const httpStatus = status >= 400 && status < 600 ? status : 502;
  return { status: httpStatus, message, retryable };
}

async function withGeminiRetry<T>(fn: (abortSignal: AbortSignal) => Promise<T>, maxRetries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(AbortSignal.timeout(15000));
    } catch (err) {
      lastErr = err;
      const { retryable } = parseGeminiError(err, 'Gemini request failed');
      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 450 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

// Track live WebSocket media & signaling rooms
interface PeerEntry {
  peerId: string;
  userId: string;
  displayName: string;
  role: string;
  ws: WebSocket;
}

const rooms = new Map<string, Map<string, PeerEntry>>();

function broadcastToRoom(
  roomId: string,
  payload: unknown,
  excludePeerId?: string,
): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const [peerId, peer] of room.entries()) {
    if (peerId === excludePeerId) continue;
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(serialized);
    }
  }
}

function getRoomRoster(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.values()).map((p) => ({
    peerId: p.peerId,
    userId: p.userId,
    displayName: p.displayName,
    role: p.role,
  }));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // -------------------------------------------------------------------------
  // Health & runtime status
  // -------------------------------------------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      wsRooms: rooms.size,
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // Gemini Text / Co-Pilot endpoint (gemini-4-hydrogen)
  // Compatible with both structured studio requests and aiStudioService._callOpenAI
  // -------------------------------------------------------------------------
  app.post('/api/ai/generate', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini server API key is not configured.',
        code: 'ai_unconfigured',
      });
      return;
    }

    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 6000) : '';
    const systemPrompt =
      typeof body.systemPrompt === 'string'
        ? body.systemPrompt.trim().slice(0, 2500)
        : 'You are an expert creator co-pilot inside Arvdoul. Return crisp, high-signal, practical output without fluff.';
    const jsonMode = body.responseMimeType === 'application/json';

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    try {
      const thinkingLevel =
        body.modelTier === 'fast' ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM;
      const response = await withGeminiRetry((abortSignal) =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            abortSignal,
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingLevel },
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      );

      const content = response.text || '';
      if (!content) {
        res.status(502).json({ error: 'Model returned empty content' });
        return;
      }

      const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const completionTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

      res.json({
        content,
        model: 'gemini-4-hydrogen',
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          cost: 0,
        },
        serverVerified: true,
      });
    } catch (err: unknown) {
      const parsed = parseGeminiError(err, 'Gemini request failed');
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // -------------------------------------------------------------------------
  // Gemini Audio Transcription endpoint (gemini-3.5-transcribe)
  // -------------------------------------------------------------------------
  app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini server API key is not configured.' });
      return;
    }

    const { audioBase64, mimeType = 'audio/webm', instruction } = req.body || {};
    if (typeof audioBase64 !== 'string' || audioBase64.length < 16) {
      res.status(400).json({ error: 'Valid base64 audio payload is required' });
      return;
    }

    try {
      const promptText =
        typeof instruction === 'string' && instruction.trim()
          ? instruction.trim().slice(0, 500)
          : 'Transcribe this audio accurately and break it into short timed caption lines (one sentence or phrase per line). Return plain text lines.';

      const response = await withGeminiRetry((abortSignal) =>
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: String(mimeType),
                  data: audioBase64,
                },
              },
              { text: promptText },
            ],
          },
          config: { abortSignal },
        }),
      );

      const transcript = (response.text || '').trim();
      const lines = transcript
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const segments = lines.map((line, index) => ({
        startSec: index * 3,
        endSec: (index + 1) * 3,
        text: line,
      }));

      res.json({
        text: transcript,
        transcript,
        lines,
        segments,
        model: 'gemini-3.5-transcribe',
      });
    } catch (err: unknown) {
      const parsed = parseGeminiError(err, 'Audio transcription failed');
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // -------------------------------------------------------------------------
  // Gemini TTS Voiceover endpoint (gemini-3.8-flash-lite-tts / gemini-3.8-flash-tts)
  // -------------------------------------------------------------------------
  app.post('/api/ai/tts', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini server API key is not configured.' });
      return;
    }

    const {
      text,
      voiceName = 'Kore',
      style = 'Clear, engaging creator voiceover',
      multiSpeaker = false,
      dialogue,
    } = req.body || {};

    try {
      let response;
      if (multiSpeaker && Array.isArray(dialogue) && dialogue.length === 2) {
        const [first, second] = dialogue;
        response = await withGeminiRetry((abortSignal) =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: String(first.text || '').slice(0, 1200),
                    speechMetadata: {
                      speaker: String(first.speaker || 'Host'),
                      style: String(first.style || 'Enthusiastic studio host'),
                    },
                  },
                  {
                    text: String(second.text || '').slice(0, 1200),
                    speechMetadata: {
                      speaker: String(second.speaker || 'Guest'),
                      style: String(second.style || 'Thoughtful co-host'),
                    },
                  },
                ],
              },
            ],
            config: {
              abortSignal,
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    {
                      speaker: String(first.speaker || 'Host'),
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: String(first.voice || 'Puck') } },
                    },
                    {
                      speaker: String(second.speaker || 'Guest'),
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: String(second.voice || 'Kore') } },
                    },
                  ],
                },
              },
            },
          }),
        );
      } else {
        const cleanText = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
        if (!cleanText) {
          res.status(400).json({ error: 'text is required for speech generation' });
          return;
        }
        response = await withGeminiRetry((abortSignal) =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: { style: String(style).slice(0, 160) },
                  },
                ],
              },
            ],
            config: {
              abortSignal,
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: String(voiceName) },
                },
              },
            },
          }),
        );
      }

      const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inline?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'TTS model returned no audio data' });
        return;
      }

      const mimeType = inline?.mimeType || 'audio/wav';
      res.json({
        audioDataUrl: `data:${mimeType};base64,${base64Audio}`,
        audioBase64: base64Audio,
        mimeType,
        model: multiSpeaker ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts',
      });
    } catch (err: unknown) {
      const parsed = parseGeminiError(err, 'TTS generation failed');
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // -------------------------------------------------------------------------
  // Dev metrics endpoint (Prometheus text exposition) + Vite / static serving
  // -------------------------------------------------------------------------
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // -------------------------------------------------------------------------
  // Real-time WebSocket signaling & media relay on /ws
  // -------------------------------------------------------------------------
  const WS_MAX_PAYLOAD = 64 * 1024;
  const ALLOWED_WS_ROLES = new Set(['host', 'cohost', 'speaker', 'listener', 'viewer']);
  const SELF_MUTABLE_ROLES = new Set(['listener', 'viewer']);
  const ROOM_ID_RE = /^[A-Za-z0-9:_-]{1,140}$/;
  const MAX_ROOM_PEERS = 250;

  let cachedAuthVerifier: ((token: string) => Promise<string | null>) | null | undefined;
  async function verifyOptionalFirebaseToken(token: string): Promise<string | null> {
    if (!token) return null;
    if (cachedAuthVerifier === undefined) {
      try {
        const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
          import('firebase-admin/app'),
          import('firebase-admin/auth'),
        ]);
        if (!getApps().length) {
          initializeApp();
        }
        const auth = getAuth();
        cachedAuthVerifier = async (idToken: string) => {
          try {
            const decoded = await auth.verifyIdToken(idToken);
            return decoded?.uid || null;
          } catch {
            return null;
          }
        };
      } catch {
        cachedAuthVerifier = null;
      }
    }
    return cachedAuthVerifier ? cachedAuthVerifier(token) : null;
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let joinedRoomId: string | null = null;
    let joinedPeerId: string | null = null;
    let verifiedUid: string | null = null;
    let controlWindowStart = Date.now();
    let controlCount = 0;
    let binaryWindowStart = Date.now();
    let binaryCount = 0;

    const allowControlMessage = () => {
      const now = Date.now();
      if (now - controlWindowStart > 5000) {
        controlWindowStart = now;
        controlCount = 0;
      }
      controlCount += 1;
      return controlCount <= 60;
    };

    const allowBinaryFrame = () => {
      const now = Date.now();
      if (now - binaryWindowStart > 5000) {
        binaryWindowStart = now;
        binaryCount = 0;
      }
      binaryCount += 1;
      return binaryCount <= 160;
    };

    const leaveCurrentRoom = () => {
      if (!joinedRoomId || !joinedPeerId) return;
      const room = rooms.get(joinedRoomId);
      if (room) {
        room.delete(joinedPeerId);
        broadcastToRoom(joinedRoomId, {
          type: 'peer-left',
          roomId: joinedRoomId,
          peerId: joinedPeerId,
          roster: getRoomRoster(joinedRoomId),
        });
        if (room.size === 0) {
          rooms.delete(joinedRoomId);
        }
      }
      joinedRoomId = null;
      joinedPeerId = null;
    };

    ws.on('message', async (raw: RawData, isBinary: boolean) => {
      // Binary WebM / audio media chunks relayed from broadcaster to room viewers
      if (isBinary) {
        if (!joinedRoomId || !allowBinaryFrame()) return;
        const room = rooms.get(joinedRoomId);
        if (!room) return;
        for (const [peerId, peer] of room.entries()) {
          if (peerId !== joinedPeerId && peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(raw, { binary: true });
          }
        }
        return;
      }

      if (!allowControlMessage()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', code: 'rate-limited', message: 'Too many signaling messages.' }));
        }
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '').slice(0, 60);
      if (type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
        return;
      }

      if (type === 'join') {
        leaveCurrentRoom();
        const roomId = String(msg.roomId || '').trim().slice(0, 140);
        const peerId =
          String(msg.peerId || '').trim().replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 120) ||
          `peer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (!roomId || !ROOM_ID_RE.test(roomId)) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', code: 'invalid-room', message: 'Invalid roomId.' }));
          }
          return;
        }

        if (typeof msg.authToken === 'string' && msg.authToken.trim()) {
          verifiedUid = await verifyOptionalFirebaseToken(msg.authToken.trim());
        }

        const requestedRole = String(msg.role || 'listener').trim().toLowerCase();
        const safeRole = ALLOWED_WS_ROLES.has(requestedRole) ? requestedRole : 'listener';

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }
        const room = rooms.get(roomId)!;
        if (room.size >= MAX_ROOM_PEERS && !room.has(peerId)) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', code: 'room-full', message: 'Room is full.' }));
          }
          return;
        }

        const entry: PeerEntry = {
          peerId,
          userId: verifiedUid || String(msg.userId || '').slice(0, 128),
          displayName: String(msg.displayName || 'Participant').slice(0, 80),
          role: safeRole,
          ws,
        };
        room.set(peerId, entry);
        joinedRoomId = roomId;
        joinedPeerId = peerId;

        const roster = getRoomRoster(roomId);
        ws.send(
          JSON.stringify({
            type: 'joined',
            roomId,
            peerId,
            roster,
          }),
        );
        broadcastToRoom(
          roomId,
          {
            type: 'peer-joined',
            roomId,
            peer: {
              peerId: entry.peerId,
              userId: entry.userId,
              displayName: entry.displayName,
              role: entry.role,
            },
            roster,
          },
          peerId,
        );
        return;
      }

      if (type === 'leave') {
        leaveCurrentRoom();
        return;
      }

      if (!joinedRoomId || !joinedPeerId) return;

      // Direct peer-to-peer WebRTC signaling (offer / answer / ice-candidate)
      if (msg.targetPeerId && typeof msg.targetPeerId === 'string') {
        const room = rooms.get(joinedRoomId);
        const target = room?.get(msg.targetPeerId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(
            JSON.stringify({
              ...msg,
              fromPeerId: joinedPeerId,
            }),
          );
        }
        return;
      }

      // Broadcast signaling or room event (role change, media chunk JSON, reaction, chat)
      if (type === 'speaker-state' && joinedRoomId && joinedPeerId) {
        const room = rooms.get(joinedRoomId);
        const entry = room?.get(joinedPeerId);
        const nextRole = typeof msg.role === 'string' ? msg.role.trim().toLowerCase() : '';
        if (entry && ALLOWED_WS_ROLES.has(nextRole)) {
          // Only hosts/cohosts can promote speakers/cohosts; self-service users can step down to listener/viewer.
          if (SELF_MUTABLE_ROLES.has(nextRole) || entry.role === 'host' || entry.role === 'cohost') {
            if (nextRole !== 'host' || entry.role === 'host') {
              entry.role = nextRole;
            }
          }
        }
      }

      broadcastToRoom(
        joinedRoomId,
        {
          ...msg,
          roomId: joinedRoomId,
          fromPeerId: joinedPeerId,
          roster: getRoomRoster(joinedRoomId),
        },
        joinedPeerId,
      );
    });

    ws.on('close', leaveCurrentRoom);
    ws.on('error', leaveCurrentRoom);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Arvdoul full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Arvdoul server:', err);
  process.exit(1);
});
