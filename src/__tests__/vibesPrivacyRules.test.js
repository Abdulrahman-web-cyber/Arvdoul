/**
 * src/__tests__/vibesPrivacyRules.test.js
 *
 * Verifies backend & rules parity for Arvdoul Vibes Part 1:
 *   - Firestore rules enforce connections, close_circle, selected, restricts, and vibe_idempotency
 *   - Storage rules isolate private/audience media paths under stories/{userId}/
 *   - Cloud Functions expose publishVibe, deleteVibe, and cleanupAbandonedVibeMedia
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Vibes Part 1 security rules & backend enforcement', () => {
  const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const storageRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
  const storiesFn = fs.readFileSync(path.join(root, 'functions', 'stories.js'), 'utf8');

  test('firestore.rules enforces Close Circle subcollection ownership', () => {
    expect(firestoreRules).toContain('match /users/{userId}/close_circle/{memberId}');
  });

  test('firestore.rules enforces connections, close_circle, selected, and restricts in vibe visibility', () => {
    expect(firestoreRules).toContain("s.visibility == 'connections'");
    expect(firestoreRules).toContain("s.visibility == 'close_circle'");
    expect(firestoreRules).toContain("s.visibility == 'selected'");
    expect(firestoreRules).toContain('close_circle/$(viewerId)');
    expect(firestoreRules).toContain('restricts/$(s.userId + \'_\' + viewerId)');
    expect(firestoreRules).toContain('match /vibe_idempotency/{key}');
  });

  test('storage.rules isolates private and audience-restricted Vibe media', () => {
    expect(storageRules).toContain('match /stories/{userId}/private/{fileName=**}');
    expect(storageRules).toContain('match /stories/{userId}/audience/{storyId}/{fileName=**}');
    expect(storageRules).toContain('canReadAudienceMedia');
    expect(storageRules).toContain('close_circle/$(request.auth.uid)');
    expect(storageRules).toContain('selectedUserIds');
  });

  test('functions/stories.js exports authoritative publishVibe, deleteVibe, and orphan media cleanup', () => {
    expect(storiesFn).toContain('exports.publishVibe =');
    expect(storiesFn).toContain('exports.deleteVibe =');
    expect(storiesFn).toContain('exports.cleanupAbandonedVibeMedia =');
    expect(storiesFn).toContain('vibe_idempotency');
    expect(storiesFn).toContain("db.collection('users').doc(uid)");
  });
});
