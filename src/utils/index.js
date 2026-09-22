/**
 * src/utils/index.js - ARVDOUL Shared Utilities Barrel
 *
 * Central entry point for the service-layer infrastructure utilities
 * required by the refactoring program (see REFACTOR_PROGRESS.md).
 */

export { Logger, logger, setCorrelationId, getCorrelationId, LOG_LEVELS } from './Logger.js';
export { auditLogger } from './AuditLogger.js';
export { rateLimiter } from './RateLimiter.js';
export { idempotencyStore } from './IdempotencyKey.js';
export { CacheManager, cacheManager } from './CacheManager.js';
export { CountersManager, countersManager } from './CountersManager.js';
export { offlineQueue } from './OfflineQueue.js';
export { ErrorHandler, errorHandler, ERROR_RANGES } from './ErrorHandler.js';
export { featureFlags } from './featureFlags.js';
