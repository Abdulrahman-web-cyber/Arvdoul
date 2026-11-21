/**
 * Google OAuth regression guards.
 *
 * Mobile/embedded browsers frequently block popup flows even when the user
 * initiated sign-in. The app must use a full-page redirect on mobile and must
 * never hide a redirect failure behind the original popup error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const auth = fs.readFileSync(path.join(root, 'src/services/authService.js'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/screens/LoginScreen.jsx'), 'utf8');

describe('Google OAuth browser flow', () => {
  const methodStart = auth.indexOf('async signInWithGoogle(');
  const methodEnd = auth.indexOf('async createRecaptchaVerifier', methodStart);
  const method = auth.slice(methodStart, methodEnd);

  test('mobile browsers use redirect instead of a popup', () => {
    expect(method).toMatch(/prefersRedirect = \/Android|iPhone|iPad|iPod|Mobile\//);
    expect(method.indexOf('signInWithRedirect')).toBeLessThan(method.indexOf('signInWithPopup'));
    expect(method).not.toMatch(/await setPersistence\(/);
  });

  test('popup fallback reports the actual redirect failure', () => {
    const fallback = method.slice(method.indexOf('if (popupError.code === \'auth/popup-blocked\')'));
    expect(fallback).toContain('throw redirectError');
    expect(fallback).not.toContain('throw popupError');
  });

  test('generic OAuth internal errors are not mislabeled as popup permissions', () => {
    const internalError = auth.slice(auth.indexOf("'auth/internal-error':"), auth.indexOf("'auth/user-disabled':"));
    expect(internalError).not.toMatch(/ensure pop-ups are allowed/i);
    expect(internalError).toMatch(/authorized domain/i);
  });

  test('unsupported browser contexts receive an actionable explanation', () => {
    expect(login).toContain('auth/operation-not-supported-in-this-environment');
    expect(login).toContain('Open Arvdoul in Chrome or another supported browser');
  });
});
