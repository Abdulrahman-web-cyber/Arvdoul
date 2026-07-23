# ARCHITECTURE DECISIONS

**Generated**: 2026-07-23
**Last Updated**: Phase 0 Audit

---

## 1. FRONTEND ARCHITECTURE

### Framework & Build
- **Framework**: React 18.2 with Vite 8.0
- **Language**: JavaScript (JSX)
- **Styling**: Tailwind CSS 3.3 + custom CSS
- **State Management**: Zustand 5.0 (lightweight, no boilerplate)
- **Routing**: React Router 6.30
- **Package Manager**: npm

### Architecture Pattern
- **Component Architecture**: Container/Presenter pattern
- **Code Splitting**: Route-based lazy loading with Suspense
- **State**: Store-first architecture with Zustand

### Key Architectural Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State Management | Zustand | Lightweight, TypeScript-friendly, middleware support |
| Routing | React Router v6 | Standard, well-supported, nested routes |
| Styling | Tailwind CSS | Rapid development, consistent design |
| Component Library | Lucide React | Tree-shakeable, consistent icons |
| Animations | Framer Motion | Declarative, powerful |
| Forms | Custom + controlled components | Flexibility over abstraction |

### Component Hierarchy
```
App
├── AppStateGuard (context provider wrapper)
├── MainLayout
│   ├── TopAppBar
│   ├── BottomMenu / BottomNav
│   └── Content Area
└── Route Components (lazy loaded)
    ├── Screens (full pages)
    ├── Components (reusable)
    └── Services (business logic)
```

---

## 2. BACKEND ARCHITECTURE

### Firebase Services
- **Authentication**: Firebase Auth (email, phone, Google)
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage
- **Functions**: Cloud Functions (Node.js)
- **Hosting**: Firebase Hosting
- **Messaging**: Firebase Cloud Messaging

### Data Model

#### Primary Collections
| Collection | Purpose | Key Fields |
|------------|---------|------------|
| users | User profiles | username, displayName, avatar, coins, stats |
| posts | User content | authorId, type, content, media, stats |
| conversations | Messaging | participants, type, lastMessage |
| messages | Message threads | senderId, content, type, status |
| notifications | User alerts | recipientId, type, read |
| stories | Ephemeral content | userId, media, expiresAt |
| videos | Video content | authorId, status, storagePath |
| coin_transactions | Financial ledger | userId, type, amount, balanceAfter |
| follows | Social graph | fromUserId, toUserId |
| friend_requests | Friend system | fromUserId, toUserId, status |

#### Transaction Collections (for reliability)
| Collection | Purpose |
|------------|---------|
| idempotency_keys | Prevent duplicate operations |
| rate_limits | API rate limiting |
| fanout_tasks | Background post distribution |
| push_queue | Notification delivery queue |

---

## 3. SECURITY ARCHITECTURE

### Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    isSignedIn() → request.auth != null
    isOwner(userId) → auth.uid == userId
    
    // Collections with rules
    users/{userId} → read: public, write: owner only
    posts/{postId} → read: public, create: signed, write: owner
    comments/{commentId} → read: public, create: signed, write: owner
    coin_transactions/{txId} → read: owner, write: server only
    // Default deny
  }
}
```

### Key Security Decisions
1. **Authentication Required**: All mutations require authentication
2. **Ownership Enforcement**: Users can only modify their own data
3. **Server-Controlled Ledger**: coin_transactions write: false (server only)
4. **Idempotency**: Financial operations use idempotency keys
5. **Soft Deletes**: isDeleted flag, never hard delete user data

---

## 4. CLOUD FUNCTIONS ARCHITECTURE

### Function Categories

#### Callable Functions (user-triggered)
| Function | Purpose | Auth |
|----------|---------|------|
| addCoins | Admin adds coins | Admin only |
| spendCoins | User spends coins | Owner only |
| transferCoins | P2P transfer | Owner only |
| sendGift | Gift to creator | Owner only |
| sendTip | Tip to creator | Owner only |
| withdrawCoins | Cashout request | Owner only |
| boostPost | Promote content | Owner only |
| verifyPurchase | IAP verification | Owner only |
| sendPushNotification | FCM delivery | Auth required |

#### Trigger Functions (event-driven)
| Trigger | On Event | Purpose |
|---------|----------|---------|
| onPostCreated | post insert | Fanout to followers |
| onNotificationRead | notification update | Award coins |
| onVideoFinalized | storage finalize | Process video |

#### Scheduled Functions (cron)
| Schedule | Function | Purpose |
|----------|----------|---------|
| Every 60 min | cleanupExpiredStories | Delete expired stories |
| Every 60 min | updateVideoRankingScores | Refresh rankings |
| Every 24 hours | cleanupSoftDeletedVideos | Purge old deletions |
| Every 24 hours | cleanupRateLimits | Clean expired rate docs |

---

## 5. MONETIZATION ARCHITECTURE

### Coin System
```
User.wallet: coins (balance)
coin_transactions: ledger (immutable audit trail)
  - type: credit | debit
  - amount: number
  - balanceAfter: number
  - reason: iap | gift | purchase | earn | spend
  - metadata: { ... }
```

### Level System
```javascript
LEVELS = [
  { level: 1, xpRequired: 0, coinReward: 0 },
  { level: 2, xpRequired: 100, coinReward: 10 },
  // ... up to level 15
]
WITHDRAWAL_MIN_LEVEL = 10
```

### Gift System
```javascript
GIFTS = [
  { type: 'rose', value: 5 },
  { type: 'crown', value: 50 },
  { type: 'diamond', value: 100 },
  { type: 'rocket', value: 500 }
]
```

---

## 6. FEED ALGORITHM ARCHITECTURE

### Feed Types
- **following**: Posts from followed users
- **for_you**: Personalized recommendations
- **trending**: High engagement recent posts
- **discover**: Exploratory content
- **videos**: Video-only feed
- **sponsored**: Promoted content

### Ranking Signals
| Signal | Weight | Source |
|--------|--------|--------|
| Engagement | 40% | likes, comments, shares, views |
| Relevance | 30% | User interest vector |
| Creator Trust | 15% | Account age, verification, history |
| Freshness | 15% | Recency decay |

### Diversity Enforcement
```javascript
DIVERSITY = {
  MAX_SAME_USER: 1,      // Max 1 post per user
  MAX_SAME_TYPE: 3,       // Max 3 same type
  MAX_SAME_TOPIC: 2,      // Max 2 same topic
  MIN_DIVERSE_RATIO: 0.3  // 30% diverse content
}
```

---

## 7. REAL-TIME ARCHITECTURE

### Firestore Real-time Listeners
- **Conversations**: Participant-based query
- **Messages**: Conversation-scoped with pagination
- **Notifications**: Recipient-based with read state
- **Feed Updates**: Optimistic UI with server sync

### Presence System
```javascript
// Online status tracked via:
// 1. Firestore document (lastSeen)
// 2. Cloud Function triggers on auth events
// 3. Client heartbeat (optional)
```

---

## 8. PERFORMANCE ARCHITECTURE

### Caching Strategy
| Layer | Technology | TTL |
|-------|------------|-----|
| Route | React.lazy + Suspense | Per route |
| API | In-memory Map | 3-15 min |
| Profile | In-memory Map | 15 min |
| Feed | IndexedDB | Session |

### Query Optimization
- **Bounded queries**: Always with limit()
- **Composite indexes**: For common query patterns
- **Pagination**: Cursor-based (not offset)
- **Batch reads**: Promise.all for parallel fetches

### Build Optimization
- **Code splitting**: Route-based
- **Tree shaking**: ES modules
- **Minification**: Terser
- **Compression**: Gzip/Brotli

---

## 9. OBSERVABILITY ARCHITECTURE

### Logging
- **Client**: console.* with structured data
- **Server**: console.log/error with Firebase Console
- **Correlation**: UUID for request tracing

### Metrics (Not Implemented)
- Latency tracking
- Error rate monitoring
- User engagement analytics

### Error Handling
- **Client**: ErrorBoundary components
- **Server**: try/catch with HttpsError
- **Network**: Retry with exponential backoff

---

## 10. MIGRATION SEAMS

### Prepared for Future Changes
| Area | Seam | Description |
|------|------|-------------|
| Auth | authService | Can swap Firebase Auth |
| Database | firestoreService | Can add caching layer |
| Storage | storageService | Can add CDN |
| API | functions/index | Can add REST wrapper |

---

## 11. DEPRECATED PATTERNS

### Historical Decisions (Now Superseded)
| Pattern | Replaced By | Reason |
|---------|-------------|--------|
| Context-based state | Zustand stores | Performance |
| Class components | Function components | Modern React |
| Redux | Zustand | Simplicity |
| CRA | Vite | Speed |

---

## 12. KNOWN LIMITATIONS

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No real-time video processing | Video quality | Cloud Run for transcoding |
| No ML-based recommendations | Feed quality | Heuristic-based |
| No CDN for media | Load times | Firebase CDN |
| No GraphQL | Query flexibility | REST via Functions |
| No WebSocket | Real-time latency | Firestore listeners |

---

## DECISIONS PENDING

1. **Video Transcoding**: Cloud Run vs. third-party (Mux, Cloudinary)
2. **ML Recommendations**: Firebase ML vs. Vertex AI
3. **CDN Strategy**: Firebase Hosting CDN vs. custom
4. **Email Provider**: SendGrid vs. AWS SES vs. Firebase Extensions
5. **Analytics Platform**: Firebase Analytics vs. Mixpanel vs. Amplitude
6. **Error Tracking**: Sentry vs. Firebase Crashlytics
