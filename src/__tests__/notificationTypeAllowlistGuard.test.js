/**
 * `sendNotification` is a client-callable that writes an in-app notification +
 * a push into the recipient's inbox. Before this guard it accepted ANY
 * `notificationData.type`, so a signed-in caller could mint a
 * `security_alert` / `system_alert` / `payment_received` / `withdrawal_approved`
 * / `verification` / `level_up` / `coins_earned` notification — a trusted-
 * looking system or financial record the recipient cannot tell from a real one
 * (the "no fabricated security/standing claims" rule, applied to the inbox).
 *
 * The callable now validates `type` against two allowlists: a client may raise
 * social types toward *other* users, and only the self-only types toward
 * itself. This test pins both directions:
 *   - every type a `src` service actually sends must be allowed;
 *   - no trusted system/financial type may be client-sendable.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const notifications = read('functions/notifications.js');

function parseSet(name) {
  const m = notifications.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`${name} not found in functions/notifications.js`);
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

const socialTypes = parseSet('CLIENT_SOCIAL_NOTIFICATION_TYPES');
const selfTypes = parseSet('CLIENT_SELF_NOTIFICATION_TYPES');
const allowed = new Set([...socialTypes, ...selfTypes]);

/** Types that only a trusted server function may write. */
const SERVER_ONLY_TYPES = [
  'security_alert',
  'system_alert',
  'maintenance',
  'policy_update',
  'verification',
  'payment_received',
  'withdrawal_approved',
  'coins_earned',
  'coin_reward',
  'creator_payout',
  'level_up',
  'achievement_unlocked',
  'badge_earned',
  'gift_received',
  'subscription_renewal',
  'royalty_promotion',
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walk(p));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Extract the `type:` literal of every `sendNotification({...})` call in src. */
function clientSentTypes() {
  const found = new Map();
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /sendNotification\s*\(\s*\{/g;
    let m;
    while ((m = re.exec(src))) {
      const block = src.slice(m.index, m.index + 600);
      const t = block.match(
        /type:\s*(?:NOTIFICATIONS_CONFIG\.TYPES\.(\w+)|notificationsService\.TYPES\.(\w+)|'([^']+)'|"([^"]+)")/
      );
      if (t) {
        const raw = t[1] || t[2] || t[3] || t[4];
        // A `TYPES.X` reference is resolved through the TYPES map below.
        const value = t[1] || t[2] ? t[1] || t[2] : raw;
        found.set(value, path.relative(root, file));
      }
    }
  }
  return found;
}

/** Resolve `TYPES.FOO` names to their string values via the TYPES map. */
function resolveType(name) {
  if (/^[a-z_]+$/.test(name)) return name;
  const m = read('src/services/notificationsService.js').match(
    new RegExp(`\\b${name}:\\s*'([^']+)'`)
  );
  return m ? m[1] : name;
}

describe('client notification types are allowlisted (no fabricated system/financial notices)', () => {
  test('every type a src service sends is on the allowlist', () => {
    const unknown = [];
    for (const [name, file] of clientSentTypes()) {
      const type = resolveType(name);
      if (!allowed.has(type)) unknown.push(`${type} (${file})`);
    }
    expect(unknown).toEqual([]);
  });

  test('no trusted system/financial type is client-sendable', () => {
    for (const t of SERVER_ONLY_TYPES) {
      expect(allowed.has(t)).toBe(false);
    }
  });

  test('the callable validates the type before writing anything', () => {
    expect(notifications).toMatch(/CLIENT_SOCIAL_NOTIFICATION_TYPES\.has\(type\)/);
    expect(notifications).toMatch(/CLIENT_SELF_NOTIFICATION_TYPES\.has\(type\)/);
    expect(notifications).toMatch(/cannot be sent by a client/);
  });
});
