/**
 * Video comment counts must have a real writer (N435).
 *
 * `videos/{id}.stats.comments` is seeded `0` and was never written. The video
 * comment UI (`VideoComments`) submits comments with the *video id* as the
 * target, so `commentService.createComment` incremented a sharded
 * `posts/{videoId}` counter — a document that does not exist for a video, read
 * by nobody — and `videos/{id}.stats.comments` stayed a fabricated `0`. That
 * zero then fed `updateVideoRankingScores` (the comments term of the video
 * ranking score) and the video card's comment count.
 *
 * The fix: a video comment no longer increments the phantom post counter
 * (`targetType: 'video'` is passed through), and a new scheduled
 * `functions/video.js#aggregateVideoComments` derives `stats.comments` from the
 * `comments` collection (bounded `.count()`, no scan), mirroring the
 * `aggregateVideoViews`/`aggregateVideoLikes` model.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const videoSrc = read('functions/video.js');
const commentServiceSrc = read('src/services/commentService.js');
const videoCommentsSrc = read('src/components/Videos/VideoComments.jsx');

describe('video comment counter has a real writer (N435)', () => {
  test('a scheduled mirror derives videos.stats.comments from the comments collection', () => {
    expect(videoSrc).toMatch(/exports\.aggregateVideoComments = pubsub\.schedule\(/);
    const block = videoSrc.slice(
      videoSrc.indexOf('exports.aggregateVideoComments'),
      videoSrc.indexOf('exports.updateVideoRankingScores'),
    );
    // Bounded aggregate over the real collection, keyed by the video id.
    expect(block).toMatch(/collection\('comments'\)/);
    expect(block).toMatch(/where\('postId', '==', doc\.id\)/);
    expect(block).toMatch(/\.count\(\)\s*\n\s*\.get\(\)/);
    // Writes the field the video readers/ranking consume.
    expect(block).toMatch(/'stats\.comments': totalComments/);
    // Only writes on change (no index churn / no needless write).
    expect(block).toMatch(/if \(stored !== totalComments\)/);
  });

  test('the video ranking score reads the now-maintained stats.comments field', () => {
    expect(videoSrc).toMatch(/const comments = stats\.comments \|\| 0;/);
  });

  test('legacy un-migrated video comments do not increment a phantom posts/{videoId} counter, while canonical Sparks do', () => {
    // Only legacy un-migrated `videos/{id}` items (`legacy_video` / `video`)
    // skip the posts shard counter; canonical Sparks live on `posts/{postId}`
    // and maintain `posts/{postId}` comment shards directly.
    expect(commentServiceSrc).toMatch(/if \(options\.targetType !== 'legacy_video' && options\.targetType !== 'video'\) \{/);
    expect(commentServiceSrc).toMatch(/countersManager\.increment\(\{ docPath: `posts\/\$\{postId\}`, field: 'comments' \}\)/);
  });

  test('the video comment UI routes canonical Sparks to post targetType and legacy videos to legacy_video', () => {
    expect(videoCommentsSrc).toMatch(/const targetType = video\?\._sourceCollection === 'videos' && !video\?\.canonicalPostId\s*\?\s*'legacy_video'\s*:\s*'post'/);
    const calls = videoCommentsSrc.match(/createComment\(|replyToComment\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const targetTypePasses = videoCommentsSrc.match(/\btargetType\b/g) || [];
    expect(targetTypePasses.length).toBeGreaterThanOrEqual(calls.length + 1);
  });
});
