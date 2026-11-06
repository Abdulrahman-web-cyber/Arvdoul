/**
 * Integration wiring guards.
 *
 * These pin fixes for surfaces that *looked* wired but were not:
 *   - the short-video feed never reported views and never resolved the
 *     viewer's follow state (every followed creator rendered as "+ Follow");
 *   - the Reels screen reported no views at all;
 *   - `sendEmailNotification` was an authenticated open email relay;
 *   - the `notifications.email` toggle was written but read nowhere;
 *   - the bulk-notification worker marked jobs "completed" without fanning out;
 *   - the scheduled Algolia reindex rebuilt only the users index.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('video feed wiring', () => {
  test('VideoFeed records a view for the on-screen video', () => {
    const src = read('src/components/Videos/VideoFeed.jsx');
    expect(src).toContain('videoService.recordVideoView');
    expect(src).toMatch(/videos\[currentIndex\]\?\.id/);
  });

  test('VideoFeed resolves the viewer follow state and passes it down', () => {
    const src = read('src/components/Videos/VideoFeed.jsx');
    expect(src).toContain('getFollowing');
    expect(src).toMatch(/followedByViewer=\{followingIds\.has/);
  });

  test('VideoCard accepts followedByViewer instead of hardcoding false', () => {
    const src = read('src/components/Videos/VideoCard.jsx');
    expect(src).toContain('followedByViewer');
    expect(src).not.toContain('useState(video?.creator?.isFollowing || false)');
  });

  test('ReelsScreen records a view for the reel the viewer leaves', () => {
    const src = read('src/screens/ReelsScreen.jsx');
    expect(src).toContain('videoService.recordVideoView');
  });

  test('VideoDetailScreen feeds the action rail flat counters and a real viewer state', () => {
    const src = read('src/screens/VideoDetailScreen.jsx');
    expect(src).toContain('getViewerVideoState');
    expect(src).toMatch(/likes=\{likeCount\}/);
    expect(src).toMatch(/isLiked=\{liked\}/);
    expect(src).toMatch(/isSaved=\{saved\}/);
    // The rail never accepted a `video` prop; passing one rendered 0 counters.
    expect(src).not.toMatch(/<VideoActionRail[\s\S]{0,120}video=\{video\}/);
  });
});

describe('notification channel wiring', () => {
  test('the email channel opt-out is read by the server', () => {
    const src = read('functions/notifications.js');
    expect(src).toMatch(/prefs\.email !== false/);
  });

  test('the digest honours both the in-app and email opt-outs', () => {
    const src = read('functions/notifications.js');
    expect(src).toMatch(/prefs\.inApp !== false/);
    expect(src).toMatch(/prefs\.email !== false/);
  });

  test('the bulk notification worker performs a real fan-out', () => {
    const src = read('functions/notifications.js');
    expect(src).not.toContain('For demonstration, we won');
    expect(src).not.toContain('omitted for brevity');
    expect(src).toContain('resolveBulkAudience');
    expect(src).toMatch(/totalTargets:\s*recipients\.length/);
  });

  test('sendEmailNotification is admin-gated and derives the recipient', () => {
    const src = read('functions/index.js');
    expect(src).toMatch(/exports\.sendEmailNotification[\s\S]*assertAdmin\(context\)/);
    expect(src).toMatch(/getUserEmail\(uid\)/);
  });
});

describe('search reindex completeness', () => {
  test('the scheduled reindex rebuilds users, posts and videos from shared builders', () => {
    const src = read('functions/search.js');
    expect(src).not.toContain('omitted for brevity');
    const reindex = src.slice(src.indexOf('exports.batchReindex'));
    expect(reindex).toContain('buildUserRecord');
    expect(reindex).toContain('buildPostRecord');
    expect(reindex).toContain('buildVideoRecord');
    expect(reindex).toMatch(/collection\('posts'\)/);
    expect(reindex).toMatch(/collection\('videos'\)/);
  });
});
