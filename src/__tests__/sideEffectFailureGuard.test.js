/**
 * Server-owned side effect must not be swallowed by a bare no-op catch (N147).
 *
 * A fire-and-forget mutation whose failure is user-visible — a server-owned
 * counter (views/shares), `markConversationAsRead`, story completion, an XP
 * grant, the active-day ledger, a notification, the profile-complete flag —
 * was fired as `service.recordX(...).catch(() => {})`. A failure then left the
 * count frozen, the badge stale or the recipient unnotified, with no trace.
 *
 * The rule: when a *known server-owned side effect* is followed by `.catch`,
 * the catch must do something (log / toast / set state / rethrow). Pure UI
 * cleanup (`URL.revokeObjectURL`, `element.play()`, `unsub()`) is out of scope
 * because the method names below are an explicit allowlist.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Server-owned side effects whose silent failure is a user-visible lie.
const SIDE_EFFECT =
  /\b(recordVideoView|sharePost|shareVideo|recordPostView|recordActiveDay|awardExperience|markConversationAsRead|reportStoryCompletion|reportStoryView|createLikeNotification|sendNotification|updateLastActive|updateUserProfile|_notifyPostAuthor|_notifyReply|_processMentions|_awardCommentXp|_afterGiftSent|_recordFollowerSnapshotIfDue|archiveStory|deleteCurrentUser|createHighlight)\s*\(/;

// A bare no-op catch: `.catch(() => {})` with nothing inside the body.
const NOOP_CATCH = /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/;

describe('server-owned side effects are not swallowed by a bare no-op catch', () => {
  test('no side-effect call is followed by a no-op catch', () => {
    const offenders = [];
    for (const file of collect(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      const re = new RegExp(NOOP_CATCH.source, 'g');
      while ((m = re.exec(src))) {
        // The receiver chain is the ~220 chars before the `.catch(`.
        const before = src.slice(Math.max(0, m.index - 220), m.index);
        if (SIDE_EFFECT.test(before)) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the previously-swallowed sites now log their failure', () => {
    const pins = [
      ['src/services/feedService.js', 'Ad prefetch failed'],
      ['src/services/authService.js', 'Server auth rate-limit check unreachable'],
      ['src/services/commentService.js', 'comment_created XP award failed'],
      ['src/services/liveService.js', 'live_minute XP award failed'],
      ['src/services/monetizationService.js', 'Gift follow-up (XP/notification) failed'],
      ['src/services/userService.js', 'recordActiveDay failed'],
      ['src/screens/ChatScreen.jsx', 'mark-as-read failed'],
      ['src/screens/ReelsScreen.jsx', 'view not recorded'],
      ['src/context/AuthContext.jsx', 'daily-login XP not credited'],
    ];
    const missing = pins.filter(([rel, needle]) => {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      return !src.includes(needle);
    });
    expect(missing).toEqual([]);
  });
});
