import {
  computeProfileComplete,
  needsOnboarding,
  resolvePostAuthDestination,
  resolveSplashDestination,
  isReturningAuthUser,
  hasRealDisplayName,
  hasChosenUsername,
  safeReturnPath,
  markOnboardingRequired,
  clearOnboardingRequired,
  getOnboardingSession,
  ONBOARDING_SESSION_KEY,
} from '../profileCompletion.js';

const returningUser = {
  uid: 'u1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: 'Ada Lovelace',
  isNewUser: false,
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2026-08-31T10:00:00.000Z',
  },
};

const establishedProfile = {
  uid: 'u1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  username: 'ada',
  isProfileComplete: true,
};

describe('hasRealDisplayName', () => {
  test('rejects placeholders', () => {
    expect(hasRealDisplayName('')).toBe(false);
    expect(hasRealDisplayName('User')).toBe(false);
    expect(hasRealDisplayName('Arvdoul User')).toBe(false);
    expect(hasRealDisplayName('User 1234')).toBe(false);
    expect(hasRealDisplayName('Phone User')).toBe(false);
  });

  test('accepts real names', () => {
    expect(hasRealDisplayName('Ada Lovelace')).toBe(true);
    expect(hasRealDisplayName('Chinedu')).toBe(true);
  });
});

describe('hasChosenUsername', () => {
  test('rejects auto-generated user_<uid> placeholders', () => {
    expect(hasChosenUsername('user_ab12cd34')).toBe(false);
    expect(hasChosenUsername('')).toBe(false);
  });

  test('accepts chosen usernames', () => {
    expect(hasChosenUsername('ada')).toBe(true);
    expect(hasChosenUsername('ada_l')).toBe(true);
  });
});

describe('isReturningAuthUser', () => {
  test('true when last sign-in is after creation', () => {
    expect(isReturningAuthUser(returningUser)).toBe(true);
  });

  test('false for explicit new users', () => {
    expect(isReturningAuthUser({ ...returningUser, isNewUser: true })).toBe(false);
  });
});

describe('computeProfileComplete', () => {
  test('false when no auth user', () => {
    expect(computeProfileComplete(null, establishedProfile)).toBe(false);
  });

  test('true when flag is set', () => {
    expect(computeProfileComplete(returningUser, establishedProfile)).toBe(true);
  });

  test('true for existing Firestore identity even if flag is missing/false', () => {
    expect(
      computeProfileComplete(returningUser, {
        uid: 'u1',
        email: 'ada@example.com',
        username: 'user_ab12cd34',
        isProfileComplete: false,
      })
    ).toBe(true);
  });

  test('true for returning auth user while profile is still loading (resolved)', () => {
    expect(computeProfileComplete(returningUser, null, { profileResolved: true })).toBe(true);
  });

  test('false while profile is unresolved and no other evidence', () => {
    const brandNew = {
      uid: 'n1',
      email: 'new@example.com',
      displayName: null,
      isNewUser: true,
      metadata: {
        creationTime: '2026-08-31T10:00:00.000Z',
        lastSignInTime: '2026-08-31T10:00:00.000Z',
      },
    };
    expect(computeProfileComplete(brandNew, null, { profileResolved: false })).toBe(false);
  });
});

describe('needsOnboarding', () => {
  afterEach(() => {
    clearOnboardingRequired();
  });

  test('returning established users never need setup', () => {
    expect(
      needsOnboarding({
        authUser: returningUser,
        profile: establishedProfile,
        profileResolved: true,
      })
    ).toBe(false);
  });

  test('session restore of an existing account (flag false) does not force setup', () => {
    expect(
      needsOnboarding({
        authUser: returningUser,
        profile: { uid: 'u1', email: 'ada@example.com', isProfileComplete: false },
        profileResolved: true,
        isSignupInProgress: false,
      })
    ).toBe(false);
  });

  test('this-session signup still needs setup even if contact already exists', () => {
    markOnboardingRequired('n1');
    const brandNew = {
      uid: 'n1',
      email: 'new@example.com',
      displayName: null,
      isNewUser: true,
      metadata: {
        creationTime: '2026-08-31T10:00:00.000Z',
        lastSignInTime: '2026-08-31T10:00:00.000Z',
      },
    };
    expect(
      needsOnboarding({
        authUser: brandNew,
        profile: { uid: 'n1', email: 'new@example.com', isProfileComplete: false },
        profileResolved: true,
        isNewUserThisSession: true,
      })
    ).toBe(true);
  });

  test('this-session signup without a complete profile needs setup', () => {
    markOnboardingRequired('n1');
    const brandNew = {
      uid: 'n1',
      email: 'new@example.com',
      displayName: null,
      isNewUser: true,
      metadata: {
        creationTime: '2026-08-31T10:00:00.000Z',
        lastSignInTime: '2026-08-31T10:00:00.000Z',
      },
    };
    expect(
      needsOnboarding({
        authUser: brandNew,
        profile: { uid: 'n1', email: 'new@example.com', isProfileComplete: false },
        profileResolved: true,
        isNewUserThisSession: true,
      })
    ).toBe(true);
  });

  test('onboarding session is uid-scoped', () => {
    markOnboardingRequired('other');
    expect(getOnboardingSession('u1')).toBeNull();
    expect(
      needsOnboarding({
        authUser: returningUser,
        profile: establishedProfile,
        profileResolved: true,
      })
    ).toBe(false);
  });
});

describe('resolveSplashDestination', () => {
  test('guest → intro', () => {
    expect(resolveSplashDestination({ isAuthenticated: false, needsOnboarding: false })).toBe('/intro');
  });

  test('existing account → home', () => {
    expect(resolveSplashDestination({ isAuthenticated: true, needsOnboarding: false })).toBe('/home');
  });

  test('in-progress signup → setup-profile', () => {
    expect(resolveSplashDestination({ isAuthenticated: true, needsOnboarding: true })).toBe('/setup-profile');
  });
});

describe('resolvePostAuthDestination', () => {
  const base = {
    authInitialized: true,
    authLoading: false,
    profileResolved: true,
    needsEmailVerification: false,
    needsOnboarding: false,
  };

  test('guest login is visible while auth is still booting', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/login',
      authInitialized: false,
      authLoading: true,
      isAuthenticated: false,
    });
    expect(r.wait).toBe(false);
    expect(r.allow).toBe(true);
  });

  test('waits until auth is initialized', () => {
    const r = resolvePostAuthDestination({ ...base, pathname: '/home', authInitialized: false, isAuthenticated: false });
    expect(r.wait).toBe(true);
  });

  test('waits for profile on authenticated non-splash routes', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/home',
      isAuthenticated: true,
      profileResolved: false,
    });
    expect(r.wait).toBe(true);
    expect(r.destination).toBeNull();
  });

  test('existing authenticated user on /login → /home', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/login',
      isAuthenticated: true,
    });
    expect(r.wait).toBe(false);
    expect(r.destination).toBe('/home');
  });

  test('existing authenticated user on /setup-profile → /home', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/setup-profile',
      isAuthenticated: true,
      needsOnboarding: false,
    });
    expect(r.destination).toBe('/home');
  });

  test('guest hitting /home → /intro', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/home',
      isAuthenticated: false,
    });
    expect(r.destination).toBe('/intro');
  });

  test('new signup needing onboarding → /setup-profile', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/home',
      isAuthenticated: true,
      needsOnboarding: true,
    });
    expect(r.destination).toBe('/setup-profile');
  });

  test('unverified email → /verify-email', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/home',
      isAuthenticated: true,
      needsEmailVerification: true,
    });
    expect(r.destination).toBe('/verify-email');
  });

  test('splash never navigates from the guard', () => {
    const r = resolvePostAuthDestination({
      ...base,
      pathname: '/',
      isAuthenticated: true,
      profileResolved: false,
      isSplash: true,
    });
    expect(r.allow).toBe(true);
    expect(r.wait).toBe(false);
    expect(r.destination).toBeNull();
  });
});

describe('safeReturnPath', () => {
  test('rejects open redirects and auth routes', () => {
    expect(safeReturnPath('https://evil.com')).toBe('/home');
    expect(safeReturnPath('//evil.com')).toBe('/home');
    expect(safeReturnPath('/login')).toBe('/home');
    expect(safeReturnPath('/setup-profile')).toBe('/home');
    expect(safeReturnPath('/messages')).toBe('/messages');
  });
});

describe('onboarding session storage', () => {
  afterEach(() => clearOnboardingRequired());

  test('round-trips', () => {
    markOnboardingRequired('abc', { method: 'email' });
    expect(getOnboardingSession('abc')).toMatchObject({ uid: 'abc', required: true, method: 'email' });
    clearOnboardingRequired();
    expect(getOnboardingSession('abc')).toBeNull();
    expect(sessionStorage.getItem(ONBOARDING_SESSION_KEY)).toBeNull();
  });
});
