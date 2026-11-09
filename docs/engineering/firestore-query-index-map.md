# Firestore query ↔ index map

Generated from the working tree by `src/__tests__/firestoreQueryIndexMap.test.js`,
which fails CI when a multi-constraint query has no covering composite index, when
two index definitions are identical, or when an index targets a collection the
rules never mention (dead config).

## How Firestore decides it needs an index

- **0 or 1 equality constraint** → served by the automatic single-field index.
- **1 equality + `orderBy('__name__')`** → served automatically.
- **≥ 2 equality/range constraints, or an equality plus a non-`__name__` order** →
  needs a **composite index**, or the query fails with `FAILED_PRECONDITION`
  (usually surfaced as an empty list, i.e. a silently empty screen).
- **A collection-group read** (`collectionGroup('x')`) needs a `COLLECTION_GROUP`
  scope index.

## Current state

- `firestore.indexes.json`: 131 composite indexes (`COLLECTION` + `COLLECTION_GROUP`).
- Client multi-constraint queries: 8 shapes, all covered.
- The only shape not requiring an explicit index is `follows where followerId == X
  orderBy __name__` (automatic).
- A dead `reels(createdAt)` index was removed — `reels` is never read with an order
  (the `userExport` function reads it with a single equality, served automatically).

## Index scopes and rules

An index for a **subcollection** (`messages`, `liked_posts`, `saved_posts`) has no
top-level rule — it is read as a collection group. The guard accepts any collection
that appears as a literal segment of any `match` path, plus `messages` (stored under
dynamic shard names `messages_YYYY_MM` validated by `isMessageShardCollection`).

## Adding a query

1. Add the query in a service (never a screen).
2. Run `npm test -- firestoreQueryIndexMap` — it tells you the exact
   `collectionGroup` and `fields` the query needs.
3. Add the index to `firestore.indexes.json`.
4. Deploy: `firebase deploy --only firestore:indexes` (owner action).
