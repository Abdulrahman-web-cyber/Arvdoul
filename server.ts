import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { GoogleGenAI } from '@google/genai';

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
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      });

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
      const message = err instanceof Error ? err.message : 'Gemini request failed';
      res.status(502).json({ error: message });
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

      const response = await ai.models.generateContent({
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
      });

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
      const message = err instanceof Error ? err.message : 'Audio transcription failed';
      res.status(502).json({ error: message });
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
        response = await ai.models.generateContent({
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
        });
      } else {
        const cleanText = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
        if (!cleanText) {
          res.status(400).json({ error: 'text is required for speech generation' });
          return;
        }
        response = await ai.models.generateContent({
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
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: String(voiceName) },
              },
            },
          },
        });
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
      const message = err instanceof Error ? err.message : 'TTS generation failed';
      res.status(502).json({ error: message });
    }
  });

  // -------------------------------------------------------------------------
  // Dev metrics endpoint (Prometheus text exposition) + Vite / static serving
  // -------------------------------------------------------------------------
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // -------------------------------------------------------------------------
  // Real-time WebSocket signaling & media relay on /ws
  // -------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });

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

    ws.on('message', (raw: RawData, isBinary: boolean) => {
      // Binary WebM / audio media chunks relayed from broadcaster to room viewers
      if (isBinary) {
        if (!joinedRoomId) return;
        const room = rooms.get(joinedRoomId);
        if (!room) return;
        for (const [peerId, peer] of room.entries()) {
          if (peerId !== joinedPeerId && peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(raw, { binary: true });
          }
        }
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '');
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
          String(msg.peerId || '').trim().slice(0, 120) ||
          `peer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (!roomId) return;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }
        const entry: PeerEntry = {
          peerId,
          userId: String(msg.userId || ''),
          displayName: String(msg.displayName || 'Participant').slice(0, 80),
          role: String(msg.role || 'listener'),
          ws,
        };
        rooms.get(roomId)!.set(peerId, entry);
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
        const entry = rooms.get(joinedRoomId)?.get(joinedPeerId);
        if (entry && typeof msg.role === 'string') {
          entry.role = msg.role;
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
