# 🚀 ARVDOUL BILLION-USER SCALABILITY & PERFORMANCE BLUEPRINT

This blueprint outlines the exact production-ready architectural implementation details required to scale Arvdoul's Home feed, Stories, Real-time messaging, and Gamification XP modules to 1 Billion Daily Active Users.

---

## 1. ⚡ HOT-DOCUMENT COUNTER SHARDING (LIKES/VIEWS/REPOSTS)

### The Problem
Firestore enforces a physical limit of **1 write per second per document**. When a post from a celebrity or trending creator goes viral, thousands of users like and view the post simultaneously. Direct increments on the post document will fail immediately due to resource contention (`resource_exhausted` errors).

### The Sharded Solution
We split the count across `N` random sub-documents (shards) inside a sub-collection `/posts/{postId}/shards/{shardId}`.

#### Shard Schema:
```typescript
interface CounterShard {
  count: number;
}
```

#### Incrementing a Shard (Client-Side / Cloud Function):
```javascript
import { db } from '../firebase/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export async function incrementShardedCounter(postId, numShards = 10) {
  // Select a random shard index from 0 to numShards - 1
  const shardId = Math.floor(Math.random() * numShards).toString();
  const shardRef = doc(db, 'posts', postId, 'shards', shardId);

  try {
    await updateDoc(shardRef, {
      count: increment(1)
    });
  } catch (error) {
    console.error("Failed to increment counter shard:", error);
  }
}
```

#### Reading the Sharded Total (Aggregated read):
```javascript
import { collection, getDocs } from 'firebase/firestore';

export async function getAggregatedCount(postId) {
  const shardsRef = collection(db, 'posts', postId, 'shards');
  const snapshot = await getDocs(shardsRef);

  let total = 0;
  snapshot.forEach((doc) => {
    total += doc.data().count || 0;
  });
  return total;
}
```

---

## 2. 🎞️ STORIES QUERY OPTIMIZATION & CACHE DESIGN

### The Problem
Arvdoul's current query loads *all* active stories on snapshot, multiplying database reads aggressively on every single Home page reload.

### The Solution: Combined Query Filtering + Indexing
We restrict queries using a strict time window (e.g., last 24 hours) and limit feed ingestion.

#### Optimized Stories Listener:
```javascript
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export function subscribeToRecentStories(onUpdate) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const q = query(
    collection(db, 'stories'),
    where('createdAt', '>=', yesterday),
    orderBy('createdAt', 'desc'),
    limit(50) // Cap the client-side story tray feed
  );

  return onSnapshot(q, (snapshot) => {
    const stories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onUpdate(stories);
  });
}
```

---

## 🎖️ 3. HOME POSTCARD GAMIFICATION (LEVEL BADGES)

To make Arvdoul stand out as a ultra-pro-max creator hub, dynamic gamification level indicators must be embedded directly on all post headers.

### UI Modification Recipe for `src/screens/PostCard.jsx`
Embed the level indicator next to the display name inside the post header:

```jsx
import ProfileLevel from '../components/profile/ProfileLevel';

// Inside PostCard render header:
<div className="flex items-center gap-1.5 flex-wrap">
  <span className="font-semibold text-sm" style={{ color: tokens.text }}>
    {post.authorName}
  </span>
  {post.authorLevel && (
    <ProfileLevel level={post.authorLevel} theme={theme} />
  )}
  {post.isVerified && <CheckCircle className="w-3 h-3 text-cyan-400" />}
</div>
```

---

## 🔒 4. FIRESTORE SECURITY RE-ENGINEERING (PRODUCTION READY)

Replace the permissive rules with secure schemas preventing spoofing.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Posts Collection
    match /posts/{postId} {
      allow read: if true;
      allow create: if isSignedIn() && request.resource.data.authorId == request.auth.uid;
      allow update, delete: if isSignedIn() && resource.data.authorId == request.auth.uid;
    }

    // Conversations & Messages
    match /conversations/{conversationId} {
      allow read, write: if isSignedIn() && request.auth.uid in resource.data.participants;

      match /messages/{messageId} {
        allow read, write: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
  }
}
```
