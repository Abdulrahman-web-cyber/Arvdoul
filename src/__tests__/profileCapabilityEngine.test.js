import { describe, it, expect } from '@jest/globals';
import { resolveCapabilities } from '../services/profileCapabilityEngine.js';

describe('profileCapabilityEngine (Digital Nation Identity Specification)', () => {
  const mockOwner = { uid: 'user-owner', username: 'alex', displayName: 'Alex' };
  const mockTarget = {
    id: 'user-target',
    uid: 'user-target',
    username: 'elena',
    displayName: 'Elena',
    isPrivate: false,
    allowsDirectMessages: true,
    allowsPublicFollow: true,
  };

  it('resolves full owner capabilities when viewer is the target', () => {
    const caps = resolveCapabilities({
      viewer: mockOwner,
      target: mockOwner,
      relationship: { isOwner: true }
    });

    expect(caps.isOwner).toBe(true);
    expect(caps.canEditProfile).toBe(true);
    expect(caps.canViewContent).toBe(true);
    expect(caps.canViewAnalytics).toBe(true);
    expect(caps.canFollow).toBe(false); // owner doesn't follow themselves
    expect(caps.canMessage).toBe(false);
  });

  it('enforces simulated perspective when owner views as public', () => {
    const caps = resolveCapabilities({
      viewer: mockOwner,
      target: mockOwner,
      relationship: { isOwner: true },
      viewAs: 'public'
    });

    expect(caps.isOwner).toBe(false);
    expect(caps.canEditProfile).toBe(false);
    expect(caps.canViewAnalytics).toBe(false);
    expect(caps.perspective).toBe('public');
  });

  it('hides private content from unauthorized public visitors', () => {
    const privateTarget = { ...mockTarget, isPrivate: true };
    const visitor = { uid: 'user-visitor' };

    const caps = resolveCapabilities({
      viewer: visitor,
      target: privateTarget,
      relationship: { isFollowing: false, isMutualFriend: false }
    });

    expect(caps.canViewProfile).toBe(true);
    expect(caps.canViewContent).toBe(false); // private content locked
    expect(caps.canFollow).toBe(true);
  });

  it('grants content access to followers of private accounts', () => {
    const privateTarget = { ...mockTarget, isPrivate: true };
    const follower = { uid: 'user-follower' };

    const caps = resolveCapabilities({
      viewer: follower,
      target: privateTarget,
      relationship: { isFollowing: true, isMutualFriend: false }
    });

    expect(caps.canViewContent).toBe(true);
  });

  it('strictly blocks all interaction when target is blocked by viewer', () => {
    const viewer = { uid: 'user-viewer' };

    const caps = resolveCapabilities({
      viewer,
      target: mockTarget,
      relationship: { isBlocked: true }
    });

    expect(caps.isBlocking).toBe(true);
    expect(caps.canFollow).toBe(false);
    expect(caps.canMessage).toBe(false);
    expect(caps.canCall).toBe(false);
    expect(caps.canTip).toBe(false);
  });

  it('strictly isolates viewer when viewer is blocked by target', () => {
    const viewer = { uid: 'user-viewer' };

    const caps = resolveCapabilities({
      viewer,
      target: mockTarget,
      relationship: { isBlockedBy: true }
    });

    expect(caps.isBlockedBy).toBe(true);
    expect(caps.canViewProfile).toBe(false);
    expect(caps.canViewContent).toBe(false);
    expect(caps.canFollow).toBe(false);
    expect(caps.canMessage).toBe(false);
  });
});
