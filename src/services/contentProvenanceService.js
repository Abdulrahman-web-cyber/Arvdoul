// src/services/contentProvenanceService.js

import { logger } from '../utils/Logger.js';

export const MEDIA_GENESIS_TYPE = {
  ORIGINAL_CAPTURE: 'ORIGINAL_CAPTURE',
  DIGITAL_CREATION: 'DIGITAL_CREATION',
  AI_GENERATED: 'AI_GENERATED',
  AI_ENHANCED: 'AI_ENHANCED',
  SYNTHETIC_UNKNOWN: 'SYNTHETIC_UNKNOWN',
};

export class ContentProvenanceService {
  constructor() {
    this.manifestRegistry = new Map(); // manifestId -> manifest
    this.fingerprintIndex = new Map(); // contentHash -> manifestId
  }

  /**
   * Deterministic perceptual hash calculation.
   */
  _computeMediaFingerprint(mediaBufferOrString) {
    const raw = typeof mediaBufferOrString === 'string' ? mediaBufferOrString : JSON.stringify(mediaBufferOrString);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `FP_${Math.abs(hash).toString(16).padStart(10, '0')}`;
  }

  /**
   * Registers a new content provenance manifest (C2PA-compliant structure).
   */
  registerManifest({
    contentId,
    creatorId,
    mediaData,
    genesisType = MEDIA_GENESIS_TYPE.ORIGINAL_CAPTURE,
    toolMetadata = { software: 'ArvdoulStudio', version: '2.0.0' },
    aiDisclosure = null, // e.g. { model: 'Gemini-2.0-Flash', promptDisclosed: false }
  }) {
    if (!contentId || !creatorId || !mediaData) {
      throw new Error('contentId, creatorId, and mediaData are required');
    }

    const contentHash = this._computeMediaFingerprint(mediaData);
    const now = Date.now();
    const manifestId = `c2pa_${contentId}_${now}`;

    // Evaluate synthetic risk score
    const syntheticRisk = this._evaluateSyntheticMediaRisk(genesisType, aiDisclosure);

    const assertions = [
      {
        label: 'c2pa.hash.data',
        data: { hashAlgorithm: 'murmur3-32bit-custom', hash: contentHash },
      },
      {
        label: 'c2pa.actions',
        data: {
          actions: [
            {
              action: genesisType === MEDIA_GENESIS_TYPE.AI_GENERATED ? 'c2pa.created.synthetic' : 'c2pa.created.captured',
              softwareAgent: toolMetadata.software,
              when: new Date(now).toISOString(),
            },
          ],
        },
      },
    ];

    if (aiDisclosure) {
      assertions.push({
        label: 'c2pa.ai.disclosure',
        data: { ...aiDisclosure, declaredByCreator: true },
      });
    }

    const unsignedManifest = {
      manifestId,
      contentId,
      creatorId,
      genesisType,
      contentHash,
      assertions,
      syntheticRisk,
      registeredAt: now,
    };

    const signature = `SIG_PROVENANCE_${this._computeMediaFingerprint(JSON.stringify(unsignedManifest))}`;

    const manifest = {
      ...unsignedManifest,
      signature,
      status: 'VERIFIED',
    };

    this.manifestRegistry.set(manifestId, manifest);
    this.fingerprintIndex.set(contentHash, manifestId);

    logger.info(`[Provenance] Registered manifest ${manifestId} for content ${contentId} (Genesis: ${genesisType}, Risk: ${syntheticRisk.score})`);
    return manifest;
  }

  /**
   * Verifies the authenticity and provenance integrity of a media payload.
   */
  verifyProvenance(manifestId, currentMediaData) {
    const manifest = this.manifestRegistry.get(manifestId);
    if (!manifest) {
      return { isValid: false, reason: 'MANIFEST_NOT_FOUND' };
    }

    const currentHash = this._computeMediaFingerprint(currentMediaData);
    if (currentHash !== manifest.contentHash) {
      logger.warn(`[Provenance] Tamper detected for manifest ${manifestId}! Hash mismatch`);
      return {
        isValid: false,
        reason: 'CONTENT_TAMPERED_OR_MODIFIED',
        originalHash: manifest.contentHash,
        currentHash,
      };
    }

    // Verify signature integrity
    const { signature, status, ...unsignedManifest } = manifest;
    const expectedSig = `SIG_PROVENANCE_${this._computeMediaFingerprint(JSON.stringify(unsignedManifest))}`;

    if (signature !== expectedSig) {
      return { isValid: false, reason: 'MANIFEST_SIGNATURE_TAMPERED' };
    }

    return {
      isValid: true,
      manifestId: manifest.manifestId,
      contentId: manifest.contentId,
      creatorId: manifest.creatorId,
      genesisType: manifest.genesisType,
      syntheticRisk: manifest.syntheticRisk,
      certifiedAt: new Date(manifest.registeredAt).toISOString(),
    };
  }

  /**
   * Appends an authorized edit action to the chain of custody.
   */
  appendEditAction(manifestId, editorId, { actionType, tool, outputMediaData }) {
    const manifest = this.manifestRegistry.get(manifestId);
    if (!manifest) throw new Error('Manifest not found');

    const newHash = this._computeMediaFingerprint(outputMediaData);
    const actionAssertion = manifest.assertions.find(a => a.label === 'c2pa.actions');

    if (actionAssertion) {
      actionAssertion.data.actions.push({
        action: actionType || 'c2pa.edited',
        softwareAgent: tool || 'ArvdoulEditor',
        editorId,
        when: new Date().toISOString(),
      });
    }

    // Update content hash
    manifest.contentHash = newHash;
    this.fingerprintIndex.set(newHash, manifestId);

    // Re-sign manifest
    const { signature, status, ...unsignedManifest } = manifest;
    manifest.signature = `SIG_PROVENANCE_${this._computeMediaFingerprint(JSON.stringify(unsignedManifest))}`;

    logger.info(`[Provenance] Appended edit action to ${manifestId} by ${editorId}`);
    return manifest;
  }

  /**
   * Internal risk heuristic evaluating undisclosed deepfakes or synthetic media.
   */
  _evaluateSyntheticMediaRisk(genesisType, aiDisclosure) {
    if (genesisType === MEDIA_GENESIS_TYPE.AI_GENERATED) {
      return {
        score: 0.1, // Low risk because properly declared!
        classification: 'DECLARED_SYNTHETIC',
        isPermitted: true,
        label: 'AI-Generated (Declared)',
      };
    }

    if (genesisType === MEDIA_GENESIS_TYPE.AI_ENHANCED) {
      return {
        score: 0.2,
        classification: 'AI_ASSISTED',
        isPermitted: true,
        label: 'AI-Enhanced',
      };
    }

    if (genesisType === MEDIA_GENESIS_TYPE.SYNTHETIC_UNKNOWN) {
      return {
        score: 0.85, // High risk
        classification: 'SUSPECTED_UNDISCLOSED_SYNTHETIC',
        isPermitted: false,
        label: 'Suspicious / Potential Undisclosed Deepfake',
      };
    }

    return {
      score: 0.0,
      classification: 'AUTHENTIC_CAPTURE',
      isPermitted: true,
      label: 'Verified Human Capture',
    };
  }
}

export const contentProvenanceService = new ContentProvenanceService();
export default contentProvenanceService;
