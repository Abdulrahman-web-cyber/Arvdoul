import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const store = read('src/store/profileStore.js');
const ownerProfile = read('src/screens/Profile/ProfileMyScreen.jsx');

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

  test('profile story hydration requires an explicit matching author', () => {
    const start = store.indexOf('const userStories = rawList.filter');
    const end = store.indexOf('if (!get()._isLoadCurrent', start);
    const filter = store.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(filter).toMatch(/s\.userId === userId/);
    expect(filter).toMatch(/s\.authorId === userId/);
    expect(filter).toMatch(/s\.uid === userId/);
    expect(filter).not.toMatch(/!s\.userId|!s\.authorId|!s\.uid/);
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
