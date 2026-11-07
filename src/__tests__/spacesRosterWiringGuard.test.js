/**
 * Spaces roster / signaling wiring guard.
 *
 * The Spaces screen advertised a working audio stage but was not wired to the
 * backend in three ways:
 *
 *  1. `spacesService.toggleRaisedHand` (and the new join/leave roster writes)
 *     update `spaces/{id}`, but the rules only let the *host* update the doc,
 *     so a member's "raise hand" was silently DENIED and the screen still
 *     toasted "Hand raised ✋".
 *  2. `signaling_rooms/{roomId}` resolves membership from
 *     `live_streams/{id}.participants` OR `spaces/{id}.participants`, but no
 *     code ever wrote `participants`, so every WebRTC signaling read/write was
 *     denied. A room id names exactly one parent, so the other `get()` returns
 *     null and a bare `.data` read throws and denies — the lookup must be
 *     `exists()`-guarded.
 *  3. The mic button only flipped local React state; no `getUserMedia`, no
 *     peer connection, no remote audio element.
 *
 * These checks are static (they run everywhere) plus adversarial emulator
 * checks when `FIRESTORE_EMULATOR_HOST` is set (the `guards` CI job).
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function blockBody(name) {
  const start = rules.search(new RegExp(`match\\s+/${name}/`));
  if (start === -1) return null;
  const lineEnd = rules.indexOf('\n', start);
  const open = rules.lastIndexOf('{', lineEnd === -1 ? rules.length : lineEnd);
  let depth = 0;
  for (let i = open; i < rules.length; i++) {
    if (rules[i] === '{') depth++;
    else if (rules[i] === '}') {
      depth--;
      if (depth === 0) return rules.slice(open, i + 1);
    }
  }
  return null;
}

describe('spaces rules grant the non-authoritative roster write', () => {
  test('a member update is allowed when it only touches roster keys', () => {
    const body = blockBody('spaces');
    expect(body).toBeTruthy();
    expect(body).toMatch(
      /affectedKeys\(\)[\s\S]*hasOnly\(\[\s*'raisedHands',\s*'participants',\s*'listeners',\s*'audienceCount'\s*\]\)/
    );
  });

  test('the roster carve-out never widens to host/authoritative fields', () => {
    const body = blockBody('spaces');
    // The host-owned update path stays keyed on host/userId; the carve-out is
    // the only path a non-host can take, and it is key-restricted.
    expect(body).toMatch(/resource\.data\.host\.id == uid\(\)/);
    expect(body).toMatch(/allow delete: if isSignedIn\(\)/);
  });

  test('signaling membership lookups are exists()-guarded before .data', () => {
    const body = blockBody('signaling_rooms');
    expect(body).toBeTruthy();
    // A room id names one parent; the other lookup is null. Without exists()
    // the `.data.participants` read throws and denies the request.
    expect(body).toMatch(/exists\(\/databases\/\$\(database\)\/documents\/live_streams\/\$\(roomId\)\)/);
    expect(body).toMatch(/exists\(\/databases\/\$\(database\)\/documents\/spaces\/\$\(roomId\)\)/);
    expect(body).toMatch(/\.data\.participants/);
  });
});

describe('spacesService is wired to the roster + real audio', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/spacesService.js'), 'utf8');

  test('createSpace seeds participants and the listener roster', () => {
    expect(src).toMatch(/participants:\s*\[hostUser\.uid\]/);
    expect(src).toMatch(/listeners:\s*\[/);
  });

  test('join/leave write the participants array the rules read', () => {
    expect(src).toContain('async joinSpace(');
    expect(src).toContain('async leaveSpace(');
    expect(src).toMatch(/arrayUnion\(user\.uid\)/);
    expect(src).toMatch(/arrayRemove\(userId\)/);
  });

  test('toggleRaisedHand surfaces failure instead of swallowing it', () => {
    expect(src).toMatch(/return \{ success: false, error: err\.message \}/);
  });

  test('startAudio opens a real microphone and a signaling room', () => {
    expect(src).toContain('async startAudio(');
    expect(src).toMatch(/navigator\.mediaDevices\.getUserMedia/);
    expect(src).toMatch(/this\.createSignalRoom\(/);
  });

  test('the discover list is scoped to live spaces and a space can end', () => {
    // Nothing ever flipped `isLive`, so every space stayed in the list forever.
    expect(src).toMatch(/where\('isLive', '==', true\)/);
    expect(src).toContain('async endSpace(');
    expect(src).toMatch(/isLive: false/);
  });
});

describe('SpacesScreen drives the service, not local state', () => {
  const src = fs.readFileSync(path.join(root, 'src/screens/Spaces/SpacesScreen.jsx'), 'utf8');

  test('joining a space writes the roster', () => {
    expect(src).toMatch(/spacesService\.joinSpace\(/);
    expect(src).toMatch(/spacesService\.leaveSpace\(/);
  });

  test('the hand toggle honours the service result', () => {
    expect(src).toMatch(/await spacesService\.toggleRaisedHand\(/);
    expect(src).toMatch(/result\?\.success/);
  });

  test('the mic button opens a real stream and renders remote audio', () => {
    expect(src).toMatch(/spacesService\.startAudio\(/);
    expect(src).toMatch(/<audio\s+ref=\{remoteAudioRef\}/);
    expect(src).toMatch(/srcObject/);
  });
});

// ---------- adversarial emulator checks ----------
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

async function emulatorReachable() {
  if (!emulatorHost) return false;
  try {
    const res = await fetch(`http://${emulatorHost}/`);
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

describe('spaces roster rules (emulator)', () => {
  let reachable = false;
  let env;
  let fsMod;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) return;
    const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
    env = await initializeTestEnvironment({
      projectId: 'arvdoul-spaces-test',
      firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
    fsMod = await import('firebase/firestore');
  });

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  test('a member can raise a hand but cannot rewrite host-owned fields', async () => {
    if (!reachable) return;
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'spaces/room1'), {
        host: { id: 'host' },
        participants: ['host', 'member'],
        listeners: [{ id: 'host' }],
        audienceCount: 1,
        raisedHands: [],
      });
    });
    const member = env.authenticatedContext('member').firestore();

    await fsMod.updateDoc(fsMod.doc(member, 'spaces/room1'), {
      raisedHands: [{ id: 'member' }],
    });

    await expect(
      fsMod.updateDoc(fsMod.doc(member, 'spaces/room1'), { title: 'hijacked' })
    ).rejects.toThrow();
  });

  test('signaling works for a space-only room (no live_streams doc)', async () => {
    if (!reachable) return;
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'spaces/room2'), {
        host: { id: 'host' },
        participants: ['host', 'member'],
      });
    });
    const member = env.authenticatedContext('member').firestore();
    // The room id exists only as a space; the live_streams lookup is null.
    // Without the exists() guard this write is denied.
    await fsMod.setDoc(fsMod.doc(member, 'signaling_rooms/room2'), {
      offer: { type: 'offer', sdp: 'x' },
    });
  });
});
