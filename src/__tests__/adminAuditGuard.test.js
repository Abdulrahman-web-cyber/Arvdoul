/**
 * Admin mutations must be audited (AGENTS.md — "Admin mutations are
 * server-authoritative").
 *
 * Any callable that gates on an admin check (`assertAdmin`/`checkIsAdmin`) and
 * changes state (a Firestore write) must record the action: either through
 * `functions/admin.js#writeAudit` (the canonical `moderation_logs` trail) or by
 * writing `moderation_logs` directly. A privileged write with no audit record
 * is an unattributable action.
 *
 * Read-only admin callables (lists, summaries, probes, queues) are exempt —
 * they change nothing.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS_DIR = path.join(root, 'functions');

const ADMIN_CHECK = /assertAdmin\(|checkIsAdmin\(/;
const AUDIT = /writeAudit\(|moderation_logs/;
const WRITE = /\.(set|update|delete|add)\(|batch\(\)|\.commit\(/;

/** Extract the balanced-parens argument list of the callable handler. */
function handlerBody(source, openParenIndex) {
  let depth = 0;
  let i = openParenIndex;
  for (; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(openParenIndex, i + 1);
}

function adminCallablesWithoutAudit() {
  const offenders = [];
  for (const file of fs.readdirSync(FUNCTIONS_DIR)) {
    if (!file.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(FUNCTIONS_DIR, file), 'utf8');
    const re = /exports\.([A-Za-z0-9_]+)\s*=\s*(?:functions\.https\.|[\s\S]{0,80}?)?(?:onCall|onRequest)\(/g;
    let m;
    while ((m = re.exec(source))) {
      const open = m.index + m[0].length - 1;
      const body = handlerBody(source, open);
      if (!ADMIN_CHECK.test(body)) continue;
      if (!WRITE.test(body)) continue; // read-only admin callable
      if (AUDIT.test(body)) continue;
      offenders.push(`${file}: ${m[1]}`);
    }
  }
  return offenders.sort();
}

describe('Admin mutations are audited', () => {
  test('no admin-gated callable writes state without an audit record', () => {
    expect(adminCallablesWithoutAudit()).toEqual([]);
  });

  test('the guard detects a synthetic offender (self-check)', () => {
    const fake = `
      exports.doThing = functions.https.onCall(async (data, context) => {
        await assertAdmin(context);
        await db.collection('x').doc('y').update({ z: 1 });
        return { success: true };
      });`;
    const re = /exports\.([A-Za-z0-9_]+)\s*=\s*(?:functions\.https\.|[\s\S]{0,80}?)?(?:onCall|onRequest)\(/g;
    const m = re.exec(fake);
    const body = handlerBody(fake, m.index + m[0].length - 1);
    expect(ADMIN_CHECK.test(body) && WRITE.test(body) && !AUDIT.test(body)).toBe(true);
  });
});
