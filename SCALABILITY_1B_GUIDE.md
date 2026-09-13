# ARVDOUL DIGITAL NATION - SCALABILITY BLUEPRINT (1K to 1B USERS)

## Executive Architecture Summary
This document defines the production engineering roadmap and architectural paradigms required to scale Arvdoul from initial cohort launch to 1,000,000,000 Monthly Active Users (MAU).

---

## 1. Storage & Database Tier Sharding

### 1.1 Firestore Hotspot Mitigation
* **1 write/sec Document Limit**: Firestore documents support a sustained write rate of ~1 write per second. Directly incrementing counters (e.g. post likes, views, followers, coin balances) on the primary document creates write locks and contention errors.
* **Sharded Counter Engine (`src/utils/shardedCounter.js`)**:
  - High-velocity counters distribute writes across $N$ subcollection shards (`sharded_counters/{metric}/shards/shard_x`).
  - Read queries perform aggregation queries (`count()`, `sum()`) or periodic batch rollups using Cloud Functions.
  - At viral velocity (>100k events/sec), dynamic shard expansion scales $N$ from 10 to 100 shards automatically.

### 1.2 Feed Fan-Out Strategy
* **Low-to-Medium Follower Creators (<10,000 followers)**:
  - *Fan-out on Write*: When a creator publishes a post, a background job fans out references to followers' inbox collections.
* **High-Follower Celebrities / Viral Creators (>10,000 followers)**:
  - *Fan-out on Read (Hybrid Architecture)*: Posts are written once to the author's collection. Followers' home feeds dynamically merge the cached inbox feed with query slices from followed celebrities during read-time.

---

## 2. Multi-Tier Caching Hierarchy

```
[ Client Browser / PWA ] 
       │ (Memory LRU + IndexedDB Offline Storage)
       ▼
[ Cloudflare / Google Cloud CDN Edge ] (Anycast routing, Brotli compression, stale-while-revalidate)
       │ (Cache-Control: public, max-age=30, stale-while-revalidate=300)
       ▼
[ Cloud Run / Firebase Applet Servers ] (Stateless container replicas)
       │ (Redis Memorystore for Session & Token caching)
       ▼
[ Google Cloud Firestore & Cloud Storage ] (Multi-Region / Multi-Zone Durable Tier)
```

### 2.1 Cache-Control Policies (`src/utils/cacheControl.js`)
* **`IMMUTABLE_STATIC`**: Content-hashed assets cached indefinitely (`max-age=31536000, immutable`).
* **`MEDIA_ASSET`**: Images, videos, avatar URLs cached at edge for 24h with 7d stale fallback.
* **`PUBLIC_FEED_DISCOVERY`**: Public exploration endpoints micro-cached for 30 seconds with 5-minute background revalidation.
* **`PRIVATE_AUTH`**: Strict `no-store, no-cache` for financial transactions, passwords, private keys, and direct messages.

---

## 3. Real-Time Messaging & Presence at Massive Scale

* **WebRTC & WebSocket Offloading**:
  - Direct 1-on-1 audio/video calls utilize peer-to-peer WebRTC connections negotiated via STUN/TURN servers.
  - Group live streams offload transcoding to Mux / Google Cloud Transcoder with HLS edge distribution.
* **Presence Heatmaps**:
  - Presence status is updated via ephemeral Realtime Database or Redis tokens with 60-second TTLs rather than writing directly to Firestore `users` documents.

---

## 4. Financial & Double-Entry Ledger Scalability

* **ACID Transactions**:
  - All coin transfers, tips, and payouts strictly use Firestore transactions with unique `idempotencyKey` checks.
* **Ledger Conservation**:
  - Balances are never modified without a corresponding immutable record in `coin_transactions`.
  - Batch audits periodically verify that $\sum \Delta \text{balances} == 0$ (excluding system mints/burns).

---

## 5. Global Multi-Region Deployment Plan

* **Primary Regions**:
  - Americas: `us-central1` (Iowa) / `us-east4` (Virginia)
  - EMEA: `europe-west1` (Belgium) / `europe-west4` (Eemshaven)
  - APAC: `asia-southeast1` (Singapore) / `asia-east1` (Taiwan)
* **Anycast Edge Routing**:
  - Google Cloud HTTP(S) Load Balancers direct users to the geographically closest POP with sub-30ms TLS handshake latency.
