/**
 * jest.config.cjs - ARVDOUL test configuration (production-grade)
 *
 * - jsdom environment for component + service tests
 * - Shared setup file with polyfills (see tests/jest.setup.js)
 * - Coverage thresholds are ENFORCED: the `test:coverage` script fails the
 *   build when global coverage drops below the configured floor. These floors
 *   are raised as suites grow (see docs/ENGINEERING_READINESS.md for the ramp).
 */
module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/functions/'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/services/**/*.js',
    'src/utils/**/*.js',
    'src/lib/**/*.js',
    'src/moderation/**/*.js',
    'src/scalability/**/*.js',
    'src/offline/**/*.js',
    '!src/**/Gaps.js',
    '!src/**/realIntegration.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
  // ENFORCED coverage floor. Ramps up per quarter; do not lower without a
  // documented engineering decision. Baselines verified 2026-08-20 with the
  // full-service collectCoverageFrom (all 104 services counted).
  coverageThreshold: {
    global: {
      statements: 11,
      branches: 9,
      functions: 10,
      lines: 12,
    },
    // Per-file floors on the core files we actively test. These PROTECT
    // against regression: any change that drops a core file below its floor
    // fails CI. Raise them as suites grow.
    'src/utils/CacheManager.js': { statements: 45 },
    'src/utils/IdempotencyKey.js': { statements: 75 },
    'src/utils/Logger.js': { statements: 70 },
    'src/services/metricsService.js': { statements: 80 },
    'src/services/fraudDetectionService.js': { statements: 80 },
    'src/services/costOptimizationService.js': { statements: 80 },
    'src/services/extremismDetectionService.js': { statements: 80 },
    'src/services/viralPredictionService.js': { statements: 80 },
    'src/services/vendorManagementService.js': { statements: 80 },
    'src/services/sessionSecurityService.js': { statements: 80 },
    'src/services/validationService.js': { statements: 80 },
    'src/services/soundService.js': { statements: 80 },
    'src/services/selfHarmDetectionService.js': { statements: 80 },
    'src/services/searchAbuseService.js': { statements: 80 },
    'src/services/searchIndexingService.js': { statements: 75 },
    'src/services/safeSearchService.js': { statements: 75 },
    'src/services/phishingDetectionService.js': { statements: 75 },
    'src/services/textModerationService.js': { statements: 70 },
    'src/services/sanitizationService.js': { statements: 70 },
    'src/services/copyrightDetectionService.js': { statements: 70 },
    'src/services/AggregationCacheService.js': { statements: 75 },
    'src/services/disasterRecoveryService.js': { statements: 75 },
  },
};
