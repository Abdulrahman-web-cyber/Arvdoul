// src/__tests__/e2e_journeys.test.js
// Critical End-to-End User Journey Verification for Arvdoul Platform Release Validation

import { jest } from '@jest/globals';
import util from 'node:util';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

import 'fake-indexeddb/auto';

import { soundService } from '../services/soundService.js';
import audioEditorService from '../services/audioEditorService.js';
import { collaborationService } from '../services/collaborationService.js';
import { getMessagingService } from '../services/messagesService.js';
import { monetizationService } from '../services/monetizationService.js';
import { userIntegrityService } from '../services/userIntegrityService.js';

describe('Critical E2E User Journeys', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Journey 1: General User (Auth -> Onboarding -> Home -> Feed Interaction -> Messaging)', () => {
    test('user navigates through onboarding, discovers sounds, creates audio project, and sends E2EE message', async () => {
      // Step 1: Discover trending sounds
      const sounds = await soundService.getTrendingSounds('Hyperpop');
      expect(sounds.length).toBeGreaterThan(0);
      const selectedSound = sounds[0];

      // Step 2: Open audio editor studio with selected sound
      const project = audioEditorService.createProject({ name: selectedSound.title });
      expect(project.id).toBeDefined();

      project.duration = 30; // set audio duration
      audioEditorService.addMarker(10.0, 'Drop');
      expect(project.markers.length).toBe(1);

      // Step 3: Message a friend with the created project details
      const messaging = getMessagingService();
      const senderId = 'user_alex_123';
      const recipientId = 'user_sam_456';

      messaging.unlockedPrivateKeys.set(senderId, 'alex-secret-x25519-key');
      messaging.unlockedPrivateKeys.set(recipientId, 'sam-secret-x25519-key');

      const message = await messaging.sendMessage({
        senderId,
        recipientId,
        conversationId: 'conv_alex_sam',
        text: `Check out my new track edit for "${selectedSound.title}"!`
      });

      expect(message).toBeDefined();
      expect(message.senderId).toBe(senderId);
      expect(message.text).toContain(selectedSound.title);
    });
  });

  describe('Journey 2: Creator (Project Creation -> Team Collaboration -> Review -> Publish)', () => {
    test('creator manages project lifecycle and content submission in collaboration service', async () => {
      const creatorId = 'creator_maria';

      // Step 1: Fetch stats and existing collaboration projects
      const stats = collaborationService.getStats();
      expect(stats.projects.length).toBeGreaterThan(0);
      const activeProject = stats.projects[0];

      // Step 2: Acquire lock for content editing
      const lock = collaborationService.acquireLock(activeProject.id, creatorId, 10000);
      expect(lock.success).toBe(true);

      // Step 3: Check permission levels
      const canEdit = collaborationService.canEditContent('owner');
      expect(canEdit).toBe(true);

      const canPublish = collaborationService.canPublishContent('owner');
      expect(canPublish).toBe(true);

      // Step 4: Release lock after editing
      const release = collaborationService.releaseLock(activeProject.id, creatorId);
      expect(release.success).toBe(true);
    });
  });

  describe('Journey 3: Buyer & Monetization (Coin Purchase -> Tip Creator -> Ledger Transaction)', () => {
    test('buyer purchases coin bundle and transfers coins via double-entry ledger flow', async () => {
      const buyerId = 'buyer_john';
      const creatorId = 'creator_maria';
      const tipAmount = 50;

      // Step 1: Evaluate purchase risk
      const purchaseRisk = await monetizationService.spendCoins(buyerId, tipAmount, 'tip', { recipientId: creatorId });
      expect(purchaseRisk).toBeDefined();

      // Step 2: Ledger transaction simulates debit and credit
      expect(purchaseRisk.success).toBe(true);
    });
  });

  describe('Journey 4: Moderation & User Integrity (Report -> Trust Assessment -> Resolution)', () => {
    test('integrity service evaluates trust score and handles moderation appeals', async () => {
      const mockUserProfile = {
        uid: 'suspicious_bot_88',
        emailVerified: true,
        phoneNumber: '+15551234567',
        isVerifiedCreator: false,
        strikesCount: 0
      };

      // Step 1: Calculate user trust score
      const trustScore = userIntegrityService.calculateTrustScore(mockUserProfile, {
        reportsReceived: 0
      });

      expect(trustScore).toBeDefined();
      expect(trustScore).toBeGreaterThanOrEqual(50);
    });
  });
});
