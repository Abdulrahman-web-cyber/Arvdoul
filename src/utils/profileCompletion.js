/**
 * src/utils/profileCompletion.js
 *
 * Single source of truth for post-auth routing:
 *   Splash + existing session  → /home
 *   Splash + no session        → /intro
 *   Login of an existing account → /home
 *   Brand-new signup this session → /setup-profile (after verification)
 *
 * Returning users must NEVER be trapped on /setup-profile because a Firestore
 * flag is missing, a snapshot raced, or an auto-generated username looks "empty".
 */

export const ONBOARDING_SESSION_KEY = 'arvdoul_onboarding';
export const ONBOARDING_TTL_MS = 2 * 60 * 60 * 1000;

const PLACEHOLDER_NAMES = new Set([
  'user',
  'arvdoul user',
  'new user',
  'guest',
]);

const GUEST_ROUTES = [
  '/intro',
  '/login',
  '/signup/step1',
  '/signup/step2',
  '/forgot-password',
  '/reset-password',
];

function canUseSessionStorage() {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function markOnboardingRequired(uid, meta = {}) {
  if (!canUseSessionStorage() || !uid) return;
  try {
    sessionStorage.setItem(
      ONBOARDING_SESSION_KEY,
      JSON.stringify({
        uid,
        required: true,
        at: Date.now(),
        ...meta,
      })
    );
  } catch {
    /* private mode / quota — onboarding still works via isSignupInProgress */
  }
}

export function clearOnboardingRequired() {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getOnboardingSession(uid) {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.required) return null;
    if (uid && data.uid && data.uid !== uid) return null;
    if (data.at && Date.now() - data.at > ONBOARDING_TTL_MS) {
      sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function tsToMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value instanceof Date) {
    const n = value.getTime();
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value.toMillis === 'function') {
    try {
      const n = value.toMillis();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return null;
}

export function isReturningAuthUser(authUser) {
  if (!authUser) return false;
  if (authUser.isNewUser === true) return false;
  const created = tsToMs(authUser.metadata?.creationTime);
  const last = tsToMs(authUser.metadata?.lastSignInTime);
  if (created && last && Math.abs(last - created) > 60_000) return true;
  return false;
}

export function hasContact(authUser, profile) {
  return !!(
    profile?.email ||
    profile?.phoneNumber ||
    authUser?.email ||
    authUser?.phoneNumber
  );
}

export function hasRealDisplayName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (PLACEHOLDER_NAMES.has(n.toLowerCase())) return false;
  if (/^user\s+\d{2,6}$/i.test(n)) return false;
  if (/^phone user/i.test(n)) return false;
  return true;
}

export function hasChosenUsername(username) {
  const u = String(username || '').trim();
  if (!u) return false;
  if (/^user_[a-z0-9]{4,}$/i.test(u)) return false;
  return true;
}

/**
 * Whether the account is established enough to enter the main app.
 * Missing `isProfileComplete` on a real account must NOT count as incomplete.
 */
export function computeProfileComplete(authUser, profile, options = {}) {
  if (!authUser) return false;

  if (profile?.isProfileComplete === true || profile?.profileComplete === true) return true;
  if (profile?.profileCompletedAt) return true;

  if (profile) {
    if (hasRealDisplayName(profile.displayName) || hasRealDisplayName(authUser.displayName)) return true;
    if (hasChosenUsername(profile.username)) return true;
    if (hasContact(authUser, profile) && options.strict !== true) return true;
  }

  if (!profile) {
    if (options.profileResolved === false) return false;
    if (isReturningAuthUser(authUser)) return true;
    if (
      hasRealDisplayName(authUser.displayName) &&
      hasContact(authUser, null) &&
      authUser.isNewUser !== true
    ) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Setup-profile is only for an in-progress first-time signup THIS SESSION.
 * Session restore of an existing account never requires it.
 */
export function needsOnboarding({
  authUser,
  profile,
  profileResolved = true,
  isSignupInProgress = false,
  isNewUserThisSession = false,
} = {}) {
  if (!authUser) return false;

  const session = getOnboardingSession(authUser.uid);
  if (session?.required) return true;
  if (isSignupInProgress) return true;
  if (isNewUserThisSession === true || authUser.isNewUser === true) return true;

  if (computeProfileComplete(authUser, profile, { profileResolved })) {
    return false;
  }

  return false;
}

export function isGuestRoute(pathname) {
  if (!pathname) return false;
  return GUEST_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function isVerificationRoute(pathname) {
  if (!pathname) return false;
  return (
    pathname === '/verify-email' ||
    pathname.startsWith('/verify-email/') ||
    pathname === '/otp-verification' ||
    pathname.startsWith('/otp-verification/')
  );
}

export function isSetupRoute(pathname) {
  if (!pathname) return false;
  return pathname === '/setup-profile' || pathname.startsWith('/setup-profile/');
}

export function safeReturnPath(from) {
  if (!from || typeof from !== 'string') return '/home';
  if (!from.startsWith('/') || from.startsWith('//')) return '/home';
  if (from === '/') return '/home';
  if (isGuestRoute(from) || isVerificationRoute(from) || isSetupRoute(from)) return '/home';
  return from;
}

/**
 * Pure routing decision used by AppStateGuard + Splash.
 * `destination: null` + `allow: true` means render the current route.
 * `wait: true` means show a spinner — do not navigate yet.
 */
export function resolvePostAuthDestination({
  pathname,
  isAuthenticated,
  authInitialized,
  authLoading,
  profileResolved,
  needsEmailVerification,
  needsOnboarding: onboarding,
  isSplash = false,
} = {}) {
  const onSplash = isSplash || pathname === '/';

  if (onSplash) {
    return { wait: false, destination: null, allow: true };
  }

  if (!authInitialized || authLoading) {
    if (isGuestRoute(pathname) && !isAuthenticated) {
      return { wait: false, destination: null, allow: true };
    }
    return { wait: true, destination: null, allow: false };
  }

  if (isAuthenticated && !profileResolved) {
    return { wait: true, destination: null, allow: false };
  }

  const guest = isGuestRoute(pathname);
  const verify = isVerificationRoute(pathname);
  const setup = isSetupRoute(pathname);

  if (!isAuthenticated) {
    if (guest || verify) return { wait: false, destination: null, allow: true };
    if (setup) return { wait: false, destination: '/login', allow: false };
    return { wait: false, destination: '/intro', allow: false };
  }

  if (needsEmailVerification) {
    if (verify) return { wait: false, destination: null, allow: true };
    return { wait: false, destination: '/verify-email', allow: false };
  }

  if (onboarding) {
    if (setup) return { wait: false, destination: null, allow: true };
    return { wait: false, destination: '/setup-profile', allow: false };
  }

  if (guest || verify || setup) {
    return { wait: false, destination: '/home', allow: false };
  }

  return { wait: false, destination: null, allow: true };
}

export function resolveSplashDestination({ isAuthenticated, needsOnboarding: onboarding }) {
  if (!isAuthenticated) return '/intro';
  if (onboarding) return '/setup-profile';
  return '/home';
}
