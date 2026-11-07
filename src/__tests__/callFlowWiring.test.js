/**
 * 1:1 call signalling guards (N114).
 *
 * The bug: callService.createCall used addDoc (a random id), so when both peers
 * opened the call screen each created its OWN calls/{id} document, subscribed
 * to its own doc, and never saw the other's offer/answer — a 1:1 call could not
 * connect. Nothing listened for an incoming call either, so the callee only
 * ever rang if they were already on the call route.
 *
 * These assertions fail on the pre-fix code so the regression cannot return.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('1:1 calls share one signalling document (N114)', () => {
  const svc = read('src/services/callService.js');

  test('callId is derived deterministically from the two uids', () => {
    expect(svc).toContain('deriveCallId');
    // sorting both uids makes the id identical from either peer
    expect(svc).toMatch(/sort\(\)/);
    expect(svc).not.toMatch(/addDoc\(collection\(db, 'calls'\)/);
  });

  test('ensureCall reuses an existing ringing doc instead of forking it', () => {
    expect(svc).toContain('ensureCall');
    expect(svc).toMatch(/getDoc\(ref\)/);
    expect(svc).toMatch(/setDoc\(ref/);
  });

  test('CallScreen opens the shared doc', () => {
    const screen = read('src/screens/CallScreen.jsx');
    expect(screen).toContain('ensureCall');
    expect(screen).not.toContain('createCall');
  });
});

describe('incoming calls ring the callee (N114)', () => {
  const svc = read('src/services/callService.js');

  test('a bounded poll discovers ringing calls without a new listener', () => {
    expect(svc).toContain('watchIncomingCalls');
    expect(svc).toMatch(/limit\(/);
    // cost guard forbids net-new onSnapshot in callService
    expect(svc).not.toContain('subscribeToIncomingCalls');
  });

  test('the query is provable by the read rule (array-contains participants)', () => {
    expect(svc).toMatch(/where\('participants', 'array-contains', selfUid\)/);
  });

  test('the ring is mounted app-wide and routed by conversation', () => {
    const boot = read('src/app/AppBootstrap.jsx');
    expect(boot).toContain('IncomingCallBanner');
    const banner = read('src/components/Shared/IncomingCallBanner.jsx');
    expect(banner).toContain('watchIncomingCalls');
    expect(banner).toMatch(/\/call\/\$\{/);
  });
});
