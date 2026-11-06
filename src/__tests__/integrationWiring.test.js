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

describe('design-system duplication', () => {
  test('no component basename exists in both design-system and components/UI', () => {
    // EmptyState and ErrorState were fully duplicated in both trees, so the
    // two screens that imported the `components/UI` copy silently diverged from
    // the tested, axe-verified `design-system` pair. One implementation only.
    const dsDir = path.join(root, 'src/design-system');
    const uiDir = path.join(root, 'src/components/UI');
    const names = (dir) =>
      fs.readdirSync(dir).filter((f) => /\.jsx?$/.test(f));
    const overlap = names(dsDir).filter((f) => names(uiDir).includes(f));
    expect(overlap).toEqual([]);
  });
});

describe('PostCard analytics panel', () => {
  test('reads real post analytics instead of an unproduced post.analytics shape', () => {
    const src = read('src/screens/PostCard.jsx');
    // Nothing ever wrote post.analytics.{views,reach,watchTime,...}, so the
    // panel rendered blank rows. It now loads the real counters.
    expect(src).toContain('firestoreService.getPostAnalytics');
    expect(src).not.toContain('post.analytics?.views');
    expect(src).not.toContain('post.analytics?.reach');
    expect(src).not.toContain('post.analytics?.watchTime');
    expect(src).not.toContain('post.analytics?.completionRate');
  });
});

describe('router wiring: every lazy screen is actually routed', () => {
  test('no lazy screen is declared without a matching route element', () => {
    // A `const X = lazy(() => import('../screens/X'))` that no `<X />` renders is
    // dead: the chunk is never requested and the screen is unreachable. Three
    // such screens (BadgeScreen, NetworkScreen, CollaborationScreen) shipped
    // that way, shadowed by routed equivalents.
    const src = read('src/routes/AppRoutes.jsx');
    const declared = [...src.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(/g)].map((m) => m[1]);
    const unused = declared.filter((name) => {
      const rendered = new RegExp(`<${name}\\b`).test(src);
      return !rendered;
    });
    expect(unused).toEqual([]);
  });

  test('no literal navigate() target points at a non-existent route', () => {
    // `navigate('/offline-status')` and `navigate('/app/feed')` shipped against
    // routes that do not exist (`/offline`, `/home`), so the buttons silently
    // fell through to the 404 route. Only plain (non-template) string literals
    // are checked; dynamic segments are skipped.
    const routes = read('src/routes/AppRoutes.jsx');
    const routeSegments = new Set();
    for (const m of routes.matchAll(/path="([^"]+)"/g)) {
      for (const seg of m[1].split('/').filter(Boolean)) routeSegments.add(seg);
    }

    const files = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.jsx')) files.push(full);
      }
    };
    walk(path.join(root, 'src'));

    const NAV_RE = /navigate\(\s*(['"])(\/[^'"]*)\1\s*\)/g;
    const missing = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(NAV_RE)) {
        const target = m[2].split(/[?#]/)[0];
        if (target === '/') continue;
        const first = target.split('/').filter(Boolean)[0];
        if (first && !routeSegments.has(first)) {
          missing.push(`${path.relative(root, file)}: ${target}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
