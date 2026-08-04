# AOCM v1.0 — ARVDOUL COMPLETION MASTERPLAN

## CURRENT STATE MATRIX (from audit)
- Auth / Profiles: Partial (signup/login present; verification, MFA, device mgmt missing)
- Social Graph: Partial (follows exist; friend requests prototype; no discovery)
- Feed / Posts / Stories / Reels: Partial (UI screens present; backend fan-out/prototype; no ranking/recs)
- Messaging: Partial (chat screen exists; group messaging incomplete; no presence/read receipts robust)
- Notifications: Partial (screen exists; no batching/dedup backend; no reliable delivery)
- Search / Discovery: Prototype (search screen present; no indexing pipeline; no recommendations)
- Monetization / Coins / Gifts: Partial (coin screen present; no anti-fraud; no payout pipeline)
- Moderation / Admin: Prototype (admin screens present; no moderation queue pipeline; no appeals)
- Creator Tools / Analytics: Prototype (analytics screens; no aggregated pipeline)
- Security: Broken (hardcoded keys; over-permissive rules; no rate limits)
- Performance / Mobile / Offline: Missing (no robust offline sync; no virtualization; no low-end optimization)
- Testing: Missing (only 2 basic tests)
- DevOps / Observability: Missing (no monitoring; no crash reporting; no CI quality gates)

## PRODUCT PILLARS
1. Global identity (profiles, discovery)
2. Expression (posts, stories, reels, live)
3. Connection (messaging, groups, communities)
4. Creation economy (coins, gifts, boosts, payouts)
5. Trust & safety (moderation, security, privacy)
6. Performance at scale (low-end Android, offline, 1B user architecture)

## FEATURE UNIVERSE MAP (summary)
- Auth, Onboarding, Profiles, Social Graph, Feed, Posts, Stories, Reels, Messaging, Groups, Communities, Events, Notifications, Search, Discovery, Creator Tools, Monetization, Analytics, Settings, Privacy, Security, Accessibility, Offline, Admin / Moderation.

## FRONTEND MASTERPLAN (high-level)
- Feature-based folders: auth/, feed/, stories/, messaging/, profile/, creator/, admin/, design-system/
- Routing: protected routes for auth, profile setup, admin; deep-link support; lazy route splitting.
- Component architecture: atoms (Button, Input), molecules (PostCard, StoryRing), organisms (Feed, ChatList), layouts (MainLayout, AuthLayout).
- State: Zustand for app state; React Query / Firebase SDK for server state; optimistic updates; rollback on conflict.
- Performance: route splitting, image compression, video thumbnails, memoization, virtualization for feeds/lists.

## BACKEND MASTERPLAN (high-level)
- Auth: email, phone, Google, device management, session persistence.
- Firestore collections: users, profiles, follows, friendships, posts, comments, reactions, stories, reels, messages, conversations, notifications, communities, reports, moderation_logs, coins, transactions, analytics, system.
- Rules: deny-by-default; owner/participant checks; admin functions protected.
- Functions: fan-out, moderation, notifications, analytics, fraud detection, scheduled cleanup.
- Storage: image/video pipeline with compression, thumbnails, retention policies, metadata, CDN.

## UI/UX MASTERPLAN
- Design system: tokens for color, typography, spacing, elevation, motion.
- Screens: splash, onboarding, auth, profile setup, feed composer, feed, stories, reels, chat, notifications, search, profile, settings, wallet, creator dashboard, admin dashboard, moderation queue.
- Accessibility: WCAG AA, focus management, screen reader labels, keyboard navigation, color contrast.
- Mobile-first: touch targets >=44px, low RAM usage, reduced motion options.

## SOCIAL SYSTEMS
- Feed: chronological + personalized (future ranking); pagination; caching; offline.
- Stories: creation, viewing, reactions, expiration (24h).
- Reels: upload, processing, playback, engagement, sharing.
- Messaging: 1:1, groups, media sharing, typing indicators, read receipts, presence, offline sync.
- Notifications: real-time, batched, deduplicated, user preferences.

## CREATOR ECONOMY
- Coins, gifts, boosts, subscriptions, creator payouts, tipping, digital goods, advertising, sponsorship infrastructure, audit logs, anti-fraud.

## MODERATION / TRUST
- Reporting, blocking, muting, spam/fake detection, moderation queues, admin tools, appeals, reputation, content lifecycle.

## SEARCH / DISCOVERY
- User, post, hashtag, community search; creator discovery; trending; recommendation surfaces; onboarding interests; indexing pipeline.

## OFFLINE ARCHITECTURE
- Offline feed cache, messaging drafts, optimistic actions, retry queues, conflict resolution, cache invalidation, sync on reconnect.

## SECURITY MASTERPLAN
- Auth security, authorization rules, file validation, rate limits, bot resistance, account protection, audit logs, secret management.

## TESTING MASTERPLAN
- Unit, integration, component, Firebase emulator, offline, accessibility, performance, security, E2E. Target: 80%+ coverage on critical paths.

## DEVOPS MASTERPLAN
- Environments (dev/staging/prod), CI/CD with tests and security scans, preview deployments, rollback, backups, monitoring, alerting, crash reporting, performance monitoring, disaster recovery.

## BILLION-USER SCALABILITY
- Migration paths at 1k/10k/100k/1M/10M/100M/1B.
- Firestore sharding for counters; function fan-out; CDN; potential future migration to distributed database for extreme scale while preserving APIs.

## IMPLEMENTATION ROADMAP (summary milestones)
- M1: Security fix, init layer rewrite, rules hardening
- M2: Offline architecture, performance optimization
- M3: Creator economy, monetization, payout pipeline
- M4: Moderation, admin, trust & safety
- M5: Search/indexing, discovery, recommendations
- Launch: Integration testing, accessibility audit, security audit
- Scale Readiness: Load testing, monitoring, disaster recovery
- Global Expansion: Localization, compliance, multi-region

## MISSING FILES / FILE CHANGES (key examples)
- Create: src/services/index.js, src/design-system/, src/hooks/useServerState.js, src/utils/security.js, tests/, .github/workflows/security.yml
- Refactor: firebase.js (single init), firestore.rules (hardening), AppRoutes.jsx (lazy splitting)
- Rewrite: main.jsx (provider setup), HomeScreen.jsx (performance)
- Delete: duplicate components (BottomNav vs BottomMenu), dead routes

## FINAL EXECUTION BLUEPRINT
Deliver architecture diagrams, folder structures, database schemas, route maps, screen maps, design system specs, backend integration maps, Firebase rules, deployment, testing, security, scalability, monetization, moderation, offline, launch, and post-launch plans.
