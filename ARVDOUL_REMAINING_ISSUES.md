# 🔬 ARVDOUL — COMPLETE REMAINING-ISSUES AUDIT (every single thing, verified)

**Date:** 2026-08-03 · Method: fresh deep scan of every system, each claim verified against code (file:line). No guessing.

---

## 0. VERDICT BY SYSTEM — production-ready?

| System | Ready? | Verdict |
|---|---|---|
| Auth | ✅ | Real end-to-end (email/phone/Google/MFA, rate limits, audit) |
| Profile | ⚠️ 90% | Real (13 screens + 22 components + store). Gaps: highlight **creation** UI, thin About/Preview, PII exposure in rules |
| Notifications | ⚠️ 85% | Real in-app. **Push (FCM) broken end-to-end** (no sw.js handler) |
| Messaging | ✅ 95% | Real E2EE store-based chat. Gaps: group **add-members**, location/contact sharing stubs |
| Coins/Monetization | ❌ 60% | **Purchases can never complete** (no payment method UI); no subscription UI; ad = countdown timer only |
| Video | ⚠️ 80% | Real player/feed/editor. **Reels unreachable**; editor not linked from CreatePost |
| Post Creation | ✅ 95% | Real (types, media, drafts, offline). Gaps: video editor link, GIF picker |
| Image Editors | ✅ 95% | Real toolset. Gap: Collage.jsx is an **empty file**; GIFPicker stub |
| Stories | ✅ 90% | Real create/view/reactions. Gap: highlight creation UI |
| Search | ⚠️ 85% | Real Algolia+fallback. Gap: **hardcoded trending data with picsum.photos** |
| Live | ❌ 20% | **Entire UI is simulated** — never calls liveService, fake viewers |
| Communities | ✅ | Real |
| Events | ✅ | Real |
| Rankings | ✅ | Real |
| Admin | ✅ 95% | Real + gated. Gap: routes not guarded at router level |
| **Platform** | ❌ | Rules holes, missing indexes, dead code, 626 console logs, no Sentry, CI dupes |

---

## 1. 🔴 CRITICAL — breaks real users / production (must fix first)

### 1.1 LIVE IS FAKE (the biggest one)
- `src/screens/LiveScreen.jsx` (routed at `/live`) **never imports liveService**. Line 78–80: `// Simulate viewers` → `setViewers(v => Math.min(v + Math.floor(Math.random() * 5), 500))` — viewers are fake, stream start/end/gifts/comments are not wired.
- The hardened `liveService.js` (1,145 ln, sharded counters, monetization, offline queue) exists and is **completely unused by the UI**.

### 1.2 COIN PURCHASES CAN NEVER COMPLETE
- `CoinsScreen.jsx` has **no payment-method collection** (no Stripe, no card form, no webhook flow).
- `functions/monetization.js` `purchaseCoins` **requires `paymentMethodId`** and throws `failed-precondition` otherwise.
- Result: every "BUY NOW" click fails for every real user. Monetization is not revenue-ready.

### 1.3 PUSH NOTIFICATIONS BROKEN END-TO-END
- `public/sw.js` has **zero `push` / `notificationclick` handlers** — even with valid FCM tokens, pushes cannot be delivered.
- `requestPushPermission` is wired only in `MessagingScreen.jsx:400`; no permission prompt on onboarding/settings.
- `notificationsService.js` saves tokens (`push_tokens`) but nothing consumes them on-device.

### 1.4 FIRESTORE RULES SECURITY HOLES (my rewrite has 6 real issues)
| Rule | Issue |
|---|---|
| `follows` create (`firestore.rules`) | `followerId == uid() \|\| followingId == uid()` → **spoof**: create a follow making someone else the follower |
| `notifications` create | `isSignedIn()` → **any user can spam notifications to any user** |
| `posts/{postId}/{subcollection}` | any signed-in write → **like/save/gift spoof** under other users' ids |
| `counter_shards` | any signed-in read/write → **counters corruptible** (write negative values) |
| `users` read | `isSignedIn()` → **all signed-in users read full PII** (email/phone) |
| `profile_analytics` write | `isOwner \|\| isAdmin` → owners can **inflate own analytics** |

### 1.5 REELS FEATURE UNREACHABLE
- `ReelsScreen.jsx` + `FullScreenReels.jsx` exist; **zero references anywhere**; no `/reels` route (RouteGuard lists `/reels` but AppRoutes doesn't). Users can't reach reels.

### 1.6 MISSING COMPOSITE INDEXES (runtime query failures)
- `collections`: `userId ASC, updatedAt DESC` — used by collectionsService → **fails**
- `user_daily_stats`: `userId ASC, type ASC, date DESC` — used by analyticsService.getFollowerGrowth → **fails**
- (Verified present: coin_transactions, transactions, conversations, ads, stories.)

---

## 2. 🟠 HIGH — feature gaps & mocks

| # | Issue | Evidence |
|---|---|---|
| 2.1 | **Hardcoded Firebase API key committed** | `src/firebase/firebase.js:10` `AIzaSyDm9...`; the env-driven `config.js` (463 ln) is still imported nowhere |
| 2.2 | **Offline drain drops purchase ops** | `AppBootstrap.jsx` drain: `case 'purchaseCoins'` shares the `watchAd` branch and only calls `svc.watchAd(...)` → queued purchases silently vanish |
| 2.3 | **No subscription UI** | CFs `getSubscriptionStatus/createSubscription/cancelSubscription` exist; no screen offers tiers |
| 2.4 | **Highlight creation missing** | `storyService.createHighlight` (L990) exists; `/create-highlight` redirects to a **list-only** HighlightsScreen — no create flow |
| 2.5 | **Video editor unreachable from CreatePost** | `CreatePost/CreateVideo.jsx:622` — `toast.info("Video Editor coming soon…")`; never navigates to `/video-editor` |
| 2.6 | **Search trending = mock** | `SearchScreen.jsx:47-51` hardcoded items with `https://picsum.photos/seed/...` placeholder images |
| 2.7 | **audioEditorService export is simulated** | `audioEditorService.js:584` `// Simulate export process` |
| 2.8 | **Live gift drain mismatch** | AppBootstrap `live_gift` case calls `monetizationService.sendGift(senderId, streamId, giftType)` — wrong signature vs `liveService.sendLiveGift(streamId, senderId, recipientId, giftType)` |

## 3. 🟡 MEDIUM — stubs & polish (confirmed "coming soon" / not-implemented)

| # | Location | Stub |
|---|---|---|
| 3.1 | `components/Shared/GIFPicker.jsx:6` | "GIF picker coming soon" |
| 3.2 | `components/messaging/MessageInput.jsx:359,369` | Location / contact sharing → `toast.info('… coming soon')` |
| 3.3 | `hooks/useSearch.js:260-261` | `voiceSearch` / `qrScan` → `console.log('not implemented')` |
| 3.4 | `screens/GroupInfoScreen.jsx:193` | "Add members feature coming soon" |
| 3.5 | `components/Shared/Collage.jsx` | **0-byte empty file** (unimported, but broken if ever used) |
| 3.6 | `screens/PostDetails.jsx` | `onOpenOptions={() => {}}` — post options menu empty on detail view |
| 3.7 | `BottomNav.jsx:116` | `/requests` tab → **no route exists** (dead nav) |
| 3.8 | `Profile/AboutScreen.jsx` (69 ln), `ProfilePreviewScreen.jsx` (109 ln) | Thin shells — verify content depth |
| 3.9 | CommentsDrawer duplication | `screens/CommentsDrawer.jsx` (1,830) vs `components/Videos/CommentsDrawer.jsx` — two implementations |

## 4. 🟡 MEDIUM — platform hygiene

| # | Issue |
|---|---|
| 4.1 | **626 `console.*` statements** in src (prod bundle carries them) |
| 4.2 | **Dead files still present**: `src/OtpVerification.jsx`, `src/SignupStep2VerifyContact.jsx` (root dupes), `screens/ConversationList.jsx`, `screens/ResetOtpVerification.jsx`, `screens/SetPassword.jsx` (0 references), 5 dead lib files (`arvdoulMediaService`, `cloudinaryService`, `arvdoulService`, `messagingIntegration`, 2 md docs) |
| 4.3 | **Duplicate deploy workflows**: `firebase-hosting-merge.yml` + `firebase_hosting.yml` both deploy on main, different secret names (one fails) |
| 4.4 | **Admin routes not guarded at router level** — any signed-in user can open `/admin` (screens self-check, but a router guard should exist) |
| 4.5 | **No Sentry / error monitoring**; Logger has no prod sink |
| 4.6 | **AdminUserManagement orders by `createdAt`** — legacy users without the field are silently excluded |
| 4.7 | **No service/screen tests** — only 11 utility tests exist |

## 5. 🔵 LOW — polish/backlog

- aria-labels on many icon-only buttons; focus rings; reduced-motion (only Intro honors it)
- `functions/` deps (stripe, @google-cloud/tasks, uuid) untested in emulator
- PWA install prompt + offline strategy for app-shell assets (precache exists, needs testing)
- Post share URLs now resolve (✓ fixed) but og: tags / deep-link metadata missing
- Creator monetization polish: creator dashboard is real (analyticsService) — withdrawal UI is in CoinsScreen ✓, payout onboarding (Stripe Express) has **no UI** (CF exists)

---

## 6. THE NEXT PHASES (recommended order)

**Phase 1 — Fix the 6 criticals (1.1–1.6):**
1. Rewire LiveScreen → liveService (real start/end, viewers from subcollections, gifts via liveService)
2. Payment method collection in CoinsScreen (Stripe Elements / webhook flow) + surface subscriptions
3. Add push/notificationclick handlers to sw.js + permission prompts
4. Harden the 6 rules holes (follows, notifications, posts subcollections, counter_shards, users PII, profile_analytics)
5. Route `/reels` (ReelsScreen/FullScreenReels) + link from Videos/BottomNav
6. Add the 2 missing composite indexes to `firestore.indexes.json`

**Phase 2 — Kill the mocks/stubs (2.x, 3.x):**
7. Fix offline-drain purchase/watchAd branches; live gift drain signature
8. CreateVideo → real editor link; GIFPicker; voice/QR search; group add-members; highlight create UI; location/contact sharing
9. Replace Search trending with real data (searchService/trending); delete Collage.jsx + dead files

**Phase 3 — Platform hardening (4.x, 5.x):**
10. Move Firebase config to env (wire config.js) + rotate key; console-strip plugin
11. Dedupe deploy workflows; admin route guard; Sentry; createdAt backfill
12. Service/screen test suites; a11y pass; PWA push testing

---

*Every item above was verified in the current checkout. Build passes; the gaps are runtime/security/feature-completeness, not compilation.*
