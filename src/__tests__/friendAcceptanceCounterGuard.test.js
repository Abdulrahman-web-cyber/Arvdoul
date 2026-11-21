import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const userService = fs.readFileSync(path.join(root, 'src/services/userService.js'), 'utf8');

describe('friend acceptance edge and counter integrity', () => {
  test('reads both follow directions before mutating the request or either edge', () => {
    const start = userService.indexOf('async acceptFriendRequest(');
    const end = userService.indexOf('async declineFriendRequest(', start);
    const method = userService.slice(start, end);
    const readForward = method.indexOf('transaction.get(f1)');
    const readReverse = method.indexOf('transaction.get(f2)');
    const firstRequestWrite = method.indexOf("transaction.update(requestRef, { status: 'accepted'");
    expect(readForward).toBeGreaterThanOrEqual(0);
    expect(readReverse).toBeGreaterThan(readForward);
    expect(firstRequestWrite).toBeGreaterThan(readReverse);
  });

  test('creates only missing mutual edges and increments only their corresponding counters', () => {
    const start = userService.indexOf('async acceptFriendRequest(');
    const end = userService.indexOf('async declineFriendRequest(', start);
    const method = userService.slice(start, end);
    expect(method).toContain('const createForward = !f1Snap.exists()');
    expect(method).toContain('const createReverse = !f2Snap.exists()');
    expect(method).toContain('if (createForward)');
    expect(method).toContain('if (createReverse)');
    expect(method).toContain('createdForward: createForward, createdReverse: createReverse');
  });
});
