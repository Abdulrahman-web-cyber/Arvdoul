import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const store = read('src/store/profileStore.js');
const ownerProfile = read('src/screens/Profile/ProfileMyScreen.jsx');
const publicProfile = read('src/screens/Profile/ProfilePublicScreen.jsx');
const userService = read('src/services/userService.js');
const connections = read('src/screens/Profile/ConnectionsScreen.jsx');
const preview = read('src/screens/Profile/ProfilePreviewScreen.jsx');

describe('profile cache and unknown-value isolation', () => {
  test('device-local optimistic posts never widen a visitor profile query', () => {
    const start = store.indexOf('const localUserPosts');
    const end = store.indexOf('if (localUserPosts.length > 0)', start);
    const merge = store.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(merge).toMatch(/viewerId === userId/);
    expect(merge).toMatch(/p\.authorId === userId/);
    expect(merge).toMatch(/p\.isDeleted !== true/);
    expect(merge).toMatch(/p\.status !== 'scheduled'/);
  });

  test('connections identity is sourced only from AuthContext and failed reads withhold lists', () => {
    expect(connections).toContain('const currentUser = authUser || null');
    expect(connections).toContain('const currentUserId = authUser?.uid || null');
    expect(connections).not.toContain('getStoredUid');
    expect(connections).not.toContain('storeUser');
    expect(connections).toContain('if (!profile)');
    expect(connections).toContain('setPermissionDenied(true)');
    expect(connections).toContain('setFollowers([])');
    expect(connections).toContain('setFriends([])');
  });

  test('public profile follow controls never trust denormalized profile flags', () => {
    expect(publicProfile).toContain('relationship?.isFollowing ?? storeFollowStatus?.isFollowing ?? false');
    expect(publicProfile).not.toContain('profileData?.isFollowing');
    expect(publicProfile).toContain('isMatchingTarget && currentUserId');
  });

  test('connection pagination fails closed and discards responses after a target switch', () => {
    expect(connections).not.toContain("console.warn('Follow-state hydration failed:', e?.message)");
    expect(connections).toContain('targetKeyRef.current !== requestedTargetId');
    expect(connections).toContain('if (!isMounted) return');
  });

  test('profile preview never renders a profile cached for a different authenticated UID', () => {
    expect(preview).toContain('const currentUserId = authUser?.uid || null');
    expect(preview).toContain('explicitProfileId === currentUserId');
    expect(preview).toContain('storeProfileId === currentUserId');
    expect(preview).not.toContain('getStoredUid');
    expect(preview).not.toContain('getStoredUser');
    expect(preview).not.toContain('storeUser');
  });

  test('profile story hydration requires an explicit matching author', () => {
    const start = store.indexOf('const userStories = rawList.filter');
    const end = store.indexOf('if (!get()._isLoadCurrent', start);
    const filter = store.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(filter).toMatch(/s\.userId === userId/);
    expect(filter).toMatch(/s\.authorId === userId/);
    expect(filter).toMatch(/s\.ownerId === userId/);
    expect(filter).toMatch(/s\.uid === userId/);
    expect(filter).not.toMatch(/!s\.userId|!s\.authorId|!s\.uid/);
  });

  test('visitor profile is withheld when relationship and block state cannot be verified', () => {
    expect(publicProfile).toContain('const [relationshipError, setRelationshipError] = useState(false)');
    expect(publicProfile).toContain("relSettled.status !== 'fulfilled' || !relSettled.value");
    expect(publicProfile).toContain('setRelationshipError(true)');
    expect(publicProfile).toContain('Profile Access Could Not Be Verified');
    expect(publicProfile).toContain('Its contents and actions are withheld until that check succeeds.');
    expect(publicProfile).not.toContain('userService.areFriends(currentUserId, resolvedUid)');
  });

  test('profile friend-request state uses participant-scoped point reads, not inbox scans', () => {
    const start = userService.indexOf('async getFriendRequestStatus(');
    const end = userService.indexOf('async getFriendRequests(', start);
    const method = userService.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(method).toContain('getDoc(sentRef)');
    expect(method).toContain('getDoc(receivedRef)');
    expect(publicProfile).toContain('userService.getFriendRequestStatus(currentUserId, resolvedUid)');
    expect(publicProfile).not.toContain("userService.getFriendRequests(currentUserId, 'sent')");
    expect(publicProfile).not.toContain("userService.getFriendRequests(currentUserId, 'received')");
    expect(publicProfile).toContain('setRelationshipError(true)');
  });

  test('unknown wallet balance is not initialized as a measured zero', () => {
    expect(store).toMatch(/balance: null,/);
    expect(store).toMatch(/typeof balanceData === 'number' \? balanceData : null/);
  });

  test('unknown XP and coin balance remain unavailable until numeric data exists', () => {
    expect(ownerProfile).toContain('withCoins: false');
    expect(ownerProfile).toMatch(/value !== null && value !== undefined && value !== '' && Number\.isFinite\(Number\(value\)\)/);
    expect(ownerProfile).toContain('coins: resolvedCoins');
    expect(ownerProfile).toContain('resolvedExperience !== undefined');
  });
});
