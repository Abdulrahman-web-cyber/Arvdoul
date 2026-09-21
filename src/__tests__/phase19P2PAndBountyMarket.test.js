// src/__tests__/phase19P2PAndBountyMarket.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DecentralizedStorageMeshService, PINNING_TIERS } from '../services/decentralizedStorageMeshService.js';
import { DecentralizedBountyMarketService, BOUNTY_STATUS, BOUNTY_CATEGORIES } from '../services/decentralizedBountyMarketService.js';

describe('Phase 19: Decentralized Storage Mesh & Creator Bounty Marketplace', () => {
  let storageMesh;
  let bountyMarket;

  beforeEach(() => {
    storageMesh = new DecentralizedStorageMeshService(1024); // 1KB test chunk size
    bountyMarket = new DecentralizedBountyMarketService(5);   // 5% platform fee
  });

  describe('1. Content-Addressed P2P Storage Mesh (Feature 56)', () => {
    it('generates deterministic CIDs and chunks incoming media payloads', () => {
      const payload = 'A'.repeat(2500); // 2.5KB = 3 chunks
      const result = storageMesh.ingestContent({
        contentId: 'reel_4k_viral',
        creatorId: 'creator_alice',
        data: payload,
        pinningTier: PINNING_TIERS.CREATOR_PINNED,
      });

      expect(result.cid).toMatch(/^bafybei_/);
      expect(result.totalSize).toBe(2500);
      expect(result.totalChunks).toBe(3);
    });

    it('tracks peer chunk bitfields and identifies chunk providers', () => {
      const payload = 'B'.repeat(3000);
      const { cid } = storageMesh.ingestContent({
        contentId: 'podcast_master',
        creatorId: 'host_bob',
        data: payload,
      });

      // Peers seed different chunks
      storageMesh.seedChunk('peer_nyc_1', cid, 0);
      storageMesh.seedChunk('peer_berlin_2', cid, 0);
      storageMesh.seedChunk('peer_berlin_2', cid, 1);

      const chunk0Providers = storageMesh.findChunkProviders(cid, 0);
      expect(chunk0Providers.totalHolders).toBe(2);
      expect(chunk0Providers.providerPeerIds).toContain('peer_nyc_1');
      expect(chunk0Providers.providerPeerIds).toContain('peer_berlin_2');

      const chunk1Providers = storageMesh.findChunkProviders(cid, 1);
      expect(chunk1Providers.totalHolders).toBe(1);
      expect(chunk1Providers.providerPeerIds).toContain('peer_berlin_2');
    });

    it('records P2P transfers and accurately calculates offload telemetry', () => {
      const payload = 'C'.repeat(4000);
      const { cid } = storageMesh.ingestContent({
        contentId: 'live_concert',
        creatorId: 'artist_dave',
        data: payload,
      });

      storageMesh.recordP2PTransfer(cid, 'peer_node_a', 'peer_node_b', 1000);
      storageMesh.recordP2PTransfer(cid, 'peer_node_a', 'peer_node_c', 1000);

      const telemetry = storageMesh.getMeshTelemetry();
      expect(telemetry.totalStoredBytes).toBe(4000);
      expect(telemetry.totalP2PSavedBytes).toBe(2000);
      expect(telemetry.bandwidthOffloadRatio).toBeGreaterThan(0);
    });
  });

  describe('2. Creator Bounty & Freelance Marketplace (Feature 57)', () => {
    it('creates bounties with escrow lock and assigns workers', () => {
      const bounty = bountyMarket.createBounty({
        creatorId: 'channel_lead',
        title: 'Edit 60-Second Short',
        category: BOUNTY_CATEGORIES.VIDEO_EDITING,
        rewardAmount: 500,
        currency: 'COINS',
      });

      expect(bounty.status).toBe(BOUNTY_STATUS.OPEN);
      expect(bounty.escrowLocked).toBe(true);

      const claimed = bountyMarket.claimBounty(bounty.id, 'editor_pro');
      expect(claimed.status).toBe(BOUNTY_STATUS.IN_PROGRESS);
      expect(claimed.assignedWorkerId).toBe('editor_pro');
    });

    it('manages deliverable review and executes zero-remainder fee settlement', () => {
      const bounty = bountyMarket.createBounty({
        creatorId: 'director_sam',
        title: 'Master Audio Track',
        rewardAmount: 1000,
      });

      bountyMarket.claimBounty(bounty.id, 'sound_eng');
      bountyMarket.submitWork(bounty.id, 'sound_eng', {
        deliverableUrl: 'https://cdn.arvdoul.network/renders/track1.flac',
        notes: 'Normalized to -14 LUFS',
      });

      const approved = bountyMarket.approveSubmission(bounty.id, 'director_sam', 5);
      expect(approved.status).toBe(BOUNTY_STATUS.APPROVED);
      expect(approved.escrowLocked).toBe(false);
      expect(approved.payout.platformFee).toBe(50); // 5% of 1000
      expect(approved.payout.workerPayout).toBe(950);
      expect(bountyMarket.getWorkerReputation('sound_eng')).toBeGreaterThan(50);
    });

    it('enforces access control on disputes and work submissions', () => {
      const bounty = bountyMarket.createBounty({
        creatorId: 'vlogger_jen',
        title: 'Design 3D Logo',
        rewardAmount: 300,
      });

      bountyMarket.claimBounty(bounty.id, 'designer_tim');

      // Random user cannot submit work
      expect(() => {
        bountyMarket.submitWork(bounty.id, 'unrelated_impostor', { deliverableUrl: 'url' });
      }).toThrow('Only the assigned worker');

      // Random user cannot dispute
      expect(() => {
        bountyMarket.disputeBounty(bounty.id, 'random_bystander', 'Spam work');
      }).toThrow('Only parties involved');
    });
  });
});
