// src/services/decentralizedStorageMeshService.js

import { logger } from '../utils/Logger.js';

export const PINNING_TIERS = {
  EPHEMERAL: 'EPHEMERAL',       // Cached on active viewer nodes only
  CREATOR_PINNED: 'CREATOR_PINNED', // Kept alive by creator nodes
  PERSISTENT_ARCHIVE: 'PERSISTENT_ARCHIVE', // Cold-storage / Arweave / Filecoin backed
};

export class DecentralizedStorageMeshService {
  constructor(chunkSizeBytes = 64 * 1024) { // 64KB chunks for audio/video streaming
    this.chunkSizeBytes = chunkSizeBytes;
    this.cidRegistry = new Map(); // cid -> metadata & chunks
    this.activePeers = new Map(); // peerId -> { bitfields, bandwidthContributed }
  }

  /**
   * Generates deterministic CIDv1 identifier from content payload.
   */
  _computeCID(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(12, '0');
    return `bafybei_${hex}_${raw.length}`;
  }

  /**
   * Ingests, slices into deterministic chunks, and registers content in decentralized mesh.
   */
  ingestContent({
    contentId,
    creatorId,
    mimeType = 'video/mp4',
    data, // string or buffer
    pinningTier = PINNING_TIERS.CREATOR_PINNED,
  }) {
    if (!contentId || !creatorId || !data) {
      throw new Error('contentId, creatorId, and data are required');
    }

    const cid = this._computeCID(data);
    const rawString = typeof data === 'string' ? data : JSON.stringify(data);
    const totalSize = rawString.length;

    // Slice into chunks
    const chunks = [];
    let offset = 0;
    let index = 0;
    while (offset < totalSize) {
      const chunkData = rawString.slice(offset, offset + this.chunkSizeBytes);
      chunks.push({
        index,
        offset,
        size: chunkData.length,
        hash: this._computeCID(chunkData),
      });
      offset += this.chunkSizeBytes;
      index++;
    }

    const record = {
      cid,
      contentId,
      creatorId,
      mimeType,
      totalSize,
      totalChunks: chunks.length,
      chunks,
      pinningTier,
      pinnedNodes: new Set([creatorId]),
      p2pBandwidthSavedBytes: 0,
      createdAt: Date.now(),
    };

    this.cidRegistry.set(cid, record);
    logger.info(`[StorageMesh] Content ${contentId} ingested as CID ${cid} (${chunks.length} chunks, ${totalSize} bytes)`);
    return {
      cid,
      contentId,
      totalSize,
      totalChunks: chunks.length,
      pinningTier,
    };
  }

  /**
   * Registers a peer node with their chunk availability bitfield.
   */
  registerPeer(peerId) {
    if (!this.activePeers.has(peerId)) {
      this.activePeers.set(peerId, {
        peerId,
        availableCids: new Map(), // cid -> Set of chunk indices
        bandwidthContributedBytes: 0,
        lastSeenAt: Date.now(),
      });
    }
    return this.activePeers.get(peerId);
  }

  /**
   * Records that a peer node has fetched/seeded a specific chunk.
   */
  seedChunk(peerId, cid, chunkIndex) {
    const peer = this.registerPeer(peerId);
    if (!peer.availableCids.has(cid)) {
      peer.availableCids.set(cid, new Set());
    }
    peer.availableCids.get(cid).add(chunkIndex);

    const record = this.cidRegistry.get(cid);
    if (record) {
      record.pinnedNodes.add(peerId);
    }
  }

  /**
   * Locates peers that possess a required chunk, enabling P2P peer-assisted retrieval.
   */
  findChunkProviders(cid, chunkIndex) {
    const record = this.cidRegistry.get(cid);
    if (!record) throw new Error('CID not found in mesh');

    const providers = [];
    for (const [peerId, peer] of this.activePeers.entries()) {
      const chunksHeld = peer.availableCids.get(cid);
      if (chunksHeld && chunksHeld.has(chunkIndex)) {
        providers.push(peerId);
      }
    }

    return {
      cid,
      chunkIndex,
      totalHolders: providers.length,
      providerPeerIds: providers,
      originFallback: record.creatorId,
    };
  }

  /**
   * Records a P2P data transfer between viewer nodes, crediting bandwidth savings.
   */
  recordP2PTransfer(cid, servingPeerId, receivingPeerId, bytesTransferred) {
    const record = this.cidRegistry.get(cid);
    if (record) {
      record.p2pBandwidthSavedBytes += bytesTransferred;
    }

    const peer = this.activePeers.get(servingPeerId);
    if (peer) {
      peer.bandwidthContributedBytes += bytesTransferred;
    }

    logger.info(`[StorageMesh] P2P transfer: ${servingPeerId} ➔ ${receivingPeerId} (${bytesTransferred} bytes of CID ${cid})`);
    return {
      cid,
      bytesTransferred,
      totalSavedForCid: record ? record.p2pBandwidthSavedBytes : bytesTransferred,
    };
  }

  /**
   * Retrieves summary telemetry of decentralized storage distribution.
   */
  getMeshTelemetry() {
    let totalStoredBytes = 0;
    let totalP2PSavedBytes = 0;

    for (const record of this.cidRegistry.values()) {
      totalStoredBytes += record.totalSize;
      totalP2PSavedBytes += record.p2pBandwidthSavedBytes;
    }

    return {
      totalCids: this.cidRegistry.size,
      totalPeers: this.activePeers.size,
      totalStoredBytes,
      totalP2PSavedBytes,
      bandwidthOffloadRatio: totalStoredBytes > 0
        ? Number(((totalP2PSavedBytes / (totalStoredBytes + totalP2PSavedBytes)) * 100).toFixed(1))
        : 0,
    };
  }
}

export const decentralizedStorageMeshService = new DecentralizedStorageMeshService();
export default decentralizedStorageMeshService;
