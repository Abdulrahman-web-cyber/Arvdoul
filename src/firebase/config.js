// src/firebase/config.js - ENTERPRISE CONFIGURATION MANAGER
// 🔧 Dynamic Configuration • Environment Detection • Security Validation
// 🛡️ Secret Rotation • Runtime Configuration • Multi-environment Support

// ==================== ENVIRONMENT DETECTION ====================
const ENVIRONMENTS = {
  LOCAL: 'local',
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
};

const detectEnvironment = () => {
  const hostname = window.location.hostname;
  const origin = window.location.origin;
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return ENVIRONMENTS.LOCAL;
  }
  
  // Development domains
  if (hostname.includes('dev.') || hostname.includes('.dev.')) {
    return ENVIRONMENTS.DEVELOPMENT;
  }
  
  // Staging domains
  if (hostname.includes('staging.') || hostname.includes('stag.') || hostname.includes('.stage.')) {
    return ENVIRONMENTS.STAGING;
  }
  
  // Test environment
  if (hostname.includes('test.') || hostname.includes('.test.')) {
    return ENVIRONMENTS.TEST;
  }
  
  // Production (default)
  return ENVIRONMENTS.PRODUCTION;
};

// ==================== CONFIGURATION VALIDATOR ====================
class ConfigValidator {
  static validateFirebaseConfig(config) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    required.forEach(field => {
      if (!config[field]) {
        errors.push(`Missing required Firebase config: ${field}`);
      }
    });
    
    // Format validation
    if (config.apiKey && !config.apiKey.startsWith('AIza')) {
      warnings.push('Firebase API key format appears invalid');
    }
    
    if (config.authDomain && !config.authDomain.includes('firebaseapp.com')) {
      warnings.push('Firebase auth domain format appears unusual');
    }
    
    // Security warnings for development
    if (detectEnvironment() !== ENVIRONMENTS.PRODUCTION) {
      if (config.apiKey?.includes('production-key')) {
        warnings.push('Using production API key in non-production environment');
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }
  
  static validateRecaptchaConfig(config) {
    const errors = [];
    
    if (config.enableRecaptchaEnterprise && !config.recaptchaSiteKey) {
      errors.push('Recaptcha Enterprise enabled but no site key provided');
    }
    
    if (config.enableAppCheck && !config.appCheckDebugToken && detectEnvironment() === ENVIRONMENTS.LOCAL) {
      warnings.push('AppCheck enabled in local environment without debug token');
    }
    
    return { valid: errors.length === 0, errors };
  }
}

// ==================== CONFIGURATION MANAGER ====================
class FirebaseConfigManager {
  constructor() {
    this.environment = detectEnvironment();
    this.config = this.loadConfig();
    this.secrets = this.loadSecrets();
    this.validators = [ConfigValidator];
    this.configVersion = '2.0.0';
    this.lastUpdated = Date.now();
    this.rotationSchedule = this.getRotationSchedule();
    
    console.log(`🔥 Firebase Config Manager initialized for ${this.environment.toUpperCase()} environment`);
  }
  
  loadConfig() {
    const baseConfig = {
      // Environment-specific overrides
      [ENVIRONMENTS.LOCAL]: {
        advancedSettings: {
          persistence: 'SESSION',
          dataCollection: false,
          analyticsCollection: false,
          appCheckDebugToken: import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || 'debug-token'
        },
        security: {
          enableAppCheck: true,
          enableRecaptchaEnterprise: false,
          enableDebugTokens: true
        }
      },
      [ENVIRONMENTS.DEVELOPMENT]: {
        advancedSettings: {
          persistence: 'LOCAL',
          dataCollection: true,
          analyticsCollection: true,
          appCheckDebugToken: null
        },
        security: {
          enableAppCheck: true,
          enableRecaptchaEnterprise: true,
          enableDebugTokens: false
        }
      },
      [ENVIRONMENTS.STAGING]: {
        advancedSettings: {
          persistence: 'LOCAL',
          dataCollection: true,
          analyticsCollection: true,
          appCheckDebugToken: null
        },
        security: {
          enableAppCheck: true,
          enableRecaptchaEnterprise: true,
          enableDebugTokens: false
        }
      },
      [ENVIRONMENTS.PRODUCTION]: {
        advancedSettings: {
          persistence: 'LOCAL',
          dataCollection: true,
          analyticsCollection: true,
          appCheckDebugToken: null
        },
        security: {
          enableAppCheck: true,
          enableRecaptchaEnterprise: true,
          enableDebugTokens: false
        },
        performance: {
          maxOperationRetries: 5,
          operationTimeout: 60000,
          cacheSizeBytes: 100 * 1024 * 1024 // 100MB for production
        }
      }
    };
    
    // Load environment variables
    const envConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
      
      // Additional configurations
      recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
      appCheckSiteKey: import.meta.env.VITE_APP_CHECK_SITE_KEY,
      enableEmulator: import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
    };
    
    // Merge configurations
    const mergedConfig = {
      ...envConfig,
      ...(baseConfig[this.environment] || {}),
      environment: this.environment,
      configVersion: this.configVersion
    };
    
    // Validate configuration
    const validation = ConfigValidator.validateFirebaseConfig(mergedConfig);
    if (!validation.valid) {
      console.error('Firebase configuration validation failed:', validation.errors);
      throw new Error(`Invalid Firebase configuration: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      console.warn('Firebase configuration warnings:', validation.warnings);
    }
    
    return mergedConfig;
  }
  
  loadSecrets() {
    // In production, this would fetch from a secure source
    // For now, we use environment variables
    return {
      firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      recaptchaSecret: import.meta.env.VITE_RECAPTCHA_SECRET_KEY,
      appCheckSecret: import.meta.env.VITE_APP_CHECK_SECRET
    };
  }
  
  getRotationSchedule() {
    const schedule = {
      apiKey: this.environment === ENVIRONMENTS.PRODUCTION ? 90 : 180, // days
      recaptchaKey: 365,
      appCheckToken: 30
    };
    
    return schedule;
  }
  
  getFullConfig() {
    return {
      ...this.config,
      secrets: {
        // Never expose actual secrets
        hasSecrets: !!this.secrets.firebaseApiKey
      },
      meta: {
        environment: this.environment,
        version: this.configVersion,
        lastUpdated: this.lastUpdated,
        rotationSchedule: this.rotationSchedule
      }
    };
  }
  
  getPublicConfig() {
    // Only expose non-sensitive configuration
    const { secrets, ...publicConfig } = this.config;
    return {
      ...publicConfig,
      meta: {
        environment: this.environment,
        version: this.configVersion
      }
    };
  }
  
  async rotateSecret(secretName) {
    console.log(`Rotating secret: ${secretName}`);
    
    // In a real implementation, this would:
    // 1. Generate new secret
    // 2. Update in secure store
    // 3. Update Firebase project
    // 4. Return new secret
    
    // For now, return a mock response
    return {
      success: true,
      message: `Secret ${secretName} rotation initiated`,
      newSecret: `new_${secretName}_${Date.now()}`,
      rotationDate: new Date().toISOString()
    };
  }
  
  validateConfig() {
    const validations = this.validators.map(Validator => 
      Validator.validateFirebaseConfig(this.config)
    );
    
    const allValid = validations.every(v => v.valid);
    const allErrors = validations.flatMap(v => v.errors || []);
    const allWarnings = validations.flatMap(v => v.warnings || []);
    
    return {
      valid: allValid,
      errors: allErrors,
      warnings: allWarnings,
      timestamp: Date.now()
    };
  }
  
  // Hot reload configuration (for development)
  async reloadConfig() {
    console.log('Reloading Firebase configuration...');
    this.config = this.loadConfig();
    this.lastUpdated = Date.now();
    return this.validateConfig();
  }
  
  // Get emulator configuration if enabled
  getEmulatorConfig() {
    if (!this.config.enableEmulator) return null;
    
    return {
      auth: `http://localhost:9099`,
      firestore: `http://localhost:8080`,
      storage: `http://localhost:9199`,
      functions: `http://localhost:5001`,
      database: `http://localhost:9000`
    };
  }
}

// ==================== SINGLETON INSTANCE ====================
let configManagerInstance = null;

function getConfigManager() {
  if (!configManagerInstance) {
    configManagerInstance = new FirebaseConfigManager();
  }
  return configManagerInstance;
}

// ==================== EXPORTS ====================
export {
  getConfigManager,
  ENVIRONMENTS,
  ConfigValidator
};

// Default export
export default getConfigManager();

// ==================== CONFIGURATION HELPER FUNCTIONS ====================
export function getFirebaseConfig() {
  const manager = getConfigManager();
  return manager.getPublicConfig();
}

export function getEnvironment() {
  const manager = getConfigManager();
  return manager.environment;
}

export function isDevelopment() {
  return getEnvironment() === ENVIRONMENTS.DEVELOPMENT || getEnvironment() === ENVIRONMENTS.LOCAL;
}

export function isProduction() {
  return getEnvironment() === ENVIRONMENTS.PRODUCTION;
}

export function shouldUseEmulator() {
  const manager = getConfigManager();
  return manager.config.enableEmulator && isDevelopment();
}

// ==================== RUNTIME CONFIGURATION ====================
// Allow runtime configuration updates (for feature flags, etc.)
export function updateRuntimeConfig(updates) {
  const manager = getConfigManager();
  manager.config = {
    ...manager.config,
    ...updates,
    lastRuntimeUpdate: Date.now()
  };
  
  console.log('Runtime configuration updated:', updates);
  return manager.validateConfig();
}

// ==================== CONFIGURATION VERSIONING ====================
export function getConfigVersion() {
  const manager = getConfigManager();
  return {
    version: manager.configVersion,
    environment: manager.environment,
    lastUpdated: manager.lastUpdated
  };
}

// ==================== SECURITY HELPER ====================
export function maskSensitiveData(data) {
  if (typeof data !== 'string') return '[MASKED]';
  
  // Mask API keys, tokens, etc.
  const patterns = [
    { regex: /AIza[0-9A-Za-z\-_]{35}/g, replacement: '[API_KEY]' },
    { regex: /sk_[0-9a-zA-Z]{24}/g, replacement: '[SECRET_KEY]' },
    { regex: /[0-9a-f]{64}/g, replacement: '[HASH]' },
    { regex: /-----BEGIN.*?-----/gs, replacement: '[PRIVATE_KEY]' }
  ];
  
  let masked = data;
  patterns.forEach(({ regex, replacement }) => {
    masked = masked.replace(regex, replacement);
  });
  
  return masked;
}

// ==================== ENVIRONMENT SPECIFIC FEATURES ====================
export function getEnvironmentFeatures() {
  const env = getEnvironment();
  
  const features = {
    [ENVIRONMENTS.LOCAL]: {
      enableDebugTools: true,
      enableEmulator: true,
      enableVerboseLogging: true,
      enablePerformanceTracking: false,
      enableAnalytics: false
    },
    [ENVIRONMENTS.DEVELOPMENT]: {
      enableDebugTools: true,
      enableEmulator: false,
      enableVerboseLogging: true,
      enablePerformanceTracking: true,
      enableAnalytics: true
    },
    [ENVIRONMENTS.STAGING]: {
      enableDebugTools: false,
      enableEmulator: false,
      enableVerboseLogging: false,
      enablePerformanceTracking: true,
      enableAnalytics: true
    },
    [ENVIRONMENTS.PRODUCTION]: {
      enableDebugTools: false,
      enableEmulator: false,
      enableVerboseLogging: false,
      enablePerformanceTracking: true,
      enableAnalytics: true
    }
  };
  
  return features[env] || features[ENVIRONMENTS.PRODUCTION];
}

// ==================== AUTOMATIC CONFIGURATION SETUP ====================
// Setup configuration based on environment
if (typeof window !== 'undefined') {
  const manager = getConfigManager();
  const validation = manager.validateConfig();
  
  if (!validation.valid) {
    console.error('Firebase configuration failed validation:', validation.errors);
    
    // In production, we might want to fail fast
    if (isProduction()) {
      throw new Error('Firebase configuration invalid. Please check environment variables.');
    }
  }
  
  // Expose configuration for debugging (development only)
  if (isDevelopment()) {
    window.firebaseConfig = manager.getPublicConfig();
    window.firebaseEnvironment = getEnvironment();
    window.firebaseFeatures = getEnvironmentFeatures();
  }
  
  // Log configuration status
  console.group('🔥 Firebase Configuration');
  console.log('Environment:', getEnvironment());
  console.log('Version:', getConfigVersion().version);
  console.log('Valid:', validation.valid);
  console.log('Features:', getEnvironmentFeatures());
  console.groupEnd();
}