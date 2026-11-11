/**
 * Direct-message permission wiring.
 *
 * The Settings screen writes `users/{uid}.settings.privacy.allowDMs` and
 * `firestore.rules` `dmAllowedTo()` enforces exactly that field. Two consumers
 * had drifted: the client `messagesService.getUserPrivacySettings` read
 * `user_settings/{uid}.messagePermission` (never written) and the scheduled-message
 * push path in `functions/messaging.js` read the same phantom field. Both now
 * resolve the canonical `allowDMs` and map the legacy vocabulary.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('DM permission wiring', () => {
  test('firestore.rules enforces users/{uid}.settings.privacy.allowDMs', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain('dmAllowedTo');
    expect(rules).toMatch(/settings', \{\}\)\.get\('privacy', \{\}\)\.get\('allowDMs'/);
  });

  test('the client reads allowDMs from the same document the rules enforce', () => {
    const src = read('src/services/messagesService.js');
    expect(src).toMatch(/'users', userId/);
    expect(src).toContain('privacy.allowDMs');
    expect(src).toContain('permissionMap');
  });

  test('the scheduled-message push gate reads allowDMs, not a phantom field', () => {
    const src = read('functions/messaging.js');
    expect(src).toContain("collection('users').doc(recipientId)");
    expect(src).toContain('allowDMs');
    // No code path reads the phantom field (the only remaining mention is a
    // comment describing what was removed).
    expect(src).not.toMatch(/data\(\)\.messagePermission/);
  });

  test('a DECLINED message request no longer authorises the conversation (N204)', () => {
    // `dmRequestFrom` once checked only `exists()`. Nothing ever deletes a
    // `message_requests` doc, so a request the recipient declined still granted
    // the sender permission to open the DM — the decline was not enforced.
    const rules = read('firestore.rules');
    const helper = rules.slice(rules.indexOf('function dmRequestFrom'));
    expect(helper).toMatch(/function dmRequestFrom\(senderUid, recipientUid\) \{[\s\S]*?status == 'pending'[\s\S]*?\}/);
  });
});
