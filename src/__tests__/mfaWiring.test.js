/**
 * MFA wiring guard.
 *
 * The TOTP service (`enrollMFA` / `finalizeMFAEnrollment` / `verifyMFAAndSignIn`)
 * existed but nothing consumed it: `signInWithEmailPassword` formatted
 * `auth/multi-factor-auth-required` into a generic error, so an account that
 * enrolled a second factor could never complete sign-in, and there was no
 * enrollment UI at all. This guard pins the whole path so the lockout cannot
 * come back.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('MFA sign-in is not a lockout', () => {
  const auth = read('src/services/authService.js');

  test('signInWithEmailPassword surfaces the second-factor challenge', () => {
    expect(auth).toMatch(/error\.code === 'auth\/multi-factor-auth-required'/);
    expect(auth).toMatch(/requiresMFA:\s*true/);
    expect(auth).toMatch(/resolver:\s*error\.resolver/);
  });

  test('authService exposes enrollment + factor listing', () => {
    expect(auth).toMatch(/async enrollMFA\(/);
    expect(auth).toMatch(/async finalizeMFAEnrollment\(/);
    expect(auth).toMatch(/async getEnrolledMFAFactors\(/);
    expect(auth).toMatch(/async verifyMFAAndSignIn\(/);
  });
});

describe('MFA challenge is reachable from the UI', () => {
  const ctx = read('src/context/AuthContext.jsx');

  test('AuthContext passes requiresMFA through and exposes verifyMFAAndSignIn', () => {
    expect(ctx).toMatch(/result\?\.requiresMFA/);
    expect(ctx).toMatch(/const verifyMFAAndSignIn = useCallback/);
    expect(ctx).toMatch(/^\s*verifyMFAAndSignIn,\s*$/m);
  });

  const login = read('src/screens/LoginScreen.jsx');

  test('LoginScreen renders a code step and verifies it', () => {
    expect(login).toMatch(/verifyMFAAndSignIn/);
    expect(login).toMatch(/if \(result\?\.requiresMFA\)/);
    expect(login).toMatch(/const handleVerifyMFA = async/);
    expect(login).toMatch(/autoComplete="one-time-code"/);
  });

  const settings = read('src/screens/SettingsScreen.jsx');

  test('SettingsScreen can enroll and disable a second factor', () => {
    expect(settings).toMatch(/getEnrolledMFAFactors\(\)/);
    expect(settings).toMatch(/\.enrollMFA\(\)/);
    expect(settings).toMatch(/\.finalizeMFAEnrollment\(/);
    expect(settings).toMatch(/\.disableMFA\(/);
  });
});
