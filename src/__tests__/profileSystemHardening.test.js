/**
 * src/__tests__/profileSystemHardening.test.js - ARVDOUL Profile System Hardening Tests
 * 
 * Verifies profile contracts, validation rules, privacy visibility scopes,
 * XSS-preventing URL sanitization, server-authoritative field stripping,
 * and optimistic state updates in useProfileStore.
 */

import { jest } from '@jest/globals';
import {
  PROFILE_TYPES,
  VISIBILITY_SCOPES,
  DEFAULT_PROFILE_PRIVACY,
  SERVER_AUTHORITATIVE_FIELDS,
  PROFILE_CONSTRAINTS,
  isValidWebUrl,
  sanitizeProfileUrl,
  validateProfileUpdate,
  canViewProfileSection
} from '../config/profileContracts.js';
import { useProfileStore } from '../store/profileStore.js';

describe('Profile System Hardening & Validation Contracts', () => {
  describe('validateProfileUpdate', () => {
    test('strips server-authoritative fields like xp, level, and reputation', () => {
      const rawPayload = {
        displayName: 'Verified Creator',
        bio: 'Official bio',
        xp: 999999,
        level: 99,
        reputation: 1000,
        balance: 50000,
        activeStreak: 365,
      };

      const result = validateProfileUpdate(rawPayload);
      expect(result.valid).toBe(true);
      expect(result.sanitized.displayName).toBe('Verified Creator');
      expect(result.sanitized.bio).toBe('Official bio');
      expect(result.sanitized.xp).toBeUndefined();
      expect(result.sanitized.level).toBeUndefined();
      expect(result.sanitized.reputation).toBeUndefined();
      expect(result.sanitized.balance).toBeUndefined();
      expect(result.sanitized.activeStreak).toBeUndefined();
    });

    test('enforces bio maximum length constraints', () => {
      const longBio = 'a'.repeat(PROFILE_CONSTRAINTS.BIO.MAX_LENGTH + 50);
      const result = validateProfileUpdate({ bio: longBio });
      expect(result.valid).toBe(true);
      expect(result.sanitized.bio.length).toBe(PROFILE_CONSTRAINTS.BIO.MAX_LENGTH);
    });

    test('rejects display names that are too short or empty', () => {
      const result = validateProfileUpdate({ displayName: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validates and accepts valid profile types', () => {
      const result = validateProfileUpdate({ profileType: PROFILE_TYPES.CREATOR });
      expect(result.valid).toBe(true);
      expect(result.sanitized.profileType).toBe(PROFILE_TYPES.CREATOR);

      const invalidResult = validateProfileUpdate({ profileType: 'SUPER_ADMIN' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0]).toContain('Invalid profile type');
    });

    test('merges privacy settings with default fallbacks safely', () => {
      const result = validateProfileUpdate({
        privacy: {
          economicStatus: VISIBILITY_SCOPES.ONLY_ME,
          profileInfo: VISIBILITY_SCOPES.EVERYONE,
          presence: VISIBILITY_SCOPES.CONNECTIONS,
        }
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.privacy.economicStatus).toBe(VISIBILITY_SCOPES.ONLY_ME);
      expect(result.sanitized.privacy.profileInfo).toBe(VISIBILITY_SCOPES.EVERYONE);
      expect(result.sanitized.privacy.presence).toBe(VISIBILITY_SCOPES.CONNECTIONS);
      expect(result.sanitized.privacy.achievements).toBe(DEFAULT_PROFILE_PRIVACY.achievements);
    });

    test('normalizes legacy UI privacy aliases and lowercase scope values', () => {
      const result = validateProfileUpdate({
        privacy: {
          profileVisibility: 'connections',
          onlinePresence: 'private',
          followersVisibility: 'public',
          activityVisibility: 'followers',
        }
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.privacy.profileInfo).toBe(VISIBILITY_SCOPES.CONNECTIONS);
      expect(result.sanitized.privacy.presence).toBe(VISIBILITY_SCOPES.ONLY_ME);
      expect(result.sanitized.privacy.followersList).toBe(VISIBILITY_SCOPES.EVERYONE);
      expect(result.sanitized.privacy.activity).toBe(VISIBILITY_SCOPES.FOLLOWERS);
      expect(result.sanitized.privacy.achievements).toBe(VISIBILITY_SCOPES.FOLLOWERS);
    });
  });

  describe('URL Sanitization & Injection Defense', () => {
    test('sanitizes legitimate HTTP/HTTPS links', () => {
      expect(sanitizeProfileUrl('https://example.com')).toBe('https://example.com/');
      expect(sanitizeProfileUrl('http://mysite.org/page')).toBe('http://mysite.org/page');
      expect(sanitizeProfileUrl('arvdoul.com')).toBe('https://arvdoul.com/');
    });

    test('blocks javascript: and dangerous URI schemes', () => {
      expect(sanitizeProfileUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeProfileUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeProfileUrl('vbscript:msgbox(1)')).toBeNull();
      expect(isValidWebUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('canViewProfileSection Privacy Access Rules', () => {
    const privacy = {
      profileInfo: VISIBILITY_SCOPES.EVERYONE,
      activity: VISIBILITY_SCOPES.FOLLOWERS,
      economicStatus: VISIBILITY_SCOPES.ONLY_ME,
      collections: VISIBILITY_SCOPES.CONNECTIONS,
    };

    test('owner always has full access to every section', () => {
      expect(canViewProfileSection('profileInfo', privacy, 'OWNER')).toBe(true);
      expect(canViewProfileSection('economicStatus', privacy, 'OWNER')).toBe(true);
      expect(canViewProfileSection('activity', privacy, 'OWNER')).toBe(true);
      expect(canViewProfileSection('collections', privacy, 'OWNER')).toBe(true);
    });

    test('public viewers only see EVERYONE-scoped sections', () => {
      expect(canViewProfileSection('profileInfo', privacy, 'PUBLIC')).toBe(true);
      expect(canViewProfileSection('activity', privacy, 'PUBLIC')).toBe(false);
      expect(canViewProfileSection('economicStatus', privacy, 'PUBLIC')).toBe(false);
      expect(canViewProfileSection('collections', privacy, 'PUBLIC')).toBe(false);
    });

    test('followers can view FOLLOWERS and EVERYONE sections', () => {
      expect(canViewProfileSection('profileInfo', privacy, 'FOLLOWER')).toBe(true);
      expect(canViewProfileSection('activity', privacy, 'FOLLOWER')).toBe(true);
      expect(canViewProfileSection('collections', privacy, 'FOLLOWER')).toBe(false);
      expect(canViewProfileSection('economicStatus', privacy, 'FOLLOWER')).toBe(false);
    });

    test('mutual connections can view CONNECTIONS sections', () => {
      expect(canViewProfileSection('collections', privacy, 'CONNECTION')).toBe(true);
      expect(canViewProfileSection('activity', privacy, 'CONNECTION')).toBe(true);
      expect(canViewProfileSection('economicStatus', privacy, 'CONNECTION')).toBe(false);
    });
  });

  describe('useProfileStore State Machine', () => {
    beforeEach(() => {
      useProfileStore.getState().reset();
    });

    test('initializes with expected default state', () => {
      const state = useProfileStore.getState();
      expect(state.profile).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.isOwner).toBe(false);
      expect(state.activeTab).toBe('posts');
      expect(state.posts).toEqual([]);
      expect(state.balance).toBe(0);
    });

    test('setActiveTab updates tab properly', () => {
      useProfileStore.getState().setActiveTab('media');
      expect(useProfileStore.getState().activeTab).toBe('media');

      useProfileStore.getState().setActiveTab('about');
      expect(useProfileStore.getState().activeTab).toBe('about');
    });

    test('updateFollowStatus updates follower count and follow flag', () => {
      useProfileStore.setState({
        profile: { id: 'u2', followerCount: 10 },
        followStatus: { isFollowing: false },
      });

      useProfileStore.getState().updateFollowStatus('u1', 'u2', true);
      let state = useProfileStore.getState();
      expect(state.followStatus.isFollowing).toBe(true);
      expect(state.profile.followerCount).toBe(11);

      useProfileStore.getState().updateFollowStatus('u1', 'u2', false);
      state = useProfileStore.getState();
      expect(state.followStatus.isFollowing).toBe(false);
      expect(state.profile.followerCount).toBe(10);
    });

    test('clear resets state to initial defaults', () => {
      useProfileStore.setState({
        profile: { id: 'u1', username: 'alex' },
        activeTab: 'highlights',
        balance: 100,
      });

      useProfileStore.getState().clear();
      const state = useProfileStore.getState();
      expect(state.profile).toBeNull();
      expect(state.activeTab).toBe('posts');
      expect(state.balance).toBe(0);
    });
  });
});
