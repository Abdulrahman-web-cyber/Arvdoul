/**
 * src/__tests__/phase16LiveGamificationAndWatchParty.test.js
 * Verification test suite for Phase 16:
 * - Interactive Live Stream Gamification, Polls & Q&A
 * - Low-Latency Ephemeral Co-Browsing & Media Watch Parties
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  LiveInteractiveGamificationService,
} from '../services/liveInteractiveGamificationService.js';
import {
  WatchPartyService,
} from '../services/watchPartyService.js';

describe('Phase 16: Live Stream Gamification & Watch Parties', () => {
  describe('1. Live Stream Gamification, Polls & Goals (Feature 50)', () => {
    let liveService;

    beforeEach(() => {
      liveService = new LiveInteractiveGamificationService();
    });

    it('manages sub-second live micro-polls and calculates percentages accurately', () => {
      const poll = liveService.createLivePoll({
        sessionId: 'session_live_1',
        creatorId: 'host_creator',
        question: 'Which track should we premiere next?',
        options: ['Cyber Funk', 'Ambient Dream', 'Synth Wave'],
        durationSec: 120,
      });

      expect(poll.id).toBeDefined();
      expect(poll.options.length).toBe(3);

      // User 1 votes for opt_0
      liveService.voteInLivePoll('session_live_1', poll.id, 'user_1', 'opt_0');
      // User 2 votes for opt_0
      liveService.voteInLivePoll('session_live_1', poll.id, 'user_2', 'opt_0');
      // User 3 votes for opt_1
      const updated = liveService.voteInLivePoll('session_live_1', poll.id, 'user_3', 'opt_1');

      expect(updated.totalVotes).toBe(3);
      expect(updated.options[0].votes).toBe(2);
      expect(updated.options[0].percentage).toBeCloseTo(66.7, 1);
      expect(updated.options[1].votes).toBe(1);
      expect(updated.options[1].percentage).toBeCloseTo(33.3, 1);
      expect(updated.options[2].votes).toBe(0);
      expect(updated.options[2].percentage).toBe(0);
    });

    it('tracks collective stream goals and triggers milestone unlocking', () => {
      const goal = liveService.createStreamGoal({
        sessionId: 'session_live_1',
        title: 'Unlock Acoustic Guitar Encore',
        targetAmount: 500,
        metricType: 'COINS',
      });

      expect(goal.isUnlocked).toBe(false);

      // Add 250 coins (50%)
      const progress1 = liveService.contributeToGoal('session_live_1', goal.id, 250);
      expect(progress1.progressPercent).toBe(50);
      expect(progress1.isUnlocked).toBe(false);

      // Add 250 more coins (100% -> unlocks!)
      const progress2 = liveService.contributeToGoal('session_live_1', goal.id, 250);
      expect(progress2.progressPercent).toBe(100);
      expect(progress2.isUnlocked).toBe(true);
      expect(progress2.unlockedAt).toBeDefined();
    });

    it('manages upvotable Q&A queue with host moderation pins and answers', () => {
      const q = liveService.submitQuestion('session_live_1', 'fan_42', 'What gear do you use?', 'Alice');
      expect(q.upvotes).toBe(1);

      // Upvote from another user
      const upvoted = liveService.upvoteQuestion('session_live_1', q.id, 'fan_99');
      expect(upvoted.upvotes).toBe(2);

      // Host pins and answers question
      const moderated = liveService.moderateQuestion('session_live_1', q.id, {
        isPinned: true,
        isAnswered: true,
      });
      expect(moderated.isPinned).toBe(true);
      expect(moderated.isAnswered).toBe(true);
    });
  });

  describe('2. Synchronized Watch Parties & Co-Browsing (Feature 51)', () => {
    let watchService;

    beforeEach(() => {
      watchService = new WatchPartyService();
    });

    it('creates watch party room and handles participant lifecycle and host migration', () => {
      const room = watchService.createRoom({
        hostId: 'host_user',
        title: 'Premiere Watch Party',
        mediaUrl: 'https://cdn.arvdoul.io/videos/premiere.mp4',
      });

      expect(room.id).toBeDefined();
      expect(room.hostId).toBe('host_user');
      expect(room.participantsCount).toBe(1);

      // Join viewer
      watchService.joinRoom(room.id, 'viewer_bob');
      const updated = watchService.joinRoom(room.id, 'viewer_charlie');
      expect(updated.participantsCount).toBe(3);

      // Host leaves -> hostmigrates to next active participant
      watchService.leaveRoom(room.id, 'host_user');
      const currentRoom = watchService._getRoom(room.id);
      expect(currentRoom.hostId).toBe('viewer_bob');
    });

    it('enforces host playback authority and calculates interpolated position', async () => {
      const room = watchService.createRoom({
        hostId: 'host_user',
        title: 'Synced Screening',
        mediaUrl: 'https://cdn.arvdoul.io/videos/movie.mp4',
      });

      watchService.joinRoom(room.id, 'guest_user');

      // Unauthorized guest cannot modify playback
      expect(() => {
        watchService.updatePlayback(room.id, 'guest_user', { isPlaying: true });
      }).toThrow('Only the host or co-host');

      // Host starts playback at 10.0s
      watchService.updatePlayback(room.id, 'host_user', {
        isPlaying: true,
        positionSec: 10.0,
      });

      // Allow 50ms wall clock to elapse
      await new Promise(r => setTimeout(r, 60));

      const authPlayback = watchService.getAuthoritativePlayback(room.id);
      expect(authPlayback.isPlaying).toBe(true);
      expect(authPlayback.positionSec).toBeGreaterThan(10.0);
    });

    it('detects playback drift and commands resynchronization', () => {
      const room = watchService.createRoom({
        hostId: 'host_user',
        title: 'Live Concert Sync',
        mediaUrl: 'https://cdn.arvdoul.io/videos/concert.mp4',
      });

      watchService.updatePlayback(room.id, 'host_user', {
        isPlaying: false,
        positionSec: 60.0,
      });

      // Client is at 60.1s (drift 100ms <= 250ms tolerance -> no sync needed)
      const minorDrift = watchService.evaluateDrift(room.id, 60.1);
      expect(minorDrift.requiresSync).toBe(false);

      // Client is at 55.0s (drift 5s > 250ms -> requires sync!)
      const majorDrift = watchService.evaluateDrift(room.id, 55.0);
      expect(majorDrift.requiresSync).toBe(true);
      expect(majorDrift.authoritativePositionSec).toBe(60.0);
    });

    it('broadcasts ephemeral reactions and updates ping latency', () => {
      const room = watchService.createRoom({
        hostId: 'host_user',
        title: 'Festival Watch Party',
        mediaUrl: 'https://cdn.arvdoul.io/stream.m3u8',
      });

      const reaction = watchService.broadcastReaction(room.id, 'host_user', '🎉');
      expect(reaction.emoji).toBe('🎉');
      expect(reaction.id).toMatch(/^rx_/);

      const ping = watchService.reportPingLatency(room.id, 'host_user', 38);
      expect(ping.pingMs).toBe(38);
    });
  });
});
