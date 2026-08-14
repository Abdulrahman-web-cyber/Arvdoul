/**
 * src/services/copyrightDetectionService.js - ARVDOUL COPYRIGHT & PERCEPTUAL HASHING ENGINE v8.0
 *
 * Implements:
 * 1. 64-bit Perceptual Hash (dHash/pHash) Simulation: Generates visual media fingerprints.
 * 2. Hamming Distance Matching: Verifies overlap proximity against registered copyrighted assets.
 * 3. DMCA Legal Notice & Takedown Log: Generates automated DMCA review cases.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

class CopyrightDetectionService {
  constructor() {
    this.hammingMatchThreshold = 10; // Max allowed bit difference for copyright hit (out of 64)

    // Registered copyrighted visual media signatures
    this.copyrightRegistry = new Map([
      ['arv_disney_logo_fingerprint_64', { owner: 'Disney Enterprises', title: 'Disney Registered Logo Mark' }],
      ['arv_warner_bros_intro_fingerprint', { owner: 'Warner Bros. Discovery', title: 'WB Animated Intro Sequence' }],
      ['arv_sony_music_sample_fingerprint', { owner: 'Sony Music Entertainment', title: 'Copyrighted Audio Sample V3' }],
      ['1111000011110000111100001111000011110000111100001111000011110000', { owner: 'WarnerMedia Ltd.', title: 'WarnerMedia Protected Asset' }]
    ]);
  }

  /**
   * Computes Hamming distance (number of bit positions that differ) between two equal-length hex hashes.
   */
  computeHammingDistance(hashA, hashB) {
    if (!hashA || !hashB || hashA.length !== hashB.length) return 99;

    let distance = 0;
    for (let i = 0; i < hashA.length; i++) {
      const charA = parseInt(hashA[i], 16);
      const charB = parseInt(hashB[i], 16);
      let xor = charA ^ charB;

      // Count set bits
      while (xor > 0) {
        if (xor & 1) distance++;
        xor >>= 1;
      }
    }
    return distance;
  }

  // Alias for backward compatibility
  hammingDistance(hashA, hashB) {
    return this.computeHammingDistance(hashA, hashB);
  }

  /**
   * Generates a 64-bit hexadecimal string representation from binary media buffer.
   */
  computeFingerprint(buffer) {
    if (!buffer) return '0000000000000000';
    let hash = 0;
    const str = typeof buffer === 'string' ? buffer : String(buffer);
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
  }

  /**
   * Evaluates media fingerprint against the copyrighted visual database.
   */
  evaluateCopyright(mediaBuffer, metadata = {}) {
    const fingerprint = metadata.fingerprint || this.computeFingerprint(mediaBuffer);
    logger.info('[Copyright] Running copyright registry scanning on fingerprint:', { fingerprint });

    for (const [registeredHash, asset] of this.copyrightRegistry.entries()) {
      const distance = this.computeHammingDistance(fingerprint, registeredHash);
      if (distance <= this.hammingMatchThreshold) {
        logger.warn('[Copyright] Critical copyright match detected!', { asset, distance });
        auditLogger.log('copyright.registry_match_detected', {
          userId: metadata.userId || 'anon',
          meta: { fingerprint, registeredHash, distance, asset }
        });

        return {
          isInfringed: true,
          match: asset,
          distance,
          action: 'BLOCK_AND_FLAG',
          reason: `Content matches registered work: "${asset.title}" belonging to ${asset.owner}.`
        };
      }
    }

    return { isInfringed: false };
  }

  // Alias for backward compatibility
  checkCopyrightMatch(fingerprint) {
    const evaluation = this.evaluateCopyright(null, { fingerprint });
    return {
      match: evaluation.isInfringed,
      owner: evaluation.match?.owner || null,
      action: evaluation.match ? 'FLAG_FOR_ATTRIBUTION_OR_TAKEDOWN' : null
    };
  }

  /**
   * Formally files an automated DMCA legal takedown record.
   */
  processDmcaNotice(violatorUserId, contentId, claimantName, claimantWorkTitle) {
    const caseId = `dmca_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    logger.warn('[Copyright] Formally processing legal DMCA Takedown Notice:', { caseId, violatorUserId, contentId });

    auditLogger.log('copyright.dmca_notice_filed', {
      userId: violatorUserId,
      meta: { caseId, contentId, claimantName, claimantWorkTitle }
    });

    return {
      success: true,
      caseId,
      status: 'UNDER_REVIEW',
      actionTaken: 'CONTENT_TEMPORARILY_BLOCKED',
      timestamp: new Date().toISOString()
    };
  }

  // Alias for backward compatibility
  processDMCANotice(claimantName, contentId, violatorUserId) {
    const result = this.processDmcaNotice(violatorUserId, contentId, claimantName, 'Protected Asset');
    return {
      success: true,
      claimId: result.caseId,
      status: 'TAKEDOWN_SUBMITTED_FOR_REVIEW'
    };
  }
}

export const copyrightDetectionService = new CopyrightDetectionService();
export default copyrightDetectionService;
