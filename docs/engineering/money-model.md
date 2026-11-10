# Arvdoul money model

Single canonical description of how Arvdoul represents and moves value. Every
number here has exactly one authoritative definition in code; nothing in this
document may be re-declared in a screen, service or Cloud Function.

## 1. Units

| Unit | Meaning | Where |
|---|---|---|
| **coin** | The only stored/transferred unit. Always an **integer**. | `users/{uid}.coins`, `lockedCoins`, `coin_transactions.amount`, `ledger_entries.amount` |
| **USD** | A **display-only projection** of coins, never stored as an authoritative balance. | `coinsToUsd()` / `formatCoinsAsUsd()` |

Coins are integer-valued on purpose: floating-point arithmetic is never used for
an authoritative balance. USD is derived at render/settlement time.

## 2. The one rate: `COINS_PER_DOLLAR`

`src/shared/levelConfig.cjs` → `COINS_PER_DOLLAR = 200`, mirrored to
`functions/levelConfig.cjs` by `scripts/sync-shared-config.mjs`
(`sharedConfigSync.test.js` fails if the copy drifts).

- **Purchase rate**: `COIN_PACKAGES` sell fixed coin amounts for a fixed
  `priceUsdCents`. The effective purchase rate is whatever the package table
  encodes; it is *not* `COINS_PER_DOLLAR` and must not be forced to it. The
  package table is the source of truth for what a buyer pays.
- **Redemption rate**: `COINS_PER_DOLLAR` is the rate at which creator coins are
  converted to a fiat payout. `withdrawalSettlement.settleWithdrawal` reads
  `coinsToUsd(withdrawalData.amount)` and nothing else — there is **no
  caller-supplied rate override** (a second rate is how a payout drifts from
  what the creator was shown; `functionsContract.test.js` enforces this).

The three historical values `0.005`, `1000`, `0.007` that appeared in earlier
audits were **not** competing definitions of one rate — they were (a) an ad-hoc
USD/coin display guess, (b) a "coins per USD" figure from a draft, and (c) a
stale display constant. The canonical model keeps **one** rate (`200` coins per
USD for redemption) plus a **separate** purchase-package table; the display
constants are gone.

## 3. Supply, holds and the double-entry ledger

- `system/coin_supply.totalCoins` is an **incremental** counter bumped by every
  mint (`addCoins`, package purchase, ad reward, subscription grant) and burn
  (`spendCoins`, withdrawal settlement). It is not the sum of user balances.
- `users/{uid}.coins` is the spendable balance; `lockedCoins` holds coins
  reserved by a pending withdrawal. `getAvailableBalance` = `coins - lockedCoins`.
- `ledger_entries/{uuid}_{debit|credit}` is an immutable **double-entry** record:
  `createLedgerEntry(tx, debitAccount, creditAccount, amount, meta)` writes two
  docs in the same transaction (one debit, one credit). Account names are
  `users:{uid}`, `system:coin_supply`, `system:reserve`. The net of every
  transaction is zero.
- `coin_transactions/{id}` is the per-user, append-only transaction history
  (`userId`, `type: credit|debit`, `amount`, `reason`, `balanceAfter`). It is a
  projection for the wallet UI; the ledger is the accounting record.

**Invariants**

1. Every balance change and its `ledger_entries` pair happen in **one**
   Firestore transaction (never a read-then-write across calls).
2. Every mutating callable is **idempotent**: it records its result in
   `idempotency_ledger/{key}` inside the same transaction, so a retry returns the
   recorded result instead of moving coins twice
   (`monetizationIdempotencyGuard.test.js`).
3. Balances never go negative: `spendCoins`/`transferCoins`/gift/withdrawal all
   check available balance inside the transaction.
4. Client writes to `wallets`, `coin_transactions`, `transactions`,
   `ledger_entries`, `coin_events`, `video_purchases`, `system/*` and
   `idempotency_ledger` are denied by `firestore.rules`; only the Admin SDK
   (which bypasses rules) writes them.

## 4. Value entry points (who may mint / burn)

| Path | Function | Direction |
|---|---|---|
| Engagement rewards | `addCoins` (allowlisted reasons, per-reason **daily coin-volume** cap) | mint |
| Rewarded ads | `monetization.watchAd` | mint |
| Daily login / streak | `levelSystem.recordActiveDay` | mint |
| Coin package purchase | `monetization.purchaseCoins` (Stripe) | mint |
| Subscription grant | `monetization.createSubscription` / Stripe webhook | mint |
| Gifts received | `monetization.sendGift` (`gift_received`) | transfer |
| Spends | `spendCoins`, `sendGift`, `post_boost` | burn / transfer |
| Withdrawal | `requestWithdrawal` → `settleWithdrawal` | burn |

A client cannot name an arbitrary `reason` for `addCoins`; anything not in
`CLIENT_ADD_REASON_LIMITS` is rejected. The daily cap is enforced on **summed
coin volume**, not on transaction count (capping the count while trusting a
client `amount` let a caller mint the per-call maximum on every call).

## 5. Withdrawal state machine

`withdrawal_requests/{id}.status`:

```
pending ──(requestWithdrawal locks coins)──> pending
pending ──(adminDecideWithdrawal approve)──> processing ──> completed
                                                   └────────> failed  (hold released)
pending ──(adminDecideWithdrawal reject)───> rejected
pending ──(owner cancel)───────────────────> cancelled
```

- Creation is **server-only** (`allow create: if false` in rules); the callable
  locks `lockedCoins` and writes the request in one transaction, so a forged
  request with no coin lock behind it cannot exist.
- The owner may only **cancel** a `pending` request; `amount`/`address`/`method`
  are immutable once written.
- `settleWithdrawal` is the **single** settlement path (used by both the secret
  HTTPS worker and the admin callable). It re-checks the balance **before**
  `stripe.payouts.create` (which is irreversible) and releases the hold on any
  failure, so a failed settlement never strands the creator's coins.
- Approval/paid/rejected transitions are server-only and audited via
  `writeAudit`.

## 6. Gift / package / subscription tables

All live in `src/shared/levelConfig.cjs` and are mirrored to functions:

- `GIFT_CATALOG` / `GIFT_VALUES` — gift ids and prices. Server prices a gift from
  `GIFT_VALUES`; every picker derives from the catalog.
- `COIN_PACKAGES` / `COIN_PACKAGES_BY_ID` — store pricing.
- `SUBSCRIPTION_TIERS` — monthly grant + Stripe unit amount.
- `AD_REWARD_COINS` — rewarded-ad payout.

No screen or function may re-declare a package id, price, coin amount or gift
price. `sharedConfigSync.test.js` and `deployIntegrity.test.js` guard the sync
and the deploy surface.

## 7. What is deliberately *not* implemented

- No per-transaction fee, platform margin split, referral reward or refund flow
  exists in code. These are **product decisions** and must not be invented; if a
  margin or fee is added it must be a shared constant read by the settlement
  path, with a documented policy, not a literal in a screen.
- No negative balances (no verified rule permits them).
- Coin → USD is display-only; the wallet shows a projection, never an
  authoritative fiat balance.

## 8. Reconciliation

`auditCoins` (scheduled) compares `system/coin_supply.totalCoins` against the
summed user balances and reports drift to the admin economy summary
(`admin.getEconomySummary` → `treasuryReserveUsd = coinsToUsd(circulatingCoins)`).
Every mint/burn path must bump `system/coin_supply`; a path that forgets it
shows up here as permanent drift.
