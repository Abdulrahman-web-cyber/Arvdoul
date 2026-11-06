/**
 * XP award wiring.
 *
 * Every entry in XP_RULES must be reachable by a real action. Four rules
 * (ad_reward_claimed, civic_vote_cast, streak_milestone, live_minute) were dead
 * configuration: defined in the shared config and shown in the UI, but nothing
 * ever credited them.
 *
 * A second class of bug: `awardExperience` credited `context.auth.uid`
 * unconditionally, so `like_received`/`follow_received`/`gift_received` — whose
 * names say *received* — paid the actor instead of the recipient. These tests
 * pin both the triggers and the recipient resolution.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { XP_RULES } from '../shared/levelConfig.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('XP award wiring', () => {
  test('the server XP routine is a single shared helper', () => {
    const helper = read('functions/xpAward.js');
    expect(helper).toContain('async function awardXp');
    expect(helper).toContain('getLevelUpReward');
    // The callable delegates instead of duplicating the transaction.
    expect(read('functions/levelSystem.js')).toContain("require('./xpAward')");
  });

  const triggers = {
    ad_reward_claimed: ['functions/monetization.js'],
    civic_vote_cast: ['functions/polls.js'],
    daily_login: ['functions/levelSystem.js'],
    streak_milestone: ['functions/levelSystem.js'],
    live_minute: ['src/services/liveService.js'],
    story_created: ['src/services/storyService.js'],
    post_shared: ['src/services/firestoreService.js'],
    video_watched: ['functions/video.js'],
    gift_sent: ['functions/monetization.js'],
    gift_received: ['functions/monetization.js'],
    like_received: ['src/services/firestoreService.js'],
    follow_received: ['src/services/userService.js'],
  };

  test.each(Object.keys(triggers))('%s has a real trigger', (action) => {
    expect(XP_RULES[action]).toBeTruthy();
    const sources = triggers[action].map(read).join('\n');
    expect(sources).toContain(`'${action}'`);
  });

  test('every XP rule either has a trigger or is documented as event-driven', () => {
    const eventDriven = new Set(['post_created', 'comment_created']);
    // No server path publishes an audio track yet (the Audio Studio only renders
    // a local file), so audio_track_created is intentionally unwired. Remove it
    // from this set when a publish path lands.
    const notYetImplemented = new Set(['audio_track_created']);
    const wired = new Set([...Object.keys(triggers), ...eventDriven, ...notYetImplemented]);
    const unwired = Object.keys(XP_RULES).filter((a) => !wired.has(a));
    expect(unwired).toEqual([]);
  });
});

describe('XP recipient resolution (like/follow/gift are received, not self)', () => {
  const levelSystem = read('functions/levelSystem.js');

  test('the callable verifies the beneficiary instead of trusting the caller', () => {
    // The received-actions are resolved against the real edge, never paid to
    // context.auth.uid.
    expect(levelSystem).toContain("RECIPIENT_XP_ACTIONS = new Set(['like_received', 'follow_received', 'gift_received'])");
    expect(levelSystem).toContain('async function resolveRecipientXp');
    // like_received must check the like edge exists before crediting the author.
    expect(levelSystem).toContain('posts/${source}/likes/${actorUid}');
    // follow_received must check the follow edge exists before crediting.
    expect(levelSystem).toContain('follows/${follower}_${following}');
  });

  test('self-credit actions reject a foreign beneficiary', () => {
    expect(levelSystem).toContain('Cannot award "${action}" XP to another user');
  });

  test('the client forwards userId so a received action can be resolved', () => {
    const client = read('src/services/levelSystemService.js');
    expect(client).toContain('{ action, count, source, userId }');
  });

  test('gift_received is credited server-side from the gift transaction', () => {
    const monetization = read('functions/monetization.js');
    expect(monetization).toContain("awardXpSafe(result.receiverId, 'gift_received'");
    expect(monetization).toContain('receiverId: authorUid');
    // The client no longer awards gift_received (it could not prove a gift).
    const client = read('src/services/monetizationService.js');
    expect(client).not.toContain("action: 'gift_received'");
  });
});
