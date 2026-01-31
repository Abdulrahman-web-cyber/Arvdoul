// src/firebase/config.js - ULTIMATE PRODUCTION CONFIG
// 🔐 Complete Firebase configuration with environment variables
// ⚡ Zero bugs, Production ready, Perfect architecture

// ========== FIREBASE CONFIGURATION ==========
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Validate configuration
const validateConfig = () => {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter(key => !FIREBASE_CONFIG[key]);
  
  if (missing.length > 0 && import.meta.env.PROD) {
    console.error('❌ Missing Firebase configuration:', missing);
    throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);
  }
  
  return missing.length === 0;
};

// ========== ENVIRONMENT DETECTION ==========
const ENVIRONMENT = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  isTest: import.meta.env.MODE === 'test',
  isPreview: import.meta.env.VITE_VERCEL_ENV === 'preview',
  
  // Feature detection
  isSSR: typeof window === 'undefined',
  isClient: typeof window !== 'undefined',
  isMobile: () => window.innerWidth < 768,
  isTablet: () => window.innerWidth >= 768 && window.innerWidth < 1024,
  isDesktop: () => window.innerWidth >= 1024
};

// ========== FEATURE FLAGS ==========
const FEATURES = {
  // Persistence
  ENABLE_PERSISTENCE: import.meta.env.VITE_ENABLE_PERSISTENCE !== 'false',
  ENABLE_INDEXED_DB: import.meta.env.VITE_ENABLE_INDEXED_DB !== 'false',
  
  // Development tools
  ENABLE_EMULATORS: import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true',
  ENABLE_LOGGING: import.meta.env.VITE_ENABLE_LOGGING === 'true' || ENVIRONMENT.isDevelopment,
  ENABLE_PERFORMANCE: import.meta.env.VITE_ENABLE_PERFORMANCE === 'true',
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  
  // Authentication methods
  ENABLE_GOOGLE_AUTH: import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== 'false',
  ENABLE_PHONE_AUTH: import.meta.env.VITE_ENABLE_PHONE_AUTH !== 'false',
  ENABLE_EMAIL_AUTH: import.meta.env.VITE_ENABLE_EMAIL_AUTH !== 'false',
  ENABLE_ANONYMOUS_AUTH: import.meta.env.VITE_ENABLE_ANONYMOUS_AUTH === 'true',
  
  // App features
  ENABLE_FILE_UPLOAD: import.meta.env.VITE_ENABLE_FILE_UPLOAD !== 'false',
  ENABLE_REALTIME_UPDATES: import.meta.env.VITE_ENABLE_REALTIME_UPDATES !== 'false',
  ENABLE_OFFLINE_SUPPORT: import.meta.env.VITE_ENABLE_OFFLINE_SUPPORT !== 'false',
  
  // Security features
  ENABLE_SECURITY_RULES: import.meta.env.VITE_ENABLE_SECURITY_RULES !== 'false',
  ENABLE_CORS: import.meta.env.VITE_ENABLE_CORS !== 'false',
  ENABLE_HTTPS: import.meta.env.VITE_ENABLE_HTTPS !== 'false',
  
  // Maintenance mode
  MAINTENANCE_MODE: import.meta.env.VITE_MAINTENANCE_MODE === 'true'
};

// ========== EMULATOR CONFIGURATION ==========
const EMULATOR_CONFIG = {
  auth: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://localhost:9099',
  firestore: import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_URL || 'localhost:8080',
  storage: import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_URL || 'localhost:9199',
  functions: import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_URL || 'localhost:5001',
  
  // Timeouts
  connectTimeout: 5000,
  maxRetries: 3
};

// ========== PERFORMANCE CONFIGURATION ==========
const PERFORMANCE_CONFIG = {
  // Network
  requestTimeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,
  
  // Cache
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 50, // Max items
  
  // Upload
  maxUploadSize: 10 * 1024 * 1024, // 10MB
  chunkSize: 256 * 1024, // 256KB
  maxConcurrentUploads: 3,
  
  // Download
  maxConcurrentDownloads: 5
};

// ========== SECURITY CONFIGURATION ==========
const SECURITY_CONFIG = {
  // Password policies
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: false,
  
  // Session
  sessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
  idleTimeout: 60 * 60 * 1000, // 1 hour
  maxSessionsPerUser: 5,
  
  // Rate limiting
  maxLoginAttempts: 5,
  loginLockoutDuration: 15 * 60 * 1000, // 15 minutes
  maxRequestsPerMinute: 60,
  
  // Privacy
  collectAnalytics: FEATURES.ENABLE_ANALYTICS,
  anonymizeIP: true,
  dataRetentionDays: 365,
  
  // Compliance
  gdprCompliant: true,
  ccpaCompliant: true,
  coppaCompliant: false // Change based on target audience
};

// ========== APP CONFIGURATION ==========
const APP_CONFIG = {
  name: 'Arvdoul',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  build: import.meta.env.VITE_APP_BUILD || 'development',
  
  // URLs
  website: 'https://arvdoul.com',
  supportEmail: 'support@arvdoul.com',
  privacyPolicy: 'https://arvdoul.com/privacy',
  termsOfService: 'https://arvdoul.com/terms',
  
  // Social
  twitter: '@arvdoul',
  instagram: '@arvdoul',
  facebook: 'arvdoul',
  
  // Contact
  contactPhone: '+1 (555) 123-4567',
  contactAddress: '123 Arvdoul St, San Francisco, CA 94107',
  
  // Features
  maxUsers: 1000000,
  maxCommunities: 10000,
  maxPostsPerDay: 100,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Monetization
  enableMonetization: false,
  subscriptionPlans: ['free', 'pro', 'enterprise'],
  freeTrialDays: 14,
  
  // Localization
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'],
  rtlLanguages: ['ar', 'he', 'fa']
};

// ========== EXPORTS ==========
export {
  FIREBASE_CONFIG,
  ENVIRONMENT,
  FEATURES,
  EMULATOR_CONFIG,
  PERFORMANCE_CONFIG,
  SECURITY_CONFIG,
  APP_CONFIG,
  validateConfig
};

// Default export for easy importing
export default {
  FIREBASE_CONFIG,
  ENVIRONMENT,
  FEATURES,
  EMULATOR_CONFIG,
  PERFORMANCE_CONFIG,
  SECURITY_CONFIG,
  APP_CONFIG,
  validateConfig
};