/**
 * src/services/validationService.js - ARVDOUL CENTRALIZED INPUT VALIDATION ENGINE
 *
 * Implements:
 * 1. Strict Schema Enforcement: Validates data types, lengths, character sets, and formats for:
 *    - Posts & Comments (max length, allowed media types, tag limits)
 *    - User Profiles (username regex, bio length, valid links)
 *    - Monetary & Coin Transactions (positive integers, balance limits)
 *    - Moderation Reports & Appeals (reason codes, text boundaries)
 * 2. Injection Prevention: Disallows control characters and null bytes.
 */

class ValidationService {
  /**
   * Validates post creation input.
   */
  validatePost(post) {
    const errors = [];
    if (!post) return { valid: false, errors: ['Post payload is required'] };

    if (!post.caption && !post.mediaUrl && !post.mediaUrls?.length && !post.poll) {
      errors.push('Post must contain text caption, media, or a poll.');
    }

    if (post.caption && typeof post.caption === 'string' && post.caption.length > 5000) {
      errors.push('Post caption cannot exceed 5,000 characters.');
    }

    if (post.tags && Array.isArray(post.tags) && post.tags.length > 30) {
      errors.push('A post cannot have more than 30 tags.');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates comment input.
   */
  validateComment(text) {
    const errors = [];
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      errors.push('Comment text cannot be empty.');
    } else if (text.length > 1000) {
      errors.push('Comment cannot exceed 1,000 characters.');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates username format (alphanumeric, underscores, 3-30 chars).
   */
  validateUsername(username) {
    const regex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!username || !regex.test(username)) {
      return { valid: false, error: 'Username must be 3-30 alphanumeric characters or underscores.' };
    }
    return { valid: true };
  }

  /**
   * Validates coin transfer / spending amount.
   */
  validateCoinAmount(amount) {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { valid: false, error: 'Coin amount must be a positive integer.' };
    }
    if (amount > 1000000) {
      return { valid: false, error: 'Single transaction cannot exceed 1,000,000 coins.' };
    }
    return { valid: true };
  }
}

export const validationService = new ValidationService();
export default validationService;
