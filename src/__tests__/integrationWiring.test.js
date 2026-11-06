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

  test('records a real view so the panel view count is not always zero', () => {
    const src = read('src/screens/PostCard.jsx');
    // `posts/{id}/view_aggregate` + `/daily_stats` are only ever written by the
    // recordPostView path. Without a call site the view row was permanently 0.
    expect(src).toContain('firestoreService.recordPostView');
  });

  test('recordPostView is server-authoritative (callable owns the writes)', () => {
    const svc = read('src/services/firestoreService.js');
    const body = svc.slice(svc.indexOf('async recordPostView'), svc.indexOf('async getPostDailyViews'));
    // The client may not write the view collections directly: the posts
    // `{subcollection}` rule binds every child id to the caller's uid.
    expect(body).toContain('FUNCTIONS.RECORD_POST_VIEW');
    expect(body).not.toContain("'view_aggregate'");
    expect(body).not.toContain("'view_shards'");
    const fn = read('functions/analytics.js');
    expect(fn).toContain('exports.recordPostView');
    expect(fn).toContain('db.runTransaction');
    expect(fn).toContain("incrementShardedCounter(`posts/${postId}`, 'views')");
  });

  test('post view subcollections are server-write-only in the rules', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /posts/{postId}');
    const block = rules.slice(start, rules.indexOf('match /comments/', start));
    expect(block).toContain('match /viewers/{viewerId}');
    expect(block).toContain('match /daily_stats/{statId}');
    expect(block).toMatch(/viewers\/\{viewerId\}[\s\S]*?allow write: if false;/);
    expect(block).toMatch(/daily_stats\/\{statId\}[\s\S]*?allow write: if false;/);
  });
});

describe('post-surface interaction analytics wiring', () => {
  // The sub-cards emit `onAnalytics(event, data)`; before this the handler was
  // a no-op (`() => {}`) or missing, so every emit was silently discarded.
  test('PostCard passes the real sink to the sub-cards that emit analytics', () => {
    const src = read('src/screens/PostCard.jsx');
    expect(src).toContain('trackAnalyticsEvent');
    // The dead no-op handler must be gone.
    expect(src).not.toContain('onAnalytics={() => {}}');
    for (const card of ['TextCard', 'ImageCard', 'VideoCard', 'PollCard', 'LinkCard']) {
      const m = src.match(new RegExp(`<${card}\\b[^>]*>`));
      expect(m).not.toBeNull();
      expect(m[0]).toContain('onAnalytics={handleAnalytics}');
    }
  });

  test('the two PostOptionsDrawer call sites supply a handler', () => {
    for (const file of ['src/screens/HomeScreen.jsx', 'src/screens/PostDetails.jsx']) {
      const src = read(file);
      expect(src).toMatch(/<PostOptionsDrawer\b/);
      // `[^>]*` cannot be used here: the JSX contains `=>` arrows.
      expect(src).toContain('onAnalytics={trackAnalyticsEvent}');
    }
  });

  test('the sink records into metricsService and never fabricates author analytics', () => {
    const src = read('src/services/analyticsService.js');
    expect(src).toContain('trackAnalyticsEvent');
    expect(src).toContain('trackAnalyticsBatch');
    expect(src).toContain('metricsService.incrementCounter');
    // A stable module-level dispatcher (keeps sub-card memoisation intact).
    expect(src).toMatch(/export const trackAnalyticsEvent = /);
  });

  test('VideoCard does not sendBeacon to a nonexistent endpoint', () => {
    const src = read('src/screens/PostCard/VideoCard.jsx');
    expect(src).not.toContain('/api/analytics/batch');
    expect(src).not.toContain('sendBeacon');
  });
});

describe('post-embedded poll voting is wired end-to-end', () => {
  // PollCard is display-only without `onVote` — every tap showed "Voting not
  // configured". PostCard never passed it, so a poll post could not be voted on.
  test('PostCard passes onVote and the viewer vote to PollCard', () => {
    const src = read('src/screens/PostCard.jsx');
    const m = src.match(/<PollCard\b[^>]*>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('onVote={handlePollVote}');
    expect(src).toContain('const handlePollVote = useCallback');
    expect(src).toContain('firestoreService.voteOnPoll');
    expect(src).toContain('getUserPollVote');
  });

  test('voteOnPoll is server-authoritative (delegates to the votePostPoll callable)', () => {
    const src = read('src/services/firestoreService.js');
    const body = src.slice(src.indexOf('async voteOnPoll'), src.indexOf('async recordPostView'));
    // The posts update rule lets any signed-in user write `poll`, so a client
    // transaction here would let a voter forge counts (no expiry check, no
    // one-vote dedupe). The mutation must go through the callable.
    expect(body).toContain('VOTE_POST_POLL');
    expect(body).not.toContain('runTransaction');
    expect(body).not.toContain("'poll.options'");
  });

  test('the votePostPoll callable is exported and merged', () => {
    const fn = read('functions/polls.js');
    expect(fn).toContain('exports.votePostPoll');
    expect(fn).toContain('already-exists');
    expect(fn).toMatch(/poll\.closesAt|closesAt/);
    const idx = read('functions/index.js');
    expect(idx).toContain("merge(require('./polls.js'))");
    const callable = read('src/services/callableService.js');
    expect(callable).toContain("VOTE_POST_POLL: 'votePostPoll'");
  });

  test('the composer persists poll closesAt + rewardCoins', () => {
    const src = read('src/screens/CreatePost.jsx');
    expect(src).toContain('SET_POLL_EXPIRY');
    expect(src).toContain('SET_POLL_REWARD');
    expect(src).toMatch(/poll:[\s\S]*?closesAt: current\.pollClosesAt/);
    expect(src).toMatch(/rewardCoins: Number\(current\.pollReward\)/);
  });
});

describe('post-embedded Q&A is wired end-to-end', () => {
  // QuestionCard is a fully-built UI with no backend: the composer published
  // `question` as a bare string while the card renders `question.text`, answers
  // lived in a client array nothing read, and no answer control had a handler.
  test('the composer publishes a question object with an answers array', () => {
    const src = read('src/screens/CreatePost.jsx');
    expect(src).toMatch(/question: effectiveType === "question" \? \{ text: effectiveText/);
    expect(src).toContain('answers: []');
  });

  test('createPost normalises the question shape for legacy string values', () => {
    const src = read('src/services/firestoreService.js');
    expect(src).toContain('_normaliseQuestion');
    expect(src).toContain('_normaliseQuestion(postData.question');
  });

  test('PostCard passes every QuestionCard handler and the viewer vote', () => {
    const src = read('src/screens/PostCard.jsx');
    const m = src.match(/<QuestionCard\b[^>]*>/);
    expect(m).not.toBeNull();
    for (const prop of ['onSubmitAnswer=', 'onVote=', 'onMarkBest=', 'onEditAnswer=', 'onDeleteAnswer=', 'onReport=']) {
      expect(m[0]).toContain(prop);
    }
    expect(src).toContain('const handleAddAnswer = useCallback');
    expect(src).toContain('const handleAnswerVote = useCallback');
    expect(src).toContain('const handleMarkBest = useCallback');
    expect(src).toContain('getMyAnswerVotes');
  });

  test('answer mutations are server-authoritative callables, never client writes', () => {
    const svc = read('src/services/firestoreService.js');
    for (const fn of ['addAnswer', 'editAnswer', 'deleteAnswer', 'voteAnswer', 'acceptAnswer']) {
      expect(svc).toContain(`async ${fn}(`);
    }
    // The answerer is not the post author, so a direct post write would be
    // denied by rules; every mutation must go through a callable.
    const body = svc.slice(svc.indexOf('async addAnswer('), svc.indexOf('async getMyAnswerVotes('));
    expect(body).toContain('FUNCTIONS.ADD_ANSWER');
    expect(body).toContain('FUNCTIONS.CAST_ANSWER_VOTE');
    expect(body).toContain('FUNCTIONS.ACCEPT_ANSWER');
    expect(body).not.toMatch(/updateDoc\(.*question\.answers/);
  });

  test('the answer callables are deployed and registered for the client', () => {
    const idx = read('functions/index.js');
    expect(idx).toContain("merge(require('./questions.js'))");
    const mod = read('functions/questions.js');
    for (const name of ['addAnswer', 'editAnswer', 'deleteAnswer', 'castAnswerVote', 'acceptAnswer']) {
      expect(mod).toContain(`exports.${name} =`);
    }
    const callables = read('src/services/callableService.js');
    expect(callables).toContain("ADD_ANSWER: 'addAnswer'");
    expect(callables).toContain("ACCEPT_ANSWER: 'acceptAnswer'");
  });

  test('answer_votes is server-write and self-read only', () => {
    const rules = read('firestore.rules');
    const m = rules.match(/match \/posts\/\{postId\}\/answer_votes\/\{voteId\} \{[\s\S]*?\n {4}\}/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('allow read: if isSignedIn() && resource.data.userId == uid()');
    expect(m[0]).toContain('allow write: if false');
  });
});

describe('comment reliability: moderation-visible states stay in the thread', () => {
  // The top-level comment query filtered `moderationStatus in ['approved','pending']`.
  // The async moderation trigger flips a comment from `pending` to
  // `pending_manual_review` (isHidden=false) as soon as Perspective scans it, so
  // a mildly-flagged comment vanished from the thread it was posted in.
  test('getCommentsByPost keeps pending_manual_review visible', () => {
    const src = read('src/services/commentService.js');
    expect(src).toContain('VISIBLE_COMMENT_MODERATION_STATUSES');
    expect(src).toContain("'pending_manual_review'");
    expect(src).not.toMatch(/moderationStatus', 'in', \['approved', 'pending'\]/);
    expect(src).toMatch(/where\('moderationStatus', 'in', VISIBLE_COMMENT_MODERATION_STATUSES\)/);
  });
});

describe('AudioCard playback state stays in sync', () => {
  // The `<audio>` `onPause` handler was a literal `() => {}` no-op, so a pause
  // that did not go through the card's own button (OS media controls, the
  // watchdog, page visibility) left `isPlaying` true and the UI stuck on Pause.
  test('onPause is wired to a real handler that syncs the store', () => {
    const src = read('src/screens/PostCard/AudioCard.jsx');
    expect(src).not.toContain('onPause={() => {}}');
    expect(src).toContain('onPause={handlePause}');
    expect(src).toContain('const handlePause = useCallback');
    expect(src).toContain('syncStateFromElement');
  });
});

describe('no dead props on first-party components', () => {
  test('the delegating connections screens do not pass a prop the target never reads', () => {
    // ConnectionsScreen resolves the viewer from the auth context itself; the
    // `currentUser` prop passed by the three delegating screens was dead (and a
    // store-mirror identity, the N002 regression risk).
    for (const rel of [
      'src/screens/Profile/FollowersScreen.jsx',
      'src/screens/Profile/FollowingScreen.jsx',
      'src/screens/Profile/FriendsScreen.jsx',
    ]) {
      expect(read(rel)).not.toContain('currentUser={');
    }
  });

  test('ThemeToggle no longer advertises an unimplemented size prop', () => {
    expect(read('src/components/Shared/ThemeToggle.jsx')).not.toContain('getNextTheme');
    expect(read('src/screens/IntroScreen.jsx')).not.toContain('size="lg"');
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
