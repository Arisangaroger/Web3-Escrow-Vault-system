# Phase 2 — Backend Bridge
## Full Detailed Implementation Plan

**Scope:** This phase builds the server that sits between "a phone number typing digits" and "a signed blockchain transaction." By the end of this phase, you should be able to run a complete deal lifecycle — creation, locking, shipping, delivery, dispute, release, revoke — entirely through direct API calls (Postman/CLI scripts), with correct on-chain state changes and correct notification logs, **without any USSD interface existing yet**.

This phase assumes Phase 1's contract interface (functions, events, roles) is finalized and deployed to at least a local/testnet environment, per the `CONTRACTS.md` and decisions log produced at the end of Phase 1.

---

## 1. Technology & Project Setup

### 1.1 Stack decision
- **Language:** Node.js (recommended, given ethers.js/web3.js maturity and easy pairing with a future USSD gateway SDK like Africa's Talking) or Python (web3.py) — pick one and stay consistent; Node.js is assumed for the rest of this plan since it pairs most naturally with Hardhat's ecosystem from Phase 1.
- **Framework:** Express.js (lightweight, sufficient for this scope) or Fastify.
- **Database:** PostgreSQL (recommended for relational integrity — phone-to-wallet mappings, deal indexing, PIN state — over MongoDB, since your data is inherently relational: users, deals, roles, logs).
- **ORM:** Prisma (clean schema management, good TypeScript support) or Sequelize.
- **Queue/Scheduler:** node-cron for the keeper job initially; consider BullMQ + Redis if you want more robust retry/backoff behavior later.
- **Blockchain library:** ethers.js, connected to the same RPC endpoint(s) configured in Phase 1.

### 1.2 Project structure
```
/src
  /config          → env, network, contract ABI/address loading
  /db              → Prisma schema, migrations, client
  /wallets         → custodial keygen, encryption, signing
  /auth            → PIN hashing, attempt tracking, lockout
  /contracts       → thin wrapper functions calling ethers.js against Escrow/eRWF
  /services        → business logic per feature (deal creation, locking, shipping, etc.)
  /notifications   → SMS/broadcast simulation layer
  /keeper          → scheduled jobs (auto-cancel, auto-release polling)
  /api             → HTTP route handlers (for Phase 2 testing — later reused/extended by USSD layer in Phase 3)
  /utils
```

### 1.3 Environment configuration
- `.env` variables: RPC URL, Escrow contract address, eRWF contract address, backend relay private key (or KMS reference), database URL, PIN pepper/secret, encryption key for wallet storage.
- Load and validate all env vars at startup (fail fast if something required is missing — this is a financial system, silent misconfiguration is dangerous).

**Exit criteria for Section 1:** server boots, connects to the database, connects to the configured blockchain RPC, and can read a value from the deployed Escrow contract (e.g. `nextDealId`) as a smoke test.

---

## 2. Database Schema Design

### 2.1 `users` table
| Column | Type | Notes |
|---|---|---|
| `phone_number` | string, PK | E.164 format recommended |
| `wallet_address` | string | Public custodial address |
| `encrypted_private_key` | text | Encrypted at rest |
| `pin_hash` | string | Hashed, never plaintext |
| `pin_attempts` | int | Default 0 |
| `lockout_until` | timestamp, nullable | Set on 5th failed attempt |
| `created_at` | timestamp | First interaction |

### 2.2 `deals` table
Mirrors the on-chain `Deal` struct plus off-chain-only convenience fields:
| Column | Type | Notes |
|---|---|---|
| `deal_id` | int, PK | Matches on-chain `dealId` |
| `sender_phone` | string, FK → users |
| `driver_phone` | string, FK → users |
| `receiver_phone` | string, FK → users |
| `amount` | decimal | Stored in human-readable RWF units, converted to token decimals at contract-call time |
| `status` | enum | Mirrors contract `Status` enum — kept in sync via event listener, not as source of truth |
| `created_at` | timestamp | |
| `fund_lock_deadline` | timestamp | |
| `ship_deadline` | timestamp | |
| `payout_ready_time` | timestamp, nullable | |
| `dispute_reason_code` | int, nullable | |
| `tx_hash_created` | string | On-chain transaction reference |
| `last_synced_block` | int | For event-sync reconciliation |

**Important design principle:** the blockchain is the source of truth for financial state; this table is a **read-optimized cache** synced from on-chain events, used to power fast USSD menu queries without hitting the RPC on every keystroke. Every write path should ultimately be confirmed by an event listener (Section 5), not just written optimistically at the moment of an API call.

### 2.3 `deal_action_log` table (audit trail, feeds Admin Portal in Phase 4)
| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `deal_id` | FK | |
| `actor_phone` | string | |
| `action` | string | e.g. `Shipped`, `Delivered`, `Disputed` |
| `timestamp` | timestamp | |
| `tx_hash` | string | |

### 2.4 `notifications_log` table (simulated SMS record)
| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `deal_id` | FK | |
| `recipient_phone` | string | |
| `message` | text | |
| `sent_at` | timestamp | |
| `delivery_status` | enum | `Simulated_Sent` for now — placeholder for future real gateway status |

**Exit criteria for Section 2:** Prisma schema (or equivalent) written, migrated to a local Postgres instance, all four tables created with correct foreign key relationships.

---

## 3. Custodial Wallet Management

### 3.1 Wallet generation
- On first contact from an unrecognized phone number (detected at the API layer before any deal-related action), generate a new keypair using `ethers.Wallet.createRandom()`.
- Store the public address in `users.wallet_address`.
- Encrypt the private key before storage — **do not store plaintext private keys under any circumstance.**

### 3.2 Encryption approach
- **Simplest viable approach for a prototype:** use `ethers.Wallet.encrypt(password)` (produces an encrypted JSON keystore, standard Ethereum format) using a server-held master secret as the password — stored as `encrypted_private_key`.
- **More robust approach (recommended if feasible):** use a proper KMS (AWS KMS, GCP KMS, or HashiCorp Vault) to encrypt/decrypt the key material, so the master secret itself isn't sitting in your application's environment variables. For a learning-stage prototype, the simpler encrypted-keystore approach is acceptable, but document this as a known production-hardening gap (tie this into your Section 10 "explicitly deferred" list from the concept note).

### 3.3 Key usage flow
- When a signed transaction is needed on behalf of a user (e.g., they click "I Delivered"), the backend:
  1. Authenticates the incoming request via PIN (Section 4).
  2. Decrypts the user's private key in-memory only, for the duration of the signing operation.
  3. Constructs and signs the relevant contract call using that decrypted key.
  4. Immediately discards the decrypted key from memory (don't cache it beyond the single operation).
  5. Submits the transaction via the backend's Gas Relay wallet paying gas (Section 6), or — depending on your chosen relay pattern — the user's own wallet signs the "intent" and the relay wallet wraps/forwards it (see Section 6.2 for the two possible patterns).

### 3.4 Wallet recovery / loss scenario
- Explicitly out of scope for Phase 2 (ties to your concept note's deferred "device loss" item), but document the current gap: if the backend's encryption master key is ever lost, all custodial wallets become permanently inaccessible. Note this clearly for future production planning.

**Exit criteria for Section 3:** a function `getOrCreateWallet(phoneNumber)` exists, tested to correctly generate, encrypt, store, and later retrieve/decrypt a keypair.

---

## 4. PIN Authentication System

### 4.1 PIN creation flow
- First-time user sets a 4-digit PIN (this will be triggered by the USSD "welcome" flow in Phase 3, but the backend function should be built and testable independently now).
- Hash the PIN using a slow hash function suitable for short numeric secrets — **bcrypt** or **argon2** (recommended: argon2id), combined with a per-user salt (handled automatically by these libraries) and optionally a server-side pepper (an additional secret stored in env config, not in the database) for defense-in-depth given how short/guessable a 4-digit PIN inherently is.

### 4.2 PIN verification flow
- Function: `verifyPin(phoneNumber, submittedPin)`
- Check `lockout_until` first — if still locked out, reject immediately without even checking the PIN (don't leak timing information).
- If not locked out, compare hash. On failure:
  - Increment `pin_attempts`.
  - If `pin_attempts >= 5`, set `lockout_until = now + 15 minutes`.
- On success:
  - Reset `pin_attempts = 0`, clear `lockout_until`.

### 4.3 PIN reset (out of scope, but note it)
- No self-service PIN reset mechanism is being built in this phase (ties to the deferred "device loss" item) — document that a lost PIN currently requires manual/admin intervention, to be designed later.

**Exit criteria for Section 4:** `setPin`, `verifyPin` functions implemented and unit tested, including the 5-attempt/15-minute lockout behavior using time-mocking in tests (similar to the `time.increase()` pattern from Phase 1).

---

## 5. Contract Interaction Layer

### 5.1 Read/write wrapper functions
Build a thin service module wrapping every contract function from Phase 1's interface, e.g.:
- `createDealOnChain(senderWallet, driver, receiver, amount, shipDeadlineDuration)`
- `lockFundsOnChain(receiverWallet, dealId)`
- `markShippedOnChain(senderWallet, dealId)`
- `markDeliveredOnChain(driverWallet, dealId)`
- `disputeOnChain(receiverWallet, dealId, reasonCode)`
- `releaseFundsOnChain(dealId)` — keeper-triggered, no user wallet needed
- `resolveDisputeOnChain(adminWallet, dealId, outcome)`
- `requestRevokeOnChain(wallet, dealId)`
- `confirmRevokeOnChain(wallet, dealId)`
- `unilateralRevokeOnChain(receiverWallet, dealId)`
- `autoCancelOnChain(dealId)` — keeper-triggered

Each wrapper handles: loading the correct ABI, constructing the transaction, submitting it via the Gas Relay pattern (Section 6), waiting for confirmation, and returning the transaction hash/receipt.

### 5.2 Error handling & revert decoding
- Contract calls will revert with specific reasons (e.g., "not receiver," "deadline passed"). Build a consistent error-decoding utility that translates Solidity revert strings/custom errors into clean, user-presentable messages the USSD layer can display (e.g., "This deal has already expired" instead of a raw revert string).

### 5.3 Nonce management
- Since the backend relay wallet will be submitting many transactions (potentially concurrently, across multiple simultaneous deals), implement careful nonce management — either a queued/serialized transaction submission pattern, or a nonce-tracking mechanism, to avoid nonce collision errors under concurrent load. This is a common, easy-to-underestimate failure point in relay-style backends.

**Exit criteria for Section 5:** every contract function from Phase 1 has a corresponding, tested backend wrapper function that can be called directly from a script and produces the expected on-chain state change.

---

## 6. Gas Relay / Transaction Sponsorship

### 6.1 Choose a relay pattern
Two realistic options for a prototype:

**Option A — Full custodial relay (simpler, recommended for this stage):**
The backend holds the user's private key entirely (per Section 3) and simply signs and submits transactions directly from the backend using the user's own custodial wallet, while a *separate* relay/funding wallet periodically tops up each custodial wallet with a small amount of native gas token so they can pay their own gas — **or** more simply, the backend restructures the contract calls so a single relay wallet is the `msg.sender` for all transactions, and the contract's internal logic uses a passed-in `onBehalfOf` parameter rather than relying on `msg.sender` for role checks.

**Important implication for Phase 1 alignment:** if you go with "relay wallet is always `msg.sender`," your Phase 1 contract functions need an explicit `address actingParty` parameter with backend-level authorization (rather than relying purely on `msg.sender == deal.sender`), **or** you keep `msg.sender` checks as designed and instead fund each custodial wallet with tiny amounts of gas token from a treasury wallet. Decide this now, since it may require a small revisit to Phase 1 signatures — flagging this explicitly as a cross-phase dependency worth resolving before writing this section's code.

**Option B — Meta-transactions / EIP-2771 (more "correct" but more complex):**
Users' custodial wallets sign a structured message (not a full transaction), and a trusted forwarder contract relays it, preserving `msg.sender` semantics via `_msgSender()` overrides. This is the more "textbook" account abstraction approach but adds meaningful complexity (forwarder contract, signature verification) that may not be worth it for a learning-stage prototype.

**Recommendation:** Option A with the "treasury funds tiny gas amounts to each custodial wallet" variant — it preserves your Phase 1 contract's `msg.sender`-based access control exactly as designed, and is the least disruptive to what's already built.

### 6.2 Treasury/relay wallet management
- Maintain a funded "treasury" wallet holding native gas tokens (AVAX/ETH depending on testnet).
- Build a function `ensureGasFunded(walletAddress)` that checks a custodial wallet's native balance before a transaction and tops it up with a small fixed amount if below a threshold.
- Monitor treasury wallet balance and alert (log/console warning acceptable for prototype) if running low.

### 6.3 Transaction submission queue
- To avoid nonce collisions (Section 5.3) and manage nonce sequencing per custodial wallet, consider a simple in-memory (or Redis-backed) queue per wallet address, processing transactions one at a time per address.

**Exit criteria for Section 6:** a custodial wallet with zero native balance can still successfully submit a signed transaction, because the backend automatically funds it with gas moments before submission, and this is demonstrated in a test script.

---

## 7. Multi-Deal Indexing & Role-Aware Query Layer

### 7.1 Core query
Build a service function `getActiveDealsForPhone(phoneNumber)` returning all deals from the `deals` table where the phone number appears as `sender_phone`, `driver_phone`, or `receiver_phone`, and `status` is not terminal (`Released`, `Cancelled`, `Refunded`).

### 7.2 Role-segmented response shape
Structure the response so the (future) USSD layer can trivially build the menu from Section 8 of your concept note:
```json
{
  "asSeller": [ { "dealId": 9872, "counterpartyPhone": "...", "status": "Shipped" }, ... ],
  "asDriver": [ ... ],
  "asBuyer": [ ... ]
}
```

### 7.3 Sync correctness
Since `deals` table status is a cache of on-chain truth (per Section 2.2's design principle), ensure this query always reflects the **latest synced on-chain event**, not a stale write from an API call that hasn't yet been confirmed by the event listener (Section 8). Consider a `pending_confirmation` transient status for UX purposes (e.g., "Your action is processing…") separate from the confirmed on-chain status.

**Exit criteria for Section 7:** given a test phone number participating in three deals across three different roles, the query function correctly returns all three, correctly segmented, and correctly excludes any closed deals.

---

## 8. Event Listener / Blockchain Sync Service

### 8.1 Why this is necessary
Your database's `deals` and `deal_action_log` tables must stay in sync with actual on-chain state — not just with what your own API *attempted* to do (a transaction could be submitted but later fail, or be submitted by another path entirely). A dedicated listener service is the correct source of truth propagation mechanism.

### 8.2 Implementation approach
- Use ethers.js event filters/listeners (or periodic polling of `queryFilter` over a block range, which is more robust than long-lived WebSocket subscriptions for a prototype) against every event defined in Phase 1 Section 3.4 (`DealCreated`, `FundsLocked`, `MarkedShipped`, `MarkedDelivered`, `DisputeRaised`, `FundsReleased`, `DisputeResolved`, `RevokeRequested`, `RevokeConfirmed`, `UnilateralRevoke`, `DealAutoCancelled`).
- On each event, update the corresponding row in `deals` and insert a row into `deal_action_log`.
- Track `last_synced_block` (globally or per-deal) to support resuming after a backend restart without missing or double-processing events.

### 8.3 Reconciliation job
- A periodic job (e.g., every few minutes) that re-fetches on-chain state for any deal whose off-chain status hasn't changed in an unexpectedly long time, as a safety net against a missed event — logs a warning if a mismatch is found.

**Exit criteria for Section 8:** triggering any contract function directly (bypassing the backend's own API, e.g. via a raw script) still results in the `deals` table updating correctly within a short polling interval, proving the sync is truly event-driven and not just optimistically written by the API layer.

---

## 9. Scheduled Keeper Job

### 9.1 Jobs to implement
- **Job A — Fund-lock expiry sweep:** every N minutes, query all `deals` with `status = Created` and `fund_lock_deadline < now`, call `autoCancelOnChain(dealId)` for each.
- **Job B — Payout release sweep:** every N minutes, query all `deals` with `status = Delivered` and `payout_ready_time < now`, call `releaseFundsOnChain(dealId)` for each.

### 9.2 Idempotency & failure handling
- Ensure each job checks current on-chain status (or trusts the recently-synced cache, per Section 8) immediately before acting, to avoid redundant transaction attempts on a deal that already transitioned (e.g., a dispute was raised in the same window the sweep is running).
- Wrap each individual deal's keeper action in its own try/catch so one failing transaction doesn't halt the sweep for other deals.
- Log every keeper action (success and failure) for observability.

### 9.3 Scheduling mechanism
- `node-cron` is sufficient for a prototype (e.g., run every 5 minutes). Document that a production system would want a more robust distributed job scheduler with retry/backoff and alerting, but this is acceptable for now.

**Exit criteria for Section 9:** a deal manually pushed past its `fundLockDeadline` (via time-warping on a local test network) is automatically auto-cancelled by the next keeper run without any manual trigger, and the same is demonstrated for the 3-hour payout release.

---

## 10. Notification / Triangular Broadcast Layer (Simulated)

### 10.1 Simulated SMS function
- Build `sendNotification(phoneNumber, message)` that, for now, simply writes a row to `notifications_log` and logs to console — this stands in for the real SMS gateway. Design the function signature to match what a real provider's SDK would expect, so swapping in a real gateway later is a drop-in change.

### 10.2 Broadcast triggers
Wire notification calls to fire on the relevant events synced in Section 8:
- `DealCreated` → notify driver and receiver of the new deal invitation.
- `MarkedShipped` → notify driver and receiver.
- `MarkedDelivered` → **triangular broadcast** to sender and receiver (this is the critical one — the mechanism your entire fraud-prevention design in the concept note depends on).
- `DisputeRaised` → notify sender, driver, and the Admin (queue entry for Phase 4's portal).
- `FundsReleased` / `DisputeResolved` / refund events → notify relevant parties of final outcome.

### 10.3 Delivery reliability caveat
- Document explicitly (per your concept note's Section 10) that this simulated layer assumes perfect delivery — a real SMS gateway can fail or delay silently, which would weaken the triangular broadcast's security guarantee in production. Not solved in this phase, just acknowledged.

**Exit criteria for Section 10:** running a full deal lifecycle via test scripts produces a complete, correctly-ordered set of rows in `notifications_log`, matching every broadcast trigger listed above.

---

## 11. API Layer (Phase 2 Testing Interface)

### 11.1 Purpose
Since USSD doesn't exist yet (that's Phase 3), Phase 2 needs its own directly testable interface — a straightforward REST API mirroring every user-facing action, callable via Postman/curl/test scripts.

### 11.2 Endpoints to build
- `POST /users/:phone/pin` — set PIN (first-time setup)
- `POST /deals` — create deal `{ senderPhone, driverPhone, receiverPhone, amount }`
- `POST /deals/:dealId/lock` — `{ phone, pin }`
- `POST /deals/:dealId/ship` — `{ phone, pin }`
- `POST /deals/:dealId/deliver` — `{ phone, pin }`
- `POST /deals/:dealId/dispute` — `{ phone, pin, reasonCode }`
- `POST /deals/:dealId/revoke/request` — `{ phone, pin }`
- `POST /deals/:dealId/revoke/confirm` — `{ phone, pin }`
- `POST /deals/:dealId/revoke/unilateral` — `{ phone, pin }`
- `GET /users/:phone/deals` — returns the role-segmented active deal list from Section 7
- `GET /deals/:dealId` — full deal detail (for debugging/admin use)

### 11.3 Consistent response contract
- Every endpoint should return a consistent shape (`{ success, data, error }`) so the future USSD layer (Phase 3) and Admin Portal (Phase 4) can consume it predictably without bespoke parsing per endpoint.

### 11.4 Input validation
- Validate phone number formats, amount positivity, dealId existence, etc. at the API boundary before touching PIN/contract logic — fail fast with clear error messages.

**Exit criteria for Section 11:** every endpoint above is implemented, and a complete deal lifecycle (happy path) and a complete dispute path can each be executed via a sequence of Postman/curl calls, with correct on-chain and database state at every step.

---

## 12. Testing Strategy for Phase 2

### 12.1 Unit tests
- Wallet generation/encryption/decryption round-trip.
- PIN hashing, verification, lockout logic (using mocked time).
- Contract wrapper functions against a local Hardhat node (spin up Hardhat node in test setup, deploy Phase 1 contracts fresh for each test run or test suite).

### 12.2 Integration tests
- Full lifecycle test: create → lock → ship → deliver → time-warp → keeper release → confirm final balances and final `deals` table status.
- Full dispute lifecycle test: create → lock → ship → deliver → dispute → admin resolves (each of the three outcomes) → confirm balances/statuses.
- Multi-deal role-switching integration test: one phone number across three deals, three different roles, confirm no cross-contamination in the indexing query.
- Keeper job idempotency test: run the keeper sweep twice in a row on the same set of deals, confirm no duplicate transactions/errors on the second run.
- Event listener resilience test: simulate a backend restart mid-lifecycle (stop and restart the listener service) and confirm it correctly resumes from `last_synced_block` without missing events.

### 12.3 Load/concurrency sanity check
- Simulate several deals progressing concurrently (e.g., 5-10 parallel lifecycles) to surface nonce management issues (Section 5.3/6.3) early, before Phase 3 adds real user concurrency on top.

**Exit criteria for Section 12:** all unit and integration tests pass reliably (including on repeated runs, to catch flaky async/timing issues), and the concurrency sanity check completes without nonce or race-condition errors.

---

## 13. Security & Operational Hardening Checklist

- [ ] Private keys never logged, never returned in any API response, never stored unencrypted.
- [ ] PINs never logged in plaintext, only hashes stored.
- [ ] All API inputs validated and sanitized.
- [ ] Rate limiting on PIN-verification endpoints (in addition to the 5-attempt lockout) to slow down brute-force attempts at the network level.
- [ ] Treasury/relay wallet balance monitored with a low-balance warning.
- [ ] All environment secrets loaded from `.env`/secret manager, never hardcoded.
- [ ] Structured logging (not just `console.log`) for all financial actions, with enough context to reconstruct any deal's history from logs alone if the database were ever lost.
- [ ] Documented gap: no automated PIN reset / wallet recovery mechanism yet (deferred, as noted in Sections 3.4 and 4.3).

---

## 14. Documentation Deliverables for Phase 2

Before moving to Phase 3, produce:
- **`API.md`** — full endpoint reference (request/response shapes, error codes) so Phase 3's USSD layer can be built directly against it.
- **`ARCHITECTURE.md`** (backend-specific) — diagram of services (wallet manager, PIN auth, contract wrapper, event listener, keeper, notification layer) and how they interact.
- Updated **decisions log** from Phase 1, appended with the gas-relay pattern chosen (Section 6.1) and any resulting adjustments to contract call conventions.

---

## 15. Summary Checklist

- [ ] Node.js/Express project scaffolded, connected to Postgres and blockchain RPC
- [ ] Database schema (`users`, `deals`, `deal_action_log`, `notifications_log`) migrated
- [ ] Custodial wallet generation, encryption, and signing implemented
- [ ] PIN system implemented with hashing, attempt tracking, and lockout
- [ ] Contract wrapper functions implemented for every Phase 1 function
- [ ] Gas relay pattern chosen and implemented (treasury top-up recommended)
- [ ] Multi-deal, role-segmented indexing query implemented
- [ ] Event listener service implemented and reconciliation job in place
- [ ] Scheduled keeper jobs (auto-cancel + auto-release) implemented and tested
- [ ] Simulated notification/triangular broadcast layer implemented
- [ ] Full REST API layer implemented for direct testing
- [ ] Unit, integration, and concurrency tests passing
- [ ] Security/operational hardening checklist completed
- [ ] `API.md`, `ARCHITECTURE.md`, and updated decisions log written

Once every box above is checked, you can run a complete deal — including a dispute and an arbitration resolution — purely through API calls, with correct blockchain state, correct database sync, and correct simulated notifications. That gives Phase 3 (USSD Simulation Layer) a stable, fully-functional backend to sit on top of, so it becomes purely a UX/menu-building exercise rather than a place where new business logic gets invented under time pressure.
