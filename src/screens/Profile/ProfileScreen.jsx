/**
 * Central controller that renders ProfileMyScreen for the profile owner
 * or ProfilePublicScreen for visitors.
 *
 * Responsibilities:
 * - Read the route parameter (`useParams().userId`).
 * - Treat the AuthContext user's UID as the only ownership authority.
 * - Decide owner vs. visitor by exact UID comparison, or by a username that is
 *   tied to the authenticated UID.
 * - Ask the existing profile store to load the target profile when the store
 *   does not already hold it.
 *
 * This component is NOT an authorization boundary. It only picks which
 * existing screen to show; access to private data must be enforced elsewhere.
 *
 * @component
 */

import { useEffect } from "react";
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';
import ProfileMyScreen from './ProfileMyScreen';
import ProfilePublicScreen from './ProfilePublicScreen';

/** Route value meaning "the signed-in user's own profile". */
const SELF_ROUTE_KEY = 'me';

/**
 * Returns the value only if it is a non-empty string, otherwise null.
 * UIDs are opaque, so the value is never trimmed, cased or transformed.
 * @param {unknown} value
 * @returns {string | null}
 */
const asNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Normalizes a username for comparison (case-insensitive, no leading "@").
 * Must never be applied to UIDs.
 * @param {unknown} value
 * @returns {string | null}
 */
const toUsernameKey = (value) => {
  if (typeof value !== 'string') return null;
  const key = value.trim().replace(/^@/, '').toLowerCase();
  return key || null;
};

export default function ProfileScreen() {
  // React Router already decodes route params once; decoding again could
  // corrupt identifiers containing "%", so no further decoding is done.
  const { userId } = useParams();
  const { user: authContextUser } = useAuth();
  const appStoreUser = useAppStore((state) => state.currentUser);

  // Only primitive fields are selected so unrelated profile changes do not rerender.
  const profileUid = useProfileStore((state) => state.profile?.uid ?? state.profile?.id ?? null);
  const profileUsername = useProfileStore((state) => state.profile?.username ?? null);
  const loadProfile = useProfileStore((state) => state.loadProfile);

  // --- Authenticated identity -------------------------------------------
  // The AuthContext session is authoritative. The app store is never trusted
  // to establish identity, and a locally stored UID is never used.
  const authUid = asNonEmptyString(authContextUser?.uid);
  const appStoreUid = asNonEmptyString(appStoreUser?.uid);
  const hasIdentityConflict = Boolean(authUid && appStoreUid && appStoreUid !== authUid);

  // A username is only accepted from a user object whose UID is the session UID.
  const authUsername = toUsernameKey(
    authContextUser?.username ?? (appStoreUid === authUid ? appStoreUser?.username : null)
  );

  // --- Route interpretation ---------------------------------------------
  const trimmedParam = typeof userId === 'string' ? userId.trim().replace(/^@/, '') : '';
  const routeId = trimmedParam || null; // case preserved: may be a UID
  const routeKey = toUsernameKey(routeId); // lowercased: only for username comparison
  const isSelfRoute = routeId === null || routeKey === SELF_ROUTE_KEY;

  // --- Ownership --------------------------------------------------------
  const isOwner = Boolean(
    authUid &&
      !hasIdentityConflict &&
      (isSelfRoute ||
        routeId === authUid ||
        (authUsername && routeKey === authUsername) ||
        // Username route resolved through the loaded profile: the profile must
        // belong to the session UID and carry the username in the route.
        (profileUid === authUid &&
          toUsernameKey(profileUsername) !== null &&
          routeKey === toUsernameKey(profileUsername)))
  );

  // --- Profile loading --------------------------------------------------
  // Owner: load the session UID. Visitor: load the route value as before.
  // "me"/empty routes without an owner have no target (nothing is requested).
  const targetId = isOwner ? authUid : isSelfRoute ? null : routeId;

  const isTargetLoaded = isOwner
    ? profileUid === authUid
    : profileUid === routeId ||
      (routeKey !== null && toUsernameKey(profileUsername) === routeKey);

  useEffect(() => {
    if (!targetId || isTargetLoaded) return;
    loadProfile(targetId, authUid);
  }, [targetId, authUid, isTargetLoaded, loadProfile]);

  return isOwner ? <ProfileMyScreen /> : <ProfilePublicScreen />;
}
