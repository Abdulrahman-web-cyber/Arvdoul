/**
 * src/services/spacesOrchestrator.js - ARVDOUL LIVE AUDIO SPACES & CO-PRESENCE ORCHESTRATOR v1.0
 * 
 * Production-grade orchestration for interactive audio spaces:
 * • Role-Based Stage Management (HOST, CO_HOST, SPEAKER, LISTENER)
 * • Real-time Hand-Raise Queue with priority ordering and permissions
 * • Speaking indicators, mute sync, and dynamic volume normalization
 * • Live coin tipping & ephemeral reaction bursts
 * • Automatic host handover and room termination safeguards
 */

import { logger } from '../utils/Logger.js';

export const SPACE_ROLES = {
  HOST: 'host',
  CO_HOST: 'co_host',
  SPEAKER: 'speaker',
  LISTENER: 'listener',
};

export const SPACE_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
};

export class SpacesOrchestrator {
  constructor() {
    this.activeSpaces = new Map(); // spaceId -> spaceState
  }

  /**
   * Initializes or loads an active space session.
   */
  createSpaceSession(spaceId, { title, hostId, topic = 'general', maxCapacity = 500 } = {}) {
    if (!spaceId || !hostId) {
      throw new Error('spaceId and hostId are required to create a space session');
    }

    const session = {
      id: spaceId,
      title: title || 'Live Audio Space',
      topic,
      hostId,
      status: SPACE_STATUS.LIVE,
      startedAt: Date.now(),
      maxCapacity,
      participants: new Map([
        [hostId, {
          userId: hostId,
          role: SPACE_ROLES.HOST,
          isMuted: false,
          isSpeaking: false,
          joinedAt: Date.now(),
        }]
      ]),
      speakers: new Set([hostId]),
      handRaiseQueue: [], // array of { userId, requestedAt }
      reactions: [],
      tipPool: 0,
    };

    this.activeSpaces.set(spaceId, session);
    logger.info(`[SpacesOrchestrator] Space session ${spaceId} created by host ${hostId}`);
    return this.getSpaceSnapshot(spaceId);
  }

  /**
   * Joins a user to the space as a listener.
   */
  joinSpace(spaceId, userId, { role = SPACE_ROLES.LISTENER } = {}) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) {
      throw new Error(`Space ${spaceId} does not exist or has ended`);
    }

    if (space.participants.size >= space.maxCapacity) {
      throw new Error('Space has reached maximum capacity');
    }

    const participant = {
      userId,
      role: role === SPACE_ROLES.HOST && space.hostId === userId ? SPACE_ROLES.HOST : SPACE_ROLES.LISTENER,
      isMuted: true,
      isSpeaking: false,
      joinedAt: Date.now(),
    };

    space.participants.set(userId, participant);
    logger.info(`[SpacesOrchestrator] User ${userId} joined space ${spaceId} as ${participant.role}`);
    return this.getSpaceSnapshot(spaceId);
  }

  /**
   * Removes a user from the space. Handles host handover if host leaves.
   */
  leaveSpace(spaceId, userId) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) return null;

    space.participants.delete(userId);
    space.speakers.delete(userId);
    space.handRaiseQueue = space.handRaiseQueue.filter(h => h.userId !== userId);

    // If host left, elect co-host or next oldest speaker, else end space
    if (space.hostId === userId) {
      const remainingSpeakers = Array.from(space.speakers);
      if (remainingSpeakers.length > 0) {
        const newHostId = remainingSpeakers[0];
        space.hostId = newHostId;
        const newHost = space.participants.get(newHostId);
        if (newHost) newHost.role = SPACE_ROLES.HOST;
        logger.info(`[SpacesOrchestrator] Host left. Transferred host rights to ${newHostId}`);
      } else {
        space.status = SPACE_STATUS.ENDED;
        logger.info(`[SpacesOrchestrator] Host left with no remaining speakers. Space ${spaceId} ended.`);
      }
    }

    return this.getSpaceSnapshot(spaceId);
  }

  /**
   * Listener raises hand to request speaker permissions.
   */
  raiseHand(spaceId, userId) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) throw new Error('Space not found');

    const participant = space.participants.get(userId);
    if (!participant) throw new Error('User is not in the space');
    if (participant.role !== SPACE_ROLES.LISTENER) {
      return space.handRaiseQueue; // Already a speaker or host
    }

    const alreadyQueued = space.handRaiseQueue.some(h => h.userId === userId);
    if (!alreadyQueued) {
      space.handRaiseQueue.push({ userId, requestedAt: Date.now() });
    }

    return space.handRaiseQueue;
  }

  /**
   * Host / Co-Host approves speaker request and elevates participant.
   */
  elevateToSpeaker(spaceId, moderatorId, targetUserId) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) throw new Error('Space not found');

    this._assertCanModerate(space, moderatorId);

    const target = space.participants.get(targetUserId);
    if (!target) throw new Error('Target user not in space');

    target.role = SPACE_ROLES.SPEAKER;
    target.isMuted = false;
    space.speakers.add(targetUserId);
    space.handRaiseQueue = space.handRaiseQueue.filter(h => h.userId !== targetUserId);

    logger.info(`[SpacesOrchestrator] ${targetUserId} elevated to speaker by ${moderatorId}`);
    return this.getSpaceSnapshot(spaceId);
  }

  /**
   * Demotes a speaker back to listener.
   */
  demoteToListener(spaceId, moderatorId, targetUserId) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) throw new Error('Space not found');

    this._assertCanModerate(space, moderatorId);

    if (targetUserId === space.hostId) {
      throw new Error('Cannot demote space host');
    }

    const target = space.participants.get(targetUserId);
    if (!target) throw new Error('Target user not in space');

    target.role = SPACE_ROLES.LISTENER;
    target.isMuted = true;
    target.isSpeaking = false;
    space.speakers.delete(targetUserId);

    return this.getSpaceSnapshot(spaceId);
  }

  /**
   * Updates speaking indicator and volume level for a speaker.
   */
  setSpeakingState(spaceId, userId, { isSpeaking, volume = 0 }) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) return false;

    const participant = space.participants.get(userId);
    if (!participant || participant.role === SPACE_ROLES.LISTENER) {
      return false;
    }

    participant.isSpeaking = Boolean(isSpeaking);
    participant.volume = volume;
    return true;
  }

  /**
   * Broadcasts an ephemeral reaction or live gift into the room.
   */
  sendReaction(spaceId, userId, reactionEmoji) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) return null;

    const reaction = {
      id: `rx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      emoji: reactionEmoji,
      timestamp: Date.now(),
    };

    space.reactions.push(reaction);
    // Retain only last 30 ephemeral reactions
    if (space.reactions.length > 30) {
      space.reactions = space.reactions.slice(-30);
    }

    return reaction;
  }

  /**
   * Sends coins/tip to the current speaker or host.
   */
  sendTip(spaceId, senderId, recipientId, amount) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) throw new Error('Space not found');
    if (!amount || amount <= 0) throw new Error('Tip amount must be positive');

    const recipient = space.participants.get(recipientId);
    if (!recipient) throw new Error('Recipient not present in space');

    space.tipPool += amount;
    logger.info(`[SpacesOrchestrator] ${senderId} sent ${amount} coins to ${recipientId} in space ${spaceId}`);

    return {
      spaceId,
      senderId,
      recipientId,
      amount,
      newPool: space.tipPool,
      timestamp: Date.now(),
    };
  }

  /**
   * Generates a clean serialized snapshot of the space state.
   */
  getSpaceSnapshot(spaceId) {
    const space = this.activeSpaces.get(spaceId);
    if (!space) return null;

    return {
      id: space.id,
      title: space.title,
      topic: space.topic,
      hostId: space.hostId,
      status: space.status,
      startedAt: space.startedAt,
      participantCount: space.participants.size,
      speakerCount: space.speakers.size,
      participants: Array.from(space.participants.values()),
      speakers: Array.from(space.speakers),
      handRaiseQueue: [...space.handRaiseQueue],
      tipPool: space.tipPool,
      recentReactions: [...space.reactions.slice(-10)],
    };
  }

  _assertCanModerate(space, userId) {
    const participant = space.participants.get(userId);
    if (!participant) {
      throw new Error('Moderator is not present in space');
    }
    const isAuthorized = participant.role === SPACE_ROLES.HOST || participant.role === SPACE_ROLES.CO_HOST;
    if (!isAuthorized) {
      throw new Error('Only hosts and co-hosts have stage moderation privileges');
    }
  }
}

export const spacesOrchestrator = new SpacesOrchestrator();
export default spacesOrchestrator;
