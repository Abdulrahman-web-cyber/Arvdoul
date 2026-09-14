// src/config/profileContracts.js - ARVDOUL PROFILE SYSTEM DOMAIN CONTRACTS
// Authoritative definitions for profile identity, visibility scopes, validation rules,
// and privacy models adhering to Blueprint Specification Version 1.0.

/**
 * Profile Classification Types
 * Extensible categorization of user accounts in Arvdoul.
 */
export const PROFILE_TYPES = {
  PERSONAL: 'PERSONAL',
  CREATOR: 'CREATOR',
  BUSINESS: 'BUSINESS',
  ORGANIZATION: 'ORGANIZATION',
  COMMUNITY: 'COMMUNITY'
};

/**
 * Privacy Visibility Scopes
 * Granular access control levels for profile sections and sensitive metadata.
 */
export const VISIBILITY_SCOPES = {
  EVERYONE: 'EVERYONE',
  FOLLOWERS: 'FOLLOWERS',
  CONNECTIONS: 'CONNECTIONS', // Mutual follows / friends
  ONLY_ME: 'ONLY_ME'
};

/**
 * Default Privacy Configuration for new and existing profiles
 */
export const DEFAULT_PROFILE_PRIVACY = {
  profileInfo: VISIBILITY_SCOPES.EVERYONE,
  activity: VISIBILITY_SCOPES.EVERYONE,
  achievements: VISIBILITY_SCOPES.EVERYONE,
  titles: VISIBILITY_SCOPES.EVERYONE,
  communities: VISIBILITY_SCOPES.EVERYONE,
  collections: VISIBILITY_SCOPES.EVERYONE,
  links: VISIBILITY_SCOPES.EVERYONE,
  economicStatus: VISIBILITY_SCOPES.ONLY_ME, // Financial & earnings are private by default
  creatorInfo: VISIBILITY_SCOPES.EVERYONE,
  followersList: VISIBILITY_SCOPES.EVERYONE,
  followingList: VISIBILITY_SCOPES.EVERYONE,
  presence: VISIBILITY_SCOPES.FOLLOWERS // Online status visible to followers by default
};

/**
 * Server-Authoritative Fields
 * Clients must NEVER directly write or mutate these fields.
 * Any attempt to pass them in client update calls is stripped and blocked.
 */
export const SERVER_AUTHORITATIVE_FIELDS = [
  'xp',
  'experience',
  'experienceToNextLevel',
  'level',
  'levelBand',
  'activeDays',
  'activeDaysCount',
  'activeStreak',
  'longestStreak',
  'lastActiveDate',
  'lastActiveDay',
  'reputation',
  'reputationScore',
  'reputationTier',
  'influence',
  'influenceScore',
  'contribution',
  'contributionScore',
  'titles',
  'activeTitle',
  'achievements',
  'creatorStatus',
  'creatorTier',
  'isCreator',
  'monetizationEligible',
  'coins',
  'coinBalance',
  'earnings',
  'totalEarned',
  'isVerified',
  'accountStatus',
  'roles',
  'role',
  'policyStanding'
];

/**
 * Validation constraints for user-editable profile fields
 */
export const PROFILE_CONSTRAINTS = {
  DISPLAY_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 60,
    PATTERN: /^[\p{L}\p{N}\s._'-]+$/u
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_]+$/
  },
  BIO: {
    MAX_LENGTH: 500
  },
  STATUS: {
    MAX_LENGTH: 100
  },
  PRONOUNS: {
    MAX_LENGTH: 30
  },
  LOCATION: {
    MAX_LENGTH: 100
  },
  PROFESSION: {
    MAX_LENGTH: 100
  },
  EDUCATION: {
    MAX_LENGTH: 100
  },
  GENDER: {
    MAX_LENGTH: 50
  },
  WEBSITE: {
    MAX_LENGTH: 200
  },
  LINKS: {
    MAX_COUNT: 10,
    TITLE_MAX_LENGTH: 50,
    URL_MAX_LENGTH: 500
  }
};

/**
 * Allowed URL protocols for profile links to guard against XSS and javascript: injections
 */
const SAFE_URL_PROTOCOLS = ['https:', 'http:'];

/**
 * Validates a web URL safely
 * @param {string} urlString
 * @returns {boolean}
 */
export function isValidWebUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (trimmed.length === 0 || trimmed.length > PROFILE_CONSTRAINTS.WEBSITE.MAX_LENGTH) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalizes and sanitizes a profile link URL
 * @param {string} urlString
 * @returns {string|null}
 */
export function sanitizeProfileUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  const trimmed = urlString.trim();
  if (trimmed.length === 0) return null;

  try {
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (!SAFE_URL_PROTOCOLS.includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validates and sanitizes a complete user profile update payload
 * Strips all server-authoritative and disallowed keys.
 * 
 * @param {Object} rawUpdates
 * @returns {{ valid: boolean, sanitized: Object, errors: string[] }}
 */
export function validateProfileUpdate(rawUpdates = {}) {
  const errors = [];
  const sanitized = {};

  if (!rawUpdates || typeof rawUpdates !== 'object') {
    return { valid: false, sanitized: {}, errors: ['Invalid update payload'] };
  }

  // 1. Strip server-authoritative keys
  const keysToProcess = Object.keys(rawUpdates).filter(
    (k) => !SERVER_AUTHORITATIVE_FIELDS.includes(k)
  );

  for (const key of keysToProcess) {
    const val = rawUpdates[key];

    switch (key) {
      case 'displayName': {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.length < PROFILE_CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH || trimmed.length > PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH) {
            errors.push(`Display name must be between ${PROFILE_CONSTRAINTS.DISPLAY_NAME.MIN_LENGTH} and ${PROFILE_CONSTRAINTS.DISPLAY_NAME.MAX_LENGTH} characters`);
          } else {
            sanitized.displayName = trimmed;
          }
        }
        break;
      }

      case 'firstName': {
        if (typeof val === 'string') sanitized.firstName = val.trim().slice(0, 50);
        break;
      }

      case 'lastName': {
        if (typeof val === 'string') sanitized.lastName = val.trim().slice(0, 50);
        break;
      }

      case 'bio': {
        if (typeof val === 'string') {
          sanitized.bio = val.trim().slice(0, PROFILE_CONSTRAINTS.BIO.MAX_LENGTH);
        } else if (val === null) {
          sanitized.bio = '';
        }
        break;
      }

      case 'status': {
        if (typeof val === 'string') {
          sanitized.status = val.trim().slice(0, PROFILE_CONSTRAINTS.STATUS.MAX_LENGTH);
        } else if (val === null) {
          sanitized.status = '';
        }
        break;
      }

      case 'pronouns': {
        if (typeof val === 'string') {
          sanitized.pronouns = val.trim().slice(0, PROFILE_CONSTRAINTS.PRONOUNS.MAX_LENGTH);
        } else if (val === null) {
          sanitized.pronouns = '';
        }
        break;
      }

      case 'location': {
        if (typeof val === 'string') {
          sanitized.location = val.trim().slice(0, PROFILE_CONSTRAINTS.LOCATION.MAX_LENGTH);
        } else if (val === null) {
          sanitized.location = '';
        }
        break;
      }

      case 'profession': {
        if (typeof val === 'string') {
          sanitized.profession = val.trim().slice(0, PROFILE_CONSTRAINTS.PROFESSION.MAX_LENGTH);
        } else if (val === null) {
          sanitized.profession = '';
        }
        break;
      }

      case 'education': {
        if (typeof val === 'string') {
          sanitized.education = val.trim().slice(0, PROFILE_CONSTRAINTS.EDUCATION.MAX_LENGTH);
        } else if (val === null) {
          sanitized.education = '';
        }
        break;
      }

      case 'gender': {
        if (typeof val === 'string') {
          sanitized.gender = val.trim().slice(0, PROFILE_CONSTRAINTS.GENDER.MAX_LENGTH);
        } else if (val === null) {
          sanitized.gender = '';
        }
        break;
      }

      case 'website': {
        if (typeof val === 'string' && val.trim().length > 0) {
          const cleanUrl = sanitizeProfileUrl(val);
          if (cleanUrl) {
            sanitized.website = cleanUrl;
          } else {
            errors.push('Website URL is invalid');
          }
        } else if (val === '' || val === null) {
          sanitized.website = '';
        }
        break;
      }

      case 'links': {
        if (Array.isArray(val)) {
          const cleanLinks = [];
          for (const item of val.slice(0, PROFILE_CONSTRAINTS.LINKS.MAX_COUNT)) {
            if (item && typeof item === 'object') {
              const itemTitle = typeof item.title === 'string' ? item.title.trim().slice(0, PROFILE_CONSTRAINTS.LINKS.TITLE_MAX_LENGTH) : 'Link';
              const cleanUrl = sanitizeProfileUrl(item.url);
              if (cleanUrl) {
                cleanLinks.push({
                  id: item.id || `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  title: itemTitle,
                  url: cleanUrl,
                  icon: typeof item.icon === 'string' ? item.icon.slice(0, 30) : 'globe'
                });
              }
            }
          }
          sanitized.links = cleanLinks;
        }
        break;
      }

      case 'profileType': {
        if (Object.values(PROFILE_TYPES).includes(val)) {
          sanitized.profileType = val;
        } else {
          errors.push(`Invalid profile type: ${val}`);
        }
        break;
      }

      case 'privacy': {
        if (val && typeof val === 'object') {
          const mergedPrivacy = { ...DEFAULT_PROFILE_PRIVACY };
          const keyMappings = {
            profileVisibility: 'profileInfo',
            onlinePresence: 'presence',
            followersVisibility: 'followersList',
            activityVisibility: 'activity',
          };
          const valueMappings = {
            public: VISIBILITY_SCOPES.EVERYONE,
            everyone: VISIBILITY_SCOPES.EVERYONE,
            followers: VISIBILITY_SCOPES.FOLLOWERS,
            connections: VISIBILITY_SCOPES.CONNECTIONS,
            private: VISIBILITY_SCOPES.ONLY_ME,
            only_me: VISIBILITY_SCOPES.ONLY_ME,
          };
          const normalizeScope = (v) => {
            if (!v) return null;
            if (Object.values(VISIBILITY_SCOPES).includes(v)) return v;
            return valueMappings[String(v).toLowerCase()] || null;
          };

          for (const [k, v] of Object.entries(val)) {
            const canonicalKey = keyMappings[k] || k;
            const normalizedVal = normalizeScope(v);
            if (canonicalKey in DEFAULT_PROFILE_PRIVACY && normalizedVal) {
              mergedPrivacy[canonicalKey] = normalizedVal;
              if (k === 'activityVisibility' && !val.achievements) {
                mergedPrivacy.achievements = normalizedVal;
              }
            }
          }
          sanitized.privacy = mergedPrivacy;
        }
        break;
      }

      case 'isPrivate': {
        if (typeof val === 'boolean') {
          sanitized.isPrivate = val;
        }
        break;
      }

      case 'photoURL': {
        if (typeof val === 'string') {
          sanitized.photoURL = val;
        }
        break;
      }

      case 'coverPhotoURL':
      case 'coverPhoto': {
        if (typeof val === 'string') {
          sanitized.coverPhotoURL = val;
        }
        break;
      }

      case 'customBadgeColor': {
        if (typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val)) {
          sanitized.customBadgeColor = val;
        }
        break;
      }

      case 'preferences': {
        if (val && typeof val === 'object') {
          sanitized.preferences = val;
        }
        break;
      }

      default:
        // Pass through harmless non-authoritative scalar fields (e.g. timezone, lang)
        if (['language', 'theme', 'timezone'].includes(key) && typeof val === 'string') {
          sanitized[key] = val.slice(0, 50);
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Checks if a viewer has permission to view a specific profile section
 * 
 * @param {string} section - Key from DEFAULT_PROFILE_PRIVACY
 * @param {Object} profilePrivacy - Profile's privacy object
 * @param {string} viewerRelation - 'OWNER' | 'CONNECTION' | 'FOLLOWER' | 'PUBLIC'
 * @returns {boolean}
 */
export function canViewProfileSection(section, profilePrivacy = {}, viewerRelation = 'PUBLIC') {
  if (viewerRelation === 'OWNER') return true;

  const scope = profilePrivacy[section] || DEFAULT_PROFILE_PRIVACY[section] || VISIBILITY_SCOPES.EVERYONE;

  switch (scope) {
    case VISIBILITY_SCOPES.EVERYONE:
      return true;
    case VISIBILITY_SCOPES.FOLLOWERS:
      return viewerRelation === 'FOLLOWER' || viewerRelation === 'CONNECTION';
    case VISIBILITY_SCOPES.CONNECTIONS:
      return viewerRelation === 'CONNECTION';
    case VISIBILITY_SCOPES.ONLY_ME:
      return false;
    default:
      return true;
  }
}

export default {
  PROFILE_TYPES,
  VISIBILITY_SCOPES,
  DEFAULT_PROFILE_PRIVACY,
  SERVER_AUTHORITATIVE_FIELDS,
  PROFILE_CONSTRAINTS,
  isValidWebUrl,
  sanitizeProfileUrl,
  validateProfileUpdate,
  canViewProfileSection
};
