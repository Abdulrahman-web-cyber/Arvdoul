/**
 * Video save counts must have a real writer (N436).
 *
 * `videos/{id}.stats.saves` is seeded `0` at create and was never written: a
 * viewer's save state lives in `users/{uid}/saved_videos/{videoId}`, and the
 * video update rule excludes `stats`, so no client could maintain the aggregate.
 * The video card and the reels screen render `stats.saves` as a real count, so it
 * was a permanent fabricated `0`. The fix adds a server-authoritative
 * `toggleVideoSave` callable (the only writer of `stats.saves`, backed by the
 * `videos/{id}/saved_by/{uid}` record) and routes the client save/unsave through
 * it.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const videoSrc = read('functions/video.js');
const callableSrc = read('src/services/callableService.js');
const serviceSrc = read('src/services/videoService.js');
const rulesSrc = read('firestore.rules');

describe('video save counter has a real writer (N436)', () => {
  test('toggleVideoSave is a rate-limited, transactional onCall', () => {
    const block = videoSrc.slice(
      videoSrc.indexOf('exports.toggleVideoSave'),
      videoSrc.indexOf('//  6. recordVideoView'),
    );
    expect(block).toMatch(/exports\.toggleVideoSave = onCall\(/);
    expect(block).toMatch(/checkRateLimit\(uid, 'toggleVideoSave'/);
    expect(block).toMatch(/db\.runTransaction\(/);
    // Derives the aggregate from the per-user save record.
    expect(block).toMatch(/collection\('saved_by'\)\.doc\(uid\)/);
    expect(block).toMatch(/'stats\.saves': FieldValue\.increment\(1\)/);
    expect(block).toMatch(/'stats\.saves': FieldValue\.increment\(-1\)/);
  });

  test('the callable goes through the canonical FUNCTIONS map', () => {
    expect(callableSrc).toMatch(/TOGGLE_VIDEO_SAVE: 'toggleVideoSave'/);
    expect(serviceSrc).toMatch(/this\.fns\.toggleVideoSave = cf\(FUNCTIONS\.TOGGLE_VIDEO_SAVE\)/);
  });

  test('client save/unsave update the aggregate counter', () => {
    const saveBlock = serviceSrc.slice(
      serviceSrc.indexOf('async saveVideo(videoId, userId)'),
      serviceSrc.indexOf('async unsaveVideo(videoId, userId)'),
    );
    const unsaveBlock = serviceSrc.slice(
      serviceSrc.indexOf('async unsaveVideo(videoId, userId)'),
      serviceSrc.indexOf('getViewerVideoState'),
    );
    expect(saveBlock).toMatch(/this\.fns\.toggleVideoSave\(\{ videoId, save: true \}\)/);
    expect(unsaveBlock).toMatch(/this\.fns\.toggleVideoSave\(\{ videoId, save: false \}\)/);
  });

  test('the saves field is actually displayed (a real counter, not dead data)', () => {
    expect(read('src/components/Videos/VideoCard.jsx')).toMatch(/formatViewCount\(video\?\.saves\)/);
    expect(read('src/screens/ReelsScreen.jsx')).toMatch(/stats:\s*\{[\s\S]*?saves:/);
  });

  test('the server-internal saved_by collection is not client-accessible', () => {
    const idx = rulesSrc.indexOf('match /saved_by/');
    expect(idx).toBeGreaterThan(-1);
    const block = rulesSrc.slice(idx, idx + 200);
    expect(block).toMatch(/allow read, write: if false/);
  });
});
