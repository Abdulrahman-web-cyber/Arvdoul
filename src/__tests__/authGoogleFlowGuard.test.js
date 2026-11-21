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
const authContext = fs.readFileSync(path.join(root, 'src/context/AuthContext.jsx'), 'utf8');
const firebase = fs.readFileSync(path.join(root, 'src/firebase/firebase.js'), 'utf8');

describe('Google OAuth browser flow', () => {
  const methodStart = auth.indexOf('async signInWithGoogle(');
  const methodEnd = auth.indexOf('async createRecaptchaVerifier', methodStart);
  const method = auth.slice(methodStart, methodEnd);


  test('Firebase persistence is awaited and has a session fallback', () => {
    expect(firebase).toContain('export const authPersistenceReady');
    expect(firebase).toContain('await _fbSetPersistence(auth, _fbBrowserLocalPersistence)');
    expect(firebase).toContain('await _fbSetPersistence(auth, _fbBrowserSessionPersistence)');
    const initialize = auth.slice(auth.indexOf('async _initialize()'), auth.indexOf('async _sendWelcomeNotification'));
    expect(initialize).toContain('await firebaseApp.authPersistenceReady');
    expect(initialize.indexOf('await firebaseApp.authPersistenceReady')).toBeLessThan(initialize.indexOf('await getRedirectResult(this.auth)'));
  });

  test('redirect attempts are tracked across navigation and missing results are surfaced', () => {
    expect(auth).toContain('markGoogleRedirectPending()');
    expect(auth).toContain('auth/redirect-result-missing');
    expect(auth).toContain('clearGoogleRedirectPending()');
    expect(authContext).toContain('arvdoul_google_redirect_pending');
    expect(authContext).toContain('Google sign-in is taking too long to return');
    expect(login).toContain('authError');
    expect(login).toContain("authError.startsWith('Google sign-in')");
  });

  test('redirect result is consumed before auth initialization resolves', () => {
    const initialize = auth.slice(auth.indexOf('async initialize()'), auth.indexOf('async _sendWelcomeNotification'));
    expect(initialize).toContain('if (this.initializationPromise) return this.initializationPromise');
    expect(initialize).toContain('await getRedirectResult(this.auth)');
    expect(initialize).toContain('this.initialized = true');
    expect(initialize.indexOf('await getRedirectResult(this.auth)')).toBeLessThan(initialize.indexOf('this.initialized = true'));
    expect(initialize).not.toMatch(/\(async \(\) => \{/);
  });

  test('redirect processing errors remain diagnostic and do not block restored auth sessions', () => {
    const initialize = auth.slice(auth.indexOf('async _initialize()'), auth.indexOf('async _sendWelcomeNotification'));
    expect(initialize).toContain('this.googleRedirectError = redirectError');
    const listenerSetup = authContext.slice(authContext.indexOf('const setupAuthListener = async'), authContext.indexOf('const signUpWithEmailPassword = useCallback'));
    expect(listenerSetup.indexOf('await authService.initialize()')).toBeLessThan(listenerSetup.indexOf('onAuthStateChanged(auth'));
    expect(initialize).not.toContain('ensure pop-ups are allowed');
  });

  test('mobile browsers use redirect instead of a popup', () => {
    expect(method).toMatch(/prefersRedirect = \/Android|iPhone|iPad|iPod|Mobile\//);
    const mobileBranch = method.slice(method.indexOf('if (prefersRedirect)'), method.indexOf('let result;'));
    expect(mobileBranch).toContain('await signInWithRedirect');
    expect(mobileBranch).not.toContain('signInWithPopup');
    expect(method).not.toMatch(/await setPersistence\(/);
  });

  test('popup fallback reports the actual redirect failure', () => {
    const fallback = method.slice(method.indexOf('if (popupError.code === \'auth/popup-blocked\')'));
    expect(fallback).toContain('throw redirectError');
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
