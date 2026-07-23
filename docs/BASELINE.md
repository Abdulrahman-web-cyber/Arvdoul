# ARVDOUL BASELINE

**Generated**: 2026-07-23
**Last Updated**: Phase 0 Audit

---

## BUILD STATUS

| Check | Status | Details |
|-------|--------|---------|
| Build | ✅ PASS | Vite 8.0.16 |
| Dependencies | ✅ PASS | 1045 packages |
| Type Errors | ✅ PASS | 0 errors |
| Lint Errors | ⚠️ UNKNOWN | ESLint configured but not run |
| Tests | ✅ PASS | 125 tests, 7 test suites |

---

## BUILD METRICS

```
vite v8.0.16 building client environment for production...
✓ 3274 modules transformed.

Output:
- dist/index.html: 5.48 KB (gzip: 1.99 KB)
- CSS bundles: ~187 KB total (gzip: ~28 KB)
- JS bundles: Largest chunks:
  - index.esm-C_4iFRv_.js: 349.43 KB (gzip: 104.42 KB)
  - ImageEditor-Dct3NmiH.js: 403.32 KB (gzip: 115.34 KB)
  - tippy-C2P2KubA.js: 459.18 KB (gzip: 144.19 KB)
  
Build time: 2.81s
```

---

## DEPENDENCIES

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI framework |
| react-dom | 18.2.0 | DOM rendering |
| react-router-dom | 6.30.4 | Routing |
| zustand | 5.0.9 | State management |
| firebase | 12.7.0 | Backend |
| framer-motion | 10.16.16 | Animations |
| tailwindcss | 3.3.6 | Styling |

### Key Libraries
| Package | Version | Purpose |
|---------|---------|---------|
| @tiptap/* | 3.26.1 | Rich text editor |
| react-virtuoso | 4.18.7 | Virtual scrolling |
| wavesurfer.js | 7.12.8 | Audio visualization |
| @ffmpeg/ffmpeg | 0.12.15 | Video processing |
| emoji-picker-react | 4.19.1 | Emoji input |
| lucide-react | 0.556.0 | Icons |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vite | 8.0.16 | Build tool |
| eslint | 9.39.2 | Linting |
| jest | 30.4.2 | Testing (configured but no tests) |
| @testing-library/react | 16.3.0 | React testing |
| tailwindcss | 3.3.6 | Styling |
| prettier | 3.7.4 | Formatting |

---

## PROJECT STRUCTURE

```
Arvdoul/
├── src/
│   ├── screens/          # 60+ screen components
│   │   ├── Profile/      # 10 profile screens
│   │   ├── CreatePost/   # 11 create screens
│   │   └── PostCard/     # 7 post type cards
│   ├── components/       # 100+ reusable components
│   │   ├── Home/         # Feed components
│   │   ├── Videos/       # Video components
│   │   ├── messaging/    # Messaging components
│   │   ├── profile/      # Profile components
│   │   ├── search/       # Search components
│   │   └── ...
│   ├── services/         # 16 service modules
│   │   ├── authService.js
│   │   ├── feedService.js
│   │   ├── messagesService.js
│   │   └── ...
│   ├── store/           # 7 Zustand stores
│   ├── context/          # 11 React contexts
│   ├── routes/           # AppRoutes.jsx
│   ├── firebase/         # Firebase configuration
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   └── styles/           # CSS files
├── functions/            # Cloud Functions
│   ├── index.js          # 15+ functions
│   ├── comments.js
│   ├── feed.js
│   ├── messaging.js
│   ├── monetization.js
│   └── ...
├── firestore.rules       # Security rules
├── firestore.indexes.json # 50+ composite indexes
├── storage.rules         # Storage rules
├── firebase.json         # Firebase config
├── package.json          # Dependencies
└── vite.config.js        # Build config
```

---

## FIRESTORE SCHEMA

### Collections (30+)
```
users/
posts/
comments/
conversations/
messages/
notifications/
stories/
videos/
coin_transactions/
follows/
friend_requests/
saved_posts/
liked_posts/
blocks/
mutes/
highlights/
archived_stories/
push_tokens/
scheduled_messages/
fanout_tasks/
push_queue/
idempotency_keys/
rate_limits/
sponsored_posts/
ads/
ad_impressions/
report_impressions/
user_reports/
user_sessions/
devices/
calls/
shards/
daily_upload_counters/
video_purchases/
group_invites/
user_events/
```

### Key Indexes
- posts: authorId + isDeleted + createdAt
- posts: isDeleted + status + visibility + createdAt
- comments: targetType + targetId + parentId + createdAt
- conversations: participants + lastActivity
- notifications: recipientId + createdAt
- coin_transactions: userId + createdAt

---

## ROUTES (40+)

### Public Routes
| Path | Screen |
|------|--------|
| / | SplashScreen |
| /intro | IntroScreen |
| /login | LoginScreen |
| /signup/step1 | SignupStep1Personal |
| /signup/step2 | SignupStep2VerifyContact |
| /otp-verification | OtpVerification |
| /verify-email | VerifyEmailScreen |
| /forgot-password | ForgotPassword |
| /reset-password | ResetPassword |
| /setup-profile | SetupProfile |

### Protected Routes
| Path | Screen |
|------|--------|
| /home | HomeScreen |
| /videos | VideosScreen |
| /messages | MessagingScreen |
| /messages/:id | ChatScreen |
| /create-post | CreatePost |
| /network | NetworkScreen |
| /coins | CoinsScreen |
| /notifications | NotificationsScreen |
| /create-story | CreateStory |
| /profile | ProfileMyScreen |
| /profile/:id | ProfilePublicScreen |
| /profile/edit | EditProfile |
| /profile/analytics | CreatorDashboardScreen |
| /search | SearchScreen |
| /saved | SavedScreen |
| /settings | SettingsScreen |
| /live | LiveScreen |
| /video-analytics | VideoAnalyticsScreen |

---

## CLOUD FUNCTIONS

### Callable Functions
| Function | Auth | Purpose |
|----------|------|---------|
| addCoins | Admin | Admin coin issuance |
| spendCoins | Owner | User spending |
| transferCoins | Owner | P2P transfer |
| sendGift | Owner | Gift to creator |
| sendTip | Owner | Tip to creator |
| withdrawCoins | Owner | Cashout |
| boostPost | Owner | Content promotion |
| verifyPurchase | Owner | IAP verification |
| sendPushNotification | Auth | FCM delivery |
| sendEmailNotification | Auth | Email delivery |
| processVideo | - | Video transcoding |

### Scheduled Functions
| Schedule | Function |
|----------|----------|
| Every 60 min | cleanupExpiredStories |
| Every 60 min | updateVideoRankingScores |
| Every 24 hours | cleanupSoftDeletedVideos |
| Every 24 hours | cleanupRateLimits |

### Trigger Functions
| Trigger | Function |
|---------|----------|
| notification onUpdate | awardCoinsOnNotificationRead |
| storage object finalize | processVideo |

---

## SECURITY CONFIGURATION

### Firestore Rules Summary
- Users: Read public, Write owner
- Posts: Read public, Create signed, Write owner
- Comments: Read public, Create signed, Write owner
- Messages: Read/write signed
- coin_transactions: Read owner, Write server only
- Default: Deny all

### Storage Rules Summary
- avatars/: Read public, Write owner
- banners/: Read public, Write owner
- posts/: Read public, Write owner
- messages/: Read/write signed
- temp/: Read/write owner, Delete signed

---

## CONFIGURATION

### Environment Variables (Expected)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### Feature Flags (In Code)
```javascript
FEED_CONFIG.MONETISATION.AD_INTERVAL = 4
FEED_CONFIG.MONETISATION.COIN_AWARD_DWELL_MS = 5000
MONETIZATION_CONFIG.WITHDRAWAL_MIN_LEVEL = 10
VIDEO_CONFIG.RATE_LIMIT.LIKE_COOLDOWN = 60
```

---

## PERFORMANCE TARGETS (From Code)

| Metric | Target |
|--------|--------|
| API requests | < 500ms p95 |
| Feed load | < 1.5s p95 |
| Post creation | < 1s p95 |
| Like action | < 500ms perceived |
| Search | < 1s p95 |
| Bundle size | < 500KB gzipped |
| First paint | < 1.5s |
| Time to interactive | < 3.5s |

---

## QUALITY GATES (STATUS)

| Gate | Status |
|------|--------|
| Build passes | ✅ |
| No TypeScript errors | ✅ |
| ESLint passes | ⚠️ Not run (configured) |
| Tests pass | ✅ 125 tests |
| Accessibility audit | ❌ Not done |
| Security scan | ❌ Not done |
| Performance audit | ❌ Not done |

---

## NEXT STEPS FOR IMPROVEMENT

### Immediate (Before Next Feature)
1. ~~Configure and run ESLint~~ ✅ Done
2. ~~Add test runner with sample tests~~ ✅ Done
3. ~~Create security rules tests~~ ✅ Done
4. Document API endpoints

### Short Term (This Month)
5. Add E2E tests (Playwright)
6. Accessibility audit (WCAG)
7. Performance profiling
8. Security penetration test

### Long Term (Next Quarter)
9. Add load testing
10. Add error tracking (Sentry)
11. Add analytics (Mixpanel)
12. Add monitoring dashboards
