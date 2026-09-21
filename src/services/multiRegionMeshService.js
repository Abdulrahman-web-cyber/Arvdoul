// src/services/multiRegionMeshService.js

import { logger } from '../utils/Logger.js';

export const CIRCUIT_STATE = {
  CLOSED: 'CLOSED',       // Normal operation, all traffic routed
  OPEN: 'OPEN',           // Tripped, failing fast to fallback
  HALF_OPEN: 'HALF_OPEN', // Probing upstream recovery with limited requests
};

export const REGIONS = {
  US_PRIMARY: { id: 'us-central1', name: 'Americas (Iowa)', isPrimary: true },
  EU_STANDBY: { id: 'europe-west3', name: 'Europe (Frankfurt)', isPrimary: false },
  ASIA_STANDBY: { id: 'asia-northeast1', name: 'Asia-Pacific (Tokyo)', isPrimary: false },
};

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 5000;
    this.successThreshold = options.successThreshold || 2;

    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  async execute(action, fallback = null) {
    // Check if OPEN state can transition to HALF_OPEN
    if (this.state === CIRCUIT_STATE.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CIRCUIT_STATE.HALF_OPEN;
        this.successCount = 0;
        logger.warn(`[CircuitBreaker:${this.name}] Transitioned from OPEN to HALF_OPEN`);
      } else {
        // Fast-fail to fallback
        if (fallback) return fallback(new Error(`Circuit ${this.name} is OPEN`));
        throw new Error(`CircuitBreaker '${this.name}' is OPEN (fast-fail)`);
      }
    }

    try {
      const result = await action();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      if (fallback) return fallback(err);
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CIRCUIT_STATE.CLOSED;
        logger.info(`[CircuitBreaker:${this.name}] Circuit recovered to CLOSED`);
      }
    }
  }

  _onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_STATE.CLOSED && this.failureCount >= this.failureThreshold) {
      this.state = CIRCUIT_STATE.OPEN;
      logger.error(`[CircuitBreaker:${this.name}] Failure threshold reached. Circuit tripped to OPEN: ${err.message}`);
    } else if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.state = CIRCUIT_STATE.OPEN;
      logger.error(`[CircuitBreaker:${this.name}] Probe failed in HALF_OPEN. Tripped back to OPEN: ${err.message}`);
    }
  }
}

export class MultiRegionMeshService {
  constructor() {
    this.activeRegion = REGIONS.US_PRIMARY.id;
    this.regions = new Map(Object.values(REGIONS).map(r => [r.id, { ...r, isHealthy: true, latencyMs: 25 }]));
    this.circuitBreakers = new Map();
    this.maintenanceMode = false;
    this.readOnlyMode = false;
  }

  getCircuitBreaker(serviceName, options = {}) {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, options));
    }
    return this.circuitBreakers.get(serviceName);
  }

  /**
   * Evaluates regional node latencies and triggers automated failover if needed.
   */
  reportRegionHealth(regionId, { isHealthy, latencyMs = 50 } = {}) {
    const region = this.regions.get(regionId);
    if (!region) throw new Error(`Unknown region ${regionId}`);

    region.isHealthy = Boolean(isHealthy);
    region.latencyMs = latencyMs;

    // Failover trigger: If currently active region goes down, failover to lowest-latency healthy standby
    if (this.activeRegion === regionId && !isHealthy) {
      const healthyStandby = Array.from(this.regions.values())
        .filter(r => r.id !== regionId && r.isHealthy)
        .sort((a, b) => a.latencyMs - b.latencyMs)[0];

      if (healthyStandby) {
        const previousRegion = this.activeRegion;
        this.activeRegion = healthyStandby.id;
        logger.warn(`[MultiRegionMesh] Failover triggered: ${previousRegion} ➔ ${this.activeRegion} (${healthyStandby.name})`);
        return { failedOver: true, newRegion: this.activeRegion, reason: 'PRIMARY_OUTAGE' };
      } else {
        // All regions degraded, trip read-only mode
        this.readOnlyMode = true;
        logger.error('[MultiRegionMesh] All multi-region nodes degraded! Emergency read-only mode activated');
        return { failedOver: false, readOnlyMode: true, reason: 'GLOBAL_DEGRADATION' };
      }
    }

    return { failedOver: false, activeRegion: this.activeRegion };
  }

  /**
   * Sets maintenance mode or read-only emergency state.
   */
  setMaintenanceMode(enabled, { readOnly = false, broadcastMessage = '' } = {}) {
    this.maintenanceMode = Boolean(enabled);
    this.readOnlyMode = Boolean(readOnly);
    this.broadcastMessage = broadcastMessage;
    logger.info(`[MultiRegionMesh] Maintenance mode=${this.maintenanceMode}, readOnly=${this.readOnlyMode}`);
    return {
      maintenanceMode: this.maintenanceMode,
      readOnlyMode: this.readOnlyMode,
      broadcastMessage: this.broadcastMessage,
    };
  }

  /**
   * Gets current operational snapshot.
   */
  getMeshStatus() {
    return {
      activeRegion: this.activeRegion,
      regions: Array.from(this.regions.values()),
      maintenanceMode: this.maintenanceMode,
      readOnlyMode: this.readOnlyMode,
      circuits: Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
        name,
        state: cb.state,
        failureCount: cb.failureCount,
      })),
    };
  }
}

export const multiRegionMeshService = new MultiRegionMeshService();
export default multiRegionMeshService;
