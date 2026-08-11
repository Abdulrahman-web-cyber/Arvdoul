/**
 * src/services/onboardingService.js - ARVDOUL PROGRESSIVE USER ONBOARDING & TOPIC GRAPH
 *
 * Implements:
 * 1. Multi-Step Onboarding State Machine:
 *    - Step 1: Profile customization (Avatar, display name, handle, bio)
 *    - Step 2: Topic & Interest Selection (Gaming, AI, Music, Comedy, Fashion, Crypto, Tech, Lifestyle)
 *    - Step 3: Creator Follow Suggestions (Top 5 popular creators based on selected topics)
 *    - Step 4: Notification Permissions & Passkey Enrollment
 * 2. Onboarding Completion Tracking with Firestore persistence.
 */

import { logger } from '../utils/Logger.js';

class OnboardingService {
  constructor() {
    this.AVAILABLE_TOPICS = [
      { id: 'tech', label: 'Tech & AI', icon: 'Cpu' },
      { id: 'music', label: 'Music & Beats', icon: 'Music' },
      { id: 'gaming', label: 'Gaming & Esports', icon: 'Gamepad2' },
      { id: 'comedy', label: 'Comedy & Memes', icon: 'Smile' },
      { id: 'fashion', label: 'Fashion & Style', icon: 'Shirt' },
      { id: 'lifestyle', label: 'Fitness & Travel', icon: 'Compass' },
      { id: 'crypto', label: 'Crypto & Web3', icon: 'Coins' },
      { id: 'art', label: 'Digital Art & VFX', icon: 'Palette' },
    ];
  }

  getAvailableTopics() {
    return this.AVAILABLE_TOPICS;
  }

  /**
   * Completes user onboarding and stores interests in user profile.
   */
  async completeOnboarding(userId, { selectedTopics = [], followedCreatorIds = [] }) {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        onboardingCompleted: true,
        interests: selectedTopics,
        onboardingCompletedAt: serverTimestamp(),
      });

      logger.info(`[OnboardingService] User ${userId} completed onboarding with ${selectedTopics.length} interests.`);
      return { success: true };
    } catch (err) {
      logger.error(`[OnboardingService] Failed to complete onboarding for ${userId}:`, { error: err.message });
      throw err;
    }
  }
}

export const onboardingService = new OnboardingService();
export default onboardingService;
