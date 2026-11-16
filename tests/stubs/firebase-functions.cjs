/**
 * Minimal `firebase-functions` stub for the Jest harness.
 *
 * Jest's `testPathIgnorePatterns` excludes `functions/`, and the root
 * `node_modules` does not install `firebase-functions` (it is a `functions/`
 * dependency). A few pure-logic `functions/` modules — such as
 * `withdrawalSettlement.js` — are worth testing behaviourally against the
 * Firestore emulator, so this stub supplies only the surface they touch:
 * `https.HttpsError`, `config()`, `logger` and the trigger builders.
 */
class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HttpsError';
    this.code = code;
  }
}

const noop = () => {};

module.exports = {
  https: {
    HttpsError,
    onCall: () => noop,
    onRequest: () => noop,
  },
  config: () => ({}),
  logger: { info: noop, warn: noop, error: noop, debug: noop },
  pubsub: { schedule: () => ({ onRun: () => noop }) },
  firestore: { document: () => ({ onWrite: () => noop }) },
  auth: { user: () => ({ onCreate: () => noop, onDelete: () => noop }) },
};
