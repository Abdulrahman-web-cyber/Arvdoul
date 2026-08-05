// Error taxonomy (Pillar 17) — used by GlobalErrorBoundary and services
export const ERROR_CODES = {
  // Validation 1000-1999
  VALIDATION_ERROR: 1000,
  INVALID_FORMAT: 1001,
  MISSING_FIELD: 1002,
  // Auth 2000-2999
  AUTH_REQUIRED: 2000,
  INVALID_TOKEN: 2001,
  SESSION_EXPIRED: 2002,
  // Permission 3000-3999
  PERMISSION_DENIED: 3000,
  NOT_OWNER: 3001,
  // Not found 4000-4999
  NOT_FOUND: 4000,
  USER_NOT_FOUND: 4001,
  POST_NOT_FOUND: 4002,
  // Rate limit 5000-5999
  RATE_LIMITED: 5000,
  TOO_MANY_REQUESTS: 5001,
  // Internal 6000-6999
  INTERNAL_ERROR: 6000,
  SERVICE_UNAVAILABLE: 6001,
};

export const getPublicMessage = (code) => {
  switch (code) {
    case ERROR_CODES.AUTH_REQUIRED: return "Please sign in.";
    case ERROR_CODES.PERMISSION_DENIED: return "You don't have access.";
    case ERROR_CODES.RATE_LIMITED: return "Too many requests. Please wait.";
    case ERROR_CODES.NOT_FOUND: return "Not found.";
    default: return "Something went wrong.";
  }
};
