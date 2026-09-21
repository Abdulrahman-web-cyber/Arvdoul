// src/services/onboardingService.js

import { logger } from '../utils/Logger.js';
import localforage from 'localforage';

class OnboardingService {
  constructor() {
    this.AVAILABLE_TOPICS = [
      { id: 'tech', label: 'Tech & AI', icon: 'Cpu', related: ['ai', 'coding', 'gadgets'] },
      { id: 'music', label: 'Music & Beats', icon: 'Music', related: ['beats', 'dj', 'synth'] },
      { id: 'gaming', label: 'Gaming & Esports', icon: 'Gamepad2', related: ['fps', 'streaming', 'retro'] },
      { id: 'comedy', label: 'Comedy & Memes', icon: 'Smile', related: ['sarcastic', 'jokes', 'reels'] },
      { id: 'fashion', label: 'Fashion & Style', icon: 'Shirt', related: ['vintage', 'runway', 'design'] },
      { id: 'lifestyle', label: 'Fitness & Travel', icon: 'Compass', related: ['nature', 'gym', 'vlog'] },
      { id: 'crypto', label: 'Crypto & Web3', icon: 'Coins', related: ['btc', 'nft', 'defi'] },
      { id: 'art', label: 'Digital Art & VFX', icon: 'Palette', related: ['blender', '3d', 'midjourney'] },
    ];
  }

  getAvailableTopics() {
    return this.AVAILABLE_TOPICS;
  }

  /**
   * Retrieves the user's current onboarding step from persistent local storage.
   */
  async getOnboardingStep(userId) {
    try {
      const step = await localforage.getItem(`arvdoul_onboarding_step_${userId}`);
      return step || 1;
    } catch (_) {
      return 1;
    }
  }

  /**
   * Saves the user's current onboarding step to persistent local storage.
   */
  async setOnboardingStep(userId, step) {
    try {
      await localforage.setItem(`arvdoul_onboarding_step_${userId}`, step);
      logger.info(`[OnboardingService] Saved onboarding step ${step} for ${userId}.`);
    } catch (_) {}
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

      // Clear local onboarding progress
      await localforage.removeItem(`arvdoul_onboarding_step_${userId}`).catch(() => {});

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
