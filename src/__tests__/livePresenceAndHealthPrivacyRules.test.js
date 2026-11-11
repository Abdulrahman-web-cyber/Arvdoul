/**
 * @jest-environment node
 *
 * Least-privilege reads for two collections that exposed data to every signed-in
 * user for no product reason:
 *
 *  - `system_health/{docId}` is platform telemetry; the only client reader is the
 *    admin health screen's round-trip probe (`adminService.probeDatabase`).
 *    A bare signed-in read exposed platform internals to every user.
 *  - `live_viewers/{streamId}_{viewerId}` names WHO is watching a stream. A bare
 *    signed-in read exposed the live presence graph to every user; the only
 *    client read is `getLiveViewers` (a host-only viewer list).
 *
 * The static checks always run; the adversarial checks run against the Firestore
 * emulator when one is reachable (the `guards` CI job provides one).
 */

import fs from 'node:fs';
import path from 'node:path';

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

let fsMod;
let rules;

async function makeEnv(projectId) {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  return initializeTestEnvironment({
    projectId,
    firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
  });
}

const readFile = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

describe('live presence and system health are least-privilege', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[livePresenceAndHealthPrivacyRules] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
      return;
    }
    rules = readFile('firestore.rules');
    fsMod = await import('firebase/firestore');
  });

  test('system_health read is admin-only', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /system_health/{docId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
    expect(block).not.toMatch(/allow read: if isSignedIn\(\)/);
    expect(block).toMatch(/allow read: if isAdmin\(\)/);
  });

  test('live_viewers read is scoped to the viewer, host and admins', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /live_viewers/{viewerId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
    expect(block).not.toMatch(/allow read: if isSignedIn\(\);/);
    expect(block).toMatch(/resource\.data\.userId == uid\(\)/);
    expect(block).toMatch(/liveStreamHost\(resource\.data\.streamId\) == uid\(\)/);
  });

  test('a stranger cannot read platform telemetry (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-system-health-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'system_health/probe'), { ok: true });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'system_health/probe'))).rejects.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('only the viewer, the host and admins can read a live_viewers row (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-live-viewers-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'live_streams/s1'), { userId: 'host', status: 'live' });
        await fsMod.setDoc(fsMod.doc(db, 'live_viewers/s1_watcher'), {
          userId: 'watcher', streamId: 's1', leftAt: null,
        });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      const watcher = env.authenticatedContext('watcher').firestore();
      const host = env.authenticatedContext('host').firestore();

      await expect(fsMod.getDoc(fsMod.doc(stranger, 'live_viewers/s1_watcher'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(watcher, 'live_viewers/s1_watcher'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(host, 'live_viewers/s1_watcher'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('system and enterprise_tenants reads are admin-only', () => {
    const rulesSrc = readFile('firestore.rules');
    for (const marker of ['match /system/{docId}', 'match /enterprise_tenants/{tenantId}']) {
      const start = rulesSrc.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
      expect(block).not.toMatch(/allow read: if isSignedIn\(\)/);
      expect(block).toMatch(/allow read: if isAdmin\(\)/);
    }
  });

  test('collaboration_projects read is membership-scoped', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /collaboration_projects/{projectId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
    expect(block).not.toMatch(/allow read: if isSignedIn\(\);/);
    expect(block).toMatch(/allow read: if collabProjectAccess\(projectId\)/);
  });

  test('shares read is scoped to the sharer', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /shares/{shareId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
    expect(block).not.toMatch(/allow read: if true/);
    expect(block).toMatch(/resource\.data\.userId == uid\(\)/);
  });

  test('a stranger cannot read a share record (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-shares-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'shares/s1'), { postId: 'p1', userId: 'sharer' });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      const sharer = env.authenticatedContext('sharer').firestore();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'shares/s1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(sharer, 'shares/s1'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('only the owner, a team member and admins can read a collaboration project (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-collab-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'collaboration_projects/p1'), { ownerId: 'owner', name: 'Secret cut' });
        await fsMod.setDoc(fsMod.doc(db, 'collaboration_projects/p1/team/owner'), { userId: 'owner', role: 'owner' });
        await fsMod.setDoc(fsMod.doc(db, 'collaboration_projects/p1/team/editor'), { userId: 'editor', role: 'editor' });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      const owner = env.authenticatedContext('owner').firestore();
      const editor = env.authenticatedContext('editor').firestore();

      await expect(fsMod.getDoc(fsMod.doc(stranger, 'collaboration_projects/p1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'collaboration_projects/p1/team/editor'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(owner, 'collaboration_projects/p1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(editor, 'collaboration_projects/p1/team/editor'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
