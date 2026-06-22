# Arvdoul Firebase Deployment Guide

This document provides comprehensive instructions for deploying Firestore rules, indexes, and Cloud Functions for the Arvdoul application.

## Prerequisites

1. **Node.js 18+** - Required for Cloud Functions
2. **Firebase CLI** - Install with:
   ```bash
   npm install -g firebase-tools
   ```
3. **Firebase Project** - Project ID: `arvdoul-8057b`
4. **Authentication** - Log in with:
   ```bash
   firebase login
   ```

## Quick Start

### Deploy Everything (Recommended)

```bash
./deploy.sh
```

### Deploy Individual Components

```bash
# Deploy Firestore rules only
./deploy.sh --rules-only

# Deploy indexes only
./deploy.sh --indexes-only

# Deploy Cloud Functions only
./deploy.sh --functions-only
```

### Dry Run (Preview)

```bash
./deploy.sh --dry-run
```

This shows what would be deployed without making any changes.

---

## Detailed Deployment Instructions

### 1. Firestore Security Rules

The comprehensive security rules cover:

| Collection | Read | Create | Update | Delete |
|------------|------|--------|--------|--------|
| users | Public | Owner | Owner (+ counters) | Owner |
| posts | Public | Auth | Owner/Admin | Owner/Admin |
| comments | Public | Auth | Owner/Admin | Owner/Admin |
| stories | Public | Auth | Owner/Admin | Owner/Admin |
| conversations | Participant | Auth | Participant | Participant |
| messages | Participant | Participant | Participant | Owner/Admin |
| follows | Public | Auth | - | Owner |
| blocks | Partial | Auth | - | Owner |
| notifications | Recipient | Auth | Recipient | Recipient |
| coin_transactions | Owner | Server Only | Server Only | Server Only |
| videos | Public | Auth | Owner/Admin | Owner/Admin |
| ads | Public | Admin | Admin | Admin |
| reports | Admin | Auth | Admin | Admin |
| calls | Participant | Auth | Participant | Participant |
| shards | Auth | Server Only | - | - |
| rate_limits | Auth | Server Only | - | - |

#### Admin Collection

To grant admin privileges, create a document:
```javascript
// Firestore Console or Firebase Admin SDK
db.collection('admins').doc('USER_UID').set({
  role: 'admin',
  permissions: ['all'],
  createdAt: new Date()
});
```

### 2. Firestore Composite Indexes

The following composite indexes are deployed:

| Collection Group | Index Fields | Purpose |
|-----------------|--------------|---------|
| posts | authorId, isDeleted, createdAt | User posts feed |
| posts | isDeleted, status, visibility, trendingScore | Trending feed |
| comments | postId, parentId, score | Top comments |
| comments | postId, parentId, createdAt | Recent comments |
| users | searchTokens (array) | User search |
| notifications | recipientId, read, createdAt | User notifications |
| conversations | participants[], isActive, lastActivity | User conversations |
| messages | conversationId, isDeleted, createdAt | Chat messages |
| videos | userId, status, isDeleted, createdAt | User videos |
| videos | status, visibility, rankingScore | Video feed |
| coin_transactions | userId, type, createdAt | Transaction history |
| follows | followerId, createdAt | User following |
| follows | followingId, createdAt | User followers |
| scheduled_messages | status, scheduleAt | Scheduled messages |
| fanout_tasks | status, createdAt | Background tasks |
| push_queue | status, processingStartedAt | Push notifications |
| ads | active, startDate, placements[], priority | Ad serving |
| calls | status, createdAt | Call history |

### 3. Cloud Functions

#### Callable Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `addCoins` | Add coins to user (Admin only) | userId, amount, reason, metadata |
| `spendCoins` | Spend user's own coins | userId, amount, reason, metadata |
| `transferCoins` | Transfer coins between users | fromUserId, toUserId, amount, reason |
| `sendPushNotification` | Send push notification | notificationId, userId |
| `sendEmailNotification` | Send email notification | to, subject, body |
| `verifyPurchase` | Verify IAP receipt | userId, productId, receipt, platform |

#### Firestore Triggers

| Function | Trigger | Purpose |
|----------|---------|---------|
| `awardCoinsOnNotificationRead` | notifications.onUpdate | Award coins when notification read |
| `processVideo` | storage.object().onFinalize | Process uploaded video |
| `onCommentCreate` | comments.onCreate | Notify post author |
| `onCommentUpdate` | comments.onUpdate | Update comment counts |
| `onFollowCreate` | follows.onCreate | Update follower counts, notify user |
| `onFollowDelete` | follows.onDelete | Update follower counts |
| `onMessageCreate` | messages.onCreate | Real-time message handling |
| `onUserCreate` | users.onCreate | Initialize user data |
| `onPostCreate` | posts.onCreate | Update user post count |

#### Scheduled Functions

| Function | Schedule | Purpose |
|----------|---------|---------|
| `cleanupExpiredStories` | Every 60 minutes | Delete expired stories |
| `updateVideoRankingScores` | Every 60 minutes | Recalculate video rankings |
| `cleanupSoftDeletedVideos` | Daily | Remove soft-deleted videos after 30 days |
| `cleanupRateLimits` | Daily | Clean expired rate limit docs |
| `processScheduledMessages` | Every 5 minutes | Send scheduled messages |
| `processFanoutTasks` | Every 1 minute | Process fan-out tasks |
| `processPushQueue` | Every 30 seconds | Process push notifications |
| `generateAnalyticsReport` | Daily | Generate analytics summary |

#### Storage Triggers

| Function | Trigger | Purpose |
|---------|---------|---------|
| `onVideoUpload` | videos/ | Process new video uploads |
| `onMediaDelete` | all media | Clean up deleted media |

### 4. Additional Collections

The rules and indexes support these collections:

- `saved_posts` - User's saved posts
- `liked_posts` - User's liked posts
- `friend_requests` - Friend request system
- `user_reports` - Content reports
- `message_reports` - Message reports
- `ad_impressions` - Ad view tracking
- `sponsored_posts` - Sponsored content
- `devices` - User device management
- `user_sessions` - Session tracking
- `user_events` - Analytics events
- `highlights` - User highlights
- `archived_stories` - Archived stories
- `audio_tracks` - Audio library
- `video_purchases` - Video purchase records
- `hashtags` - Hashtag tracking
- `group_invites` - Group invite management
- `message_dedupe` - Message deduplication
- `idempotency_keys` - Operation idempotency
- `daily_upload_counters` - Rate limiting

---

## Environment Configuration

### Frontend Environment Variables

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=AIzaSyDm9ks21qUT7vCVh6USGVtHJblBzEEPjxk
VITE_FIREBASE_AUTH_DOMAIN=arvdoul-8057b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=arvdoul-8057b
VITE_FIREBASE_STORAGE_BUCKET=arvdoul-8057b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=892956185588
VITE_FIREBASE_APP_ID=1:892956185588:web:5ca931799f5da7846b9fa1
```

### Cloud Functions Environment

Set configuration in Firebase Console or via CLI:

```bash
firebase functions:config:set \
  algolia.app_id="YOUR_ALGOLIA_APP_ID" \
  algolia.api_key="YOUR_ALGOLIA_API_KEY" \
  sendgrid.key="YOUR_SENDGRID_KEY" \
  stripe.secret="YOUR_STRIPE_SECRET"
```

---

## Testing

### Test Rules Locally

```bash
# Start Firestore emulator
firebase init emulators
firebase emulators:start --only firestore

# Test with different users
firebase firestore:rules:test
```

### Test Functions Locally

```bash
# Start functions emulator
firebase emulators:start --only functions

# Call function locally
curl -X POST http://localhost:5001/arvdoul-8057b/us-central1/addCoins \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "amount": 100}'
```

---

## Monitoring

### Cloud Functions Logs

```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only addCoins

# Follow logs in real-time
firebase functions:log --follow
```

### Firestore Usage

Monitor in Firebase Console:
- Usage Dashboard
- Performance
- Security Rules Simulator

---

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Verify user is authenticated
   - Check Firestore rules for the operation
   - Ensure user owns the resource (for writes)

2. **Missing Index Errors**
   - Run `firebase deploy --only firestore:indexes`
   - Create missing index in Firebase Console

3. **Function Deployment Failures**
   - Check Node.js version (requires 18)
   - Verify dependencies in `functions/package.json`
   - Check for TypeScript compilation errors

4. **Cold Start Issues**
   - Consider minInstances configuration
   - Optimize function dependencies
   - Use connection pooling

### Reset Deployment

```bash
# Re-deploy everything
./deploy.sh --all

# Clear function cache
firebase functions:config:clear
```

---

## Security Considerations

1. **Never expose Firebase Admin SDK to clients**
2. **Use HTTPS callable functions for sensitive operations**
3. **Implement rate limiting in Cloud Functions**
4. **Validate all user input in functions**
5. **Use idempotency keys for critical operations**
6. **Log all admin actions for audit trail**
7. **Regularly rotate API keys**
8. **Monitor for unusual activity patterns**

---

## Support

For issues or questions:
1. Check Firebase Console for error logs
2. Review Cloud Functions documentation
3. Verify Firestore rules with simulator
4. Check this repository's issues

---

## Version History

| Date | Changes |
|------|---------|
| 2024 | Initial comprehensive rules and indexes |
| 2024 | Added monetization functions |
| 2024 | Added messaging functions |
| 2024 | Added video processing functions |
