/**
 * Storage rules ↔ client write-path guard (N170).
 *
 * The N170 defect: `storage.rules` declared namespaces and path shapes that did
 * not match what the client actually uploaded. Examples:
 *   - rules:  `avatars/{userId}/{fileName}`   client: `avatars/{uid}`
 *   - rules:  `posts/{userId}/{postId}/{fileName}`  client: `posts/{uid}/{file}`
 *   - rules:  `messages/{conv}/{messageId}/{fileName}`  client: `chat_media/{uid}/{file}`
 *   - rules:  `sounds/{userId}/{fileName}`    client: `sounds/{uid}/{file}` (ok)
 *   - no rule at all for `chat_media`, `comments/voice`, `events`, `group-photos`,
 *     `communities`, `audio_exports`.
 * The result: nearly every upload failed with `storage/unauthorized`.
 *
 * This suite is the machine-checkable contract between the two layers:
 *  1. Static: every namespace the client writes to has a rule, and every client
 *     write path has the `{namespace}/{ownerUid}/...` owner-scoped shape.
 *  2. Live (emulator only): each canonical client path is ALLOWED for its owner
 *     and DENIED for a different signed-in user; deletes are owner-only.
 *
 * It fails closed: the live half skips when no Storage emulator is exported
 * (`STORAGE_EMULATOR_HOST`), so CI's emulator job (which runs `emulators:exec`)
 * executes it while a plain `npm test` still runs the static half.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Canonical client upload paths, keyed by the file that owns the write.
// `ownerSegment` is the index (1-based) of the path segment that must equal the
// uploading user's uid. `messages` is participant-scoped, not owner-scoped.
const CLIENT_WRITE_PATHS = [
  { file: 'src/services/userService.js', path: 'avatars/{uid}/avatar_1' },
  { file: 'src/screens/SetupProfile.jsx', path: 'avatars/{uid}/1_x' },
  { file: 'src/screens/CreatePost.jsx', path: 'posts/{uid}/1_x' },
  { file: 'src/screens/CreatePost/CreateImage.jsx', path: 'posts/{uid}/1_x' },
  { file: 'src/services/storyService.js', path: 'stories/{uid}/1_x' },
  { file: 'src/services/messagesService.js', path: 'messages/{conversationId}/1_x', participantScoped: true },
  { file: 'src/screens/CreatePost/CreateVideo.jsx', path: 'videos/{uid}/1_x' },
  { file: 'src/services/soundService.js', path: 'sounds/{uid}/1_x' },
  { file: 'src/screens/CommentsDrawer.jsx', path: 'comments/{uid}/1_x' },
  { file: 'src/screens/CreatePost/CreateEvent.jsx', path: 'events/{uid}/1_x' },
  { file: 'src/screens/Event/CreateEventScreen.jsx', path: 'events/{uid}/cover_1' },
  { file: 'src/screens/NewConversationScreen.jsx', path: 'group-photos/{uid}/photo_1' },
  { file: 'src/screens/Community/CreateCommunityScreen.jsx', path: 'communities/{uid}/avatar_1' },
  { file: 'src/services/audioEditorService.js', path: 'audio_exports/{uid}/1_x' },
];

const CLIENT_NAMESPACES = [
  'avatars', 'banners', 'posts', 'stories', 'messages', 'live', 'communities',
  'sounds', 'videos', 'thumbnails', 'comments', 'events', 'group-photos',
  'audio_exports', 'temp', 'users',
];

describe('storage.rules ↔ client write paths', () => {
  const rules = read('storage.rules');

  test('every client namespace has a rule block', () => {
    const missing = CLIENT_NAMESPACES.filter((ns) => !rules.includes(`match /${ns}/`));
    expect(missing).toEqual([]);
  });

  test('owner-scoped namespaces gate on request.auth.uid == userId', () => {
    // The write gate must be provable from the path for owner-scoped media.
    expect(rules).toMatch(/function isOwner\(userId\)[\s\S]*request\.auth\.uid == userId/);
  });

  test('message media is participant-scoped, never public', () => {
    const block = rules.slice(
      rules.indexOf('match /messages/'),
      rules.indexOf('match /live/'),
    );
    expect(block).toContain('firestore.get(/databases/(default)/documents/conversations/');
    expect(block).toContain('.data.participants');
    // No blanket public read on private chat media.
    expect(block).not.toMatch(/allow read:\s*if true/);
  });

  test('each client write site embeds an owner (uid) segment, not a bare namespace', () => {
    const offenders = [];
    for (const { file, path: tmpl } of CLIENT_WRITE_PATHS) {
      const ns = tmpl.split('/')[0];
      const src = read(file);
      // The namespace must be immediately followed by a template interpolation
      // that carries an identity, never a timestamp/random value (which is what
      // the pre-N170 code did: `posts/${Date.now()}_...`).
      const re = new RegExp('`' + ns + '/\\$\\{([^}]+)\\}', 'g');
      const matches = [...src.matchAll(re)];
      if (matches.length === 0) { offenders.push(`${file} -> ${ns}/ (no owner segment)`); continue; }
      for (const m of matches) {
        if (/Date\.now|Math\.random|uuid|safeRandomUUID/i.test(m[1])) {
          offenders.push(`${file} -> ${ns}/${m[1]} (non-identity first segment)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no client code writes to the retired chat_media namespace', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['node_modules', '__tests__', 'dist', '.git'].includes(entry.name)) continue;
          walk(full);
        } else if (/\.(js|jsx)$/.test(entry.name)) {
          if (/chat_media\//.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });
});

// ---- Live adversarial checks (emulator only) ----
const emulatorHost = process.env.STORAGE_EMULATOR_HOST;
const canRunLive = Boolean(emulatorHost);

(canRunLive ? describe : describe.skip)('storage.rules live enforcement', () => {
  let initializeTestEnvironment;
  let assertSucceeds;
  let assertFails;
  let storageRef;
  let uploadBytes;
  let deleteObject;
  let env;

  beforeAll(async () => {
    ({ initializeTestEnvironment, assertSucceeds, assertFails } = await import('@firebase/rules-unit-testing'));
    ({ ref: storageRef, uploadBytes, deleteObject } = await import('firebase/storage'));
    // `emulators:exec` exports STORAGE_EMULATOR_HOST as a full URL
    // (http://127.0.0.1:9199); a raw "host:port" is also accepted.
    const raw = emulatorHost.replace(/^https?:\/\//, '');
    const [host, port] = raw.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-arvdoul',
      storage: { rules: read('storage.rules'), host, port: Number(port) },
    });
  });

  afterAll(async () => { await env?.cleanup(); });

  const bytes = () => new Uint8Array([1, 2, 3, 4]);
  const asUser = (uid) => env.authenticatedContext(uid).storage();

  test('owner uploads are allowed for every canonical path', async () => {
    const s = asUser('owner1');
    const paths = [
      ['avatars/owner1/a.jpg', 'image/jpeg'],
      ['banners/owner1/b.jpg', 'image/jpeg'],
      ['posts/owner1/p.jpg', 'image/jpeg'],
      ['stories/owner1/s.jpg', 'image/jpeg'],
      ['videos/owner1/v.mp4', 'video/mp4'],
      ['sounds/owner1/s.mp3', 'audio/mpeg'],
      ['comments/owner1/v.webm', 'audio/webm'],
      ['events/owner1/c.jpg', 'image/jpeg'],
      ['group-photos/owner1/g.jpg', 'image/jpeg'],
      ['communities/owner1/a.jpg', 'image/jpeg'],
      ['audio_exports/owner1/e.mp3', 'audio/mpeg'],
      ['temp/owner1/t.bin', 'application/octet-stream'],
      ['users/owner1/2026/11/08/x/f.jpg', 'image/jpeg'],
    ];
    for (const [p, ct] of paths) {
      await assertSucceeds(uploadBytes(storageRef(s, p), bytes(), { contentType: ct }));
    }
  });

  test('cross-user uploads are denied', async () => {
    const s = asUser('intruder');
    await assertFails(uploadBytes(storageRef(s, 'avatars/owner1/a.jpg'), bytes(), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(storageRef(s, 'posts/owner1/p.jpg'), bytes(), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(storageRef(s, 'temp/owner1/t.bin'), bytes(), { contentType: 'application/octet-stream' }));
  });

  test('owners can delete their own media (no request.resource on delete)', async () => {
    const s = asUser('owner2');
    await uploadBytes(storageRef(s, 'posts/owner2/d.jpg'), bytes(), { contentType: 'image/jpeg' });
    await assertSucceeds(deleteObject(storageRef(s, 'posts/owner2/d.jpg')));
  });

  test('non-owners cannot delete', async () => {
    const owner = asUser('owner3');
    await uploadBytes(storageRef(owner, 'posts/owner3/d.jpg'), bytes(), { contentType: 'image/jpeg' });
    const other = asUser('intruder');
    await assertFails(deleteObject(storageRef(other, 'posts/owner3/d.jpg')));
  });

  test('content-type gates reject disallowed media', async () => {
    const s = asUser('owner4');
    await assertFails(uploadBytes(storageRef(s, 'avatars/owner4/a.pdf'), bytes(), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(storageRef(s, 'sounds/owner4/s.mp4'), bytes(), { contentType: 'video/mp4' }));
  });
});
