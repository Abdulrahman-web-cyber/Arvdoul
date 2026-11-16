/**
 * Vendor-SDK stubs for the Jest harness.
 *
 * `functions/video.js` is a CommonJS module that `require()`s the Google Cloud
 * and Mux SDKs and constructs their clients at module load. Those constructors
 * attempt credential resolution over the network and hang under Jest, and the
 * root `node_modules` does not install them (they are `functions/` deps). The
 * emulator-backed money-path test (`videoMoneyPath.test.js`) loads the real
 * `functions/video.js` to exercise `transferCoinsInternal`, which never touches
 * these clients, so mapping them to inert stubs is safe.
 *
 * Mapped from `jest.config.cjs` `moduleNameMapper` (intercepts both `require`
 * and ESM import).
 */

const noop = () => {};
const noopAsync = async () => ({});

class Storage {
  bucket() { return { file: () => ({ save: noopAsync, delete: noopAsync, getSignedUrl: async () => [''] }) }; }
}

class VideoIntelligenceServiceClient {
  async annotateVideo() { return [{}]; }
}

class SpeechClient {
  async longRunningRecognize() { return [{}]; }
  async recognize() { return [{}]; }
}

class Mux {
  constructor() {
    this.video = {
      uploads: { create: noopAsync },
      assets: { create: noopAsync, retrieve: noopAsync, delete: noopAsync },
      liveStreams: { create: noopAsync, retrieve: noopAsync, delete: noopAsync, resetStreamKey: noopAsync },
    };
    this.webhooks = { verifyHeader: noop };
  }
}

module.exports = { Storage, VideoIntelligenceServiceClient, SpeechClient, Mux };
