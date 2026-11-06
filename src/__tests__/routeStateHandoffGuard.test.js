/**
 * Cross-screen route-state handoff guard.
 *
 * React Router passes `navigate(path, { state })` data that survives only if the
 * receiving screen reads `location.state`. The app shipped several handoffs
 * where the producer wrote state and the consumer ignored it, so a toast
 * promised a result that never arrived:
 *
 *  - SoundsScreen "Use in Reel" → `/create-post` with `selectedAudio`, which
 *    CreatePost never read, so the reel composer opened empty.
 *  - VideoEditor "Share to Feed" → `/create-post` with `videoFile`/`videoUrl`,
 *    also never read, so the just-rendered video was discarded.
 *  - ProfileFeedGrid / SoundsScreen → `/audio-editor` with only `trackId`/title,
 *    while AudioEditorScreen decodes `location.state.audioUrl`, so the editor
 *    always opened an empty project.
 *
 * This guard pins those media handoffs: each producer's state keys must be
 * consumed by the receiving screen.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Keys consumed by a screen via `location.state?.key` or `state.key`. */
function consumedKeys(source) {
  const keys = new Set();
  for (const m of source.matchAll(/state\?\.([A-Za-z_$][\w$]*)/g)) keys.add(m[1]);
  for (const m of source.matchAll(/location\.state\.([A-Za-z_$][\w$]*)/g)) keys.add(m[1]);
  return keys;
}

const SRC = path.join(root, 'src');

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// The signup/login/onboarding flow is explicitly out of scope for edits, so its
// navigation markers are allowlisted rather than "fixed". Every entry is a key
// produced only inside those files and consumed nowhere — a benign marker, not
// a broken handoff. Any NEW dead key outside this set fails the guard.
const AUTH_FLOW_DEAD_KEYS = new Set([
  'fromIntro', 'fromSplash', 'fromVerification', 'isSignup', 'phoneNumber',
  'verificationId', 'timestamp', 'welcomeMessage', 'displayName',
  'passwordResetSuccess',
]);

const AUTH_FLOW_FILES = [
  'src/screens/IntroScreen.jsx', 'src/screens/SplashScreen.jsx',
  'src/screens/OtpVerification.jsx', 'src/screens/LoginScreen.jsx',
  'src/screens/ResetPassword.jsx', 'src/screens/ForgotPassword.jsx',
  'src/screens/SignupStep1Personal.jsx', 'src/screens/SignupStep2VerifyContact.jsx',
  'src/screens/SetupProfile.jsx', 'src/screens/VerifyEmailScreen.jsx',
  'src/context/AuthContext.jsx',
];

describe('route-state handoff guard: producers and consumers agree', () => {
  test('SoundsScreen "Use in Reel" keys are consumed by CreatePost', () => {
    const producer = read('src/screens/Sounds/SoundsScreen.jsx');
    const consumer = consumedKeys(read('src/screens/CreatePost.jsx'));
    const match = producer.match(/navigate\('\/create-post',\s*\{\s*state:\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    const keys = [...match[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(consumer.has(key)).toBe(true);
    }
  });

  test('VideoEditor "Share to Feed" keys are consumed by CreatePost', () => {
    const producer = read('src/screens/VideoEditor/components/ExportModal.jsx');
    const consumer = consumedKeys(read('src/screens/CreatePost.jsx'));
    const match = producer.match(/navigate\('\/create-post',\s*\{\s*state:\s*\{([\s\S]*?)\}\s*,?\s*\}\s*\)/);
    expect(match).not.toBeNull();
    const keys = [...match[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]);
    expect(keys).toEqual(expect.arrayContaining(['videoFile', 'videoUrl']));
    for (const key of ['videoFile', 'videoUrl']) {
      expect(consumer.has(key)).toBe(true);
    }
  });

  test('every "/audio-editor" producer supplies audioUrl for AudioEditorScreen', () => {
    const consumer = consumedKeys(read('src/screens/AudioEditor/AudioEditorScreen.jsx'));
    expect(consumer.has('audioUrl')).toBe(true);

    const producers = [
      'src/screens/Sounds/SoundsScreen.jsx',
      'src/components/profile/ProfileFeedGrid.jsx',
      'src/screens/CreatePost/CreateAudio.jsx',
    ];
    for (const rel of producers) {
      const source = read(rel);
      for (const m of source.matchAll(/navigate\('\/audio-editor',\s*\{\s*state:\s*\{([\s\S]*?)\}\s*\}\s*\)/g)) {
        expect(m[1]).toMatch(/audioUrl\s*:/);
      }
    }
  });

  test('no dead route-state key outside the allowlisted auth flow', () => {
    const files = collect(SRC);
    const consumed = new Set();
    for (const file of files) {
      for (const key of consumedKeys(fs.readFileSync(file, 'utf8'))) consumed.add(key);
    }

    const dead = new Map(); // key -> Set(files)
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const m of source.matchAll(/state:\s*\{([\s\S]*?)\}\s*[,}]/g)) {
        // Only top-level keys: stop at the first nested object/array.
        const top = m[1].split(/[{[]/)[0];
        for (const k of top.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) {
          if (consumed.has(k[1]) || AUTH_FLOW_DEAD_KEYS.has(k[1])) continue;
          if (!dead.has(k[1])) dead.set(k[1], new Set());
          dead.get(k[1]).add(path.relative(root, file));
        }
      }
    }

    const report = [...dead.entries()].map(([key, fs2]) => `${key} <- ${[...fs2].join(', ')}`);
    expect(report).toEqual([]);
  });
});
