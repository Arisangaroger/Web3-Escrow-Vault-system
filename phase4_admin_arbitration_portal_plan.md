# Phase 4 — Admin Arbitration Portal
## Full Detailed Implementation Plan

**Scope:** This phase builds the web dashboard used by the Cooperative Manager / Market Authority (the "4th party") to review disputed deals and issue a final, binding resolution. Unlike Phases 1–3, this is a conventional web application (not USSD-constrained), so it can use a richer, smartphone/desktop-appropriate interface. This phase can be built in parallel with Phase 3, since it depends only on Phase 2's backend API and database, not on the USSD layer.

By the end of this phase, an admin should be able to log in, see a queue of active disputes with full audit context, physically go verify the situation, and click a single resolution button that correctly moves funds on-chain via Phase 1's `resolveDispute` function — with the outcome immediately reflected back to all three original parties via the existing notification layer.

---

## 1. Technology & Project Setup

### 1.1 Stack decision
- **Frontend:** A React single-page app (consistent with the project's broader Web3/JS stack) — can be built as a standard Vite/CRA app, or, if you want to keep it very lightweight for a prototype, server-rendered pages (e.g. a simple Express + EJS/Handlebars admin panel) are also acceptable given this is an internal tool, not a polished public product. **Recommendation:** React SPA, since you'll likely want to reuse component patterns (tables, timelines, buttons) and it keeps a consistent tech stack with the rest of the project.
- **Backend:** Extend the existing Phase 2 backend with a new set of **admin-only** API routes, rather than building a separate backend service — this avoids duplicating database/contract-access logic.
- **Auth:** Simple session-based or JWT-based authentication scoped to a small, fixed set of admin accounts (Section 3).

### 1.2 Project structure
```
/admin-portal (new frontend app)
  /src
    /pages        → DisputeQueue, DisputeDetail, Login
    /components   → Timeline, ResolutionButtons, DealSummaryCard
    /api           → client wrapper calling backend admin routes
/src (existing Phase 2 backend, extended)
  /api
    /admin         → new admin-only route handlers
  /middleware
    adminAuth.js   → route protection
```

**Exit criteria for Section 1:** a bare React app is scaffolded and can successfully call a placeholder "hello admin" endpoint on the extended backend, confirming the connection works before real features are added.

---

## 2. Admin Data Model Additions

### 2.1 `admins` table (new, in the existing Phase 2 database)
| Column | Type | Notes |
|---|---|---|
| `admin_id` | PK | |
| `name` | string | Display name (e.g. "Musanze Cooperative Manager") |
| `email` or `phone` | string, unique | Login identifier |
| `password_hash` | string | Hashed (bcrypt/argon2), never plaintext |
| `wallet_address` | string | Must match the address granted `ADMIN_ROLE` on the Phase 1 Escrow contract |
| `created_at` | timestamp | |
| `last_login_at` | timestamp, nullable | |

### 2.2 Linking to Phase 1's on-chain admin role
- Confirm (per Phase 1 Section 4.7) whether the contract supports a single hardcoded admin or multiple admin addresses via `AccessControl`. If multiple cooperative managers are expected eventually, ensure each `admins` row's `wallet_address` has been granted `ADMIN_ROLE` on-chain — document this as a manual/scripted onboarding step (`scripts/grantAdminRole.js`) since admin accounts won't be self-service in this phase.

### 2.3 Reuse of existing tables
- `deals`, `deal_action_log`, and `notifications_log` (from Phase 2) are read directly by this portal — no duplication needed. The portal is primarily a **read-and-act** interface layered on data that already exists.

**Exit criteria for Section 2:** `admins` table created and migrated; at least one seeded admin account exists with a wallet address confirmed to hold `ADMIN_ROLE` on the deployed Escrow contract.

---

## 3. Admin Authentication

### 3.1 Login flow
- Simple email/phone + password login form.
- Backend endpoint `POST /admin/login` verifies credentials, issues a session token (JWT recommended for simplicity, stored in an HTTP-only cookie or returned for the SPA to hold in memory).

### 3.2 Session/route protection
- `adminAuth` middleware on every `/admin/*` backend route, validating the token and attaching the authenticated admin's identity (including their `wallet_address`) to the request context.
- Frontend route guarding — redirect to login if no valid session, on every protected page load.

### 3.3 Security considerations
- Rate-limit login attempts (mirroring the PIN lockout philosophy from Phase 2 — e.g., a small number of failed attempts before a temporary lockout) since this account controls real fund-moving authority.
- Since the admin's `wallet_address` is what actually signs `resolveDispute` on-chain, decide whether:
  - **Option A (simpler):** the backend holds the admin's private key custodially (same pattern as Phase 2's user wallets) and signs on their behalf once they're authenticated via password login — recommended for a prototype, consistent with the rest of the system's custodial design.
  - **Option B (more "correct" but heavier):** the admin holds their own wallet/private key and signs transactions client-side (e.g. via a browser extension wallet) — likely overkill for a learning-stage internal tool, but worth noting as the more decentralized alternative.
- **Recommendation:** Option A, for consistency with the custodial pattern already established, and because a market/cooperative manager is no more likely to manage a crypto wallet than a farmer is.

**Exit criteria for Section 3:** an admin can log in with correct credentials, is rejected with incorrect ones (with lockout behavior after repeated failures), and every subsequent admin API call correctly identifies and authorizes them.

---

## 4. Dispute Queue (Main Admin View)

### 4.1 Backend endpoint
`GET /admin/disputes` — returns all deals where `status = Disputed`, joined with basic summary info:
```json
[
  {
    "dealId": 9872,
    "amount": 500000,
    "senderPhone": "...",
    "driverPhone": "...",
    "receiverPhone": "...",
    "disputeReasonCode": 1,
    "disputedAt": "..."
  }
]
```

### 4.2 Frontend queue view
- A simple table/list showing each active dispute: Deal ID, amount, dispute reason (human-readable, mapped from the reason code), time since disputed, and a "Review" action linking to the detail page.
- Sort by oldest-disputed-first by default, so nothing sits unresolved indefinitely without visibility.
- Optional (nice-to-have): a badge/count of "disputes older than X hours" to visually flag urgency.

### 4.3 Empty state
- Clear "No active disputes" message when the queue is empty — avoid a blank/broken-looking screen.

**Exit criteria for Section 4:** logging in as a seeded admin shows a correctly populated (or correctly empty) dispute queue, matching actual `Disputed`-status deals in the database.

---

## 5. Dispute Detail View (The Core Screen)

This is the most important screen in the portal — it needs to give the admin everything necessary to make a fair, fast, real-world decision, per your original design in the concept note (Section 7.6).

### 5.1 Backend endpoint
`GET /admin/disputes/:dealId` — returns:
- Full deal record (amount, parties, current status, all timestamps: `createdAt`, `fundLockDeadline`, `payoutReadyTime`, etc.)
- Full ordered `deal_action_log` entries for this deal (every action, actor, and timestamp)
- The dispute reason code/text
- (Optional, valuable) any notification log entries for this deal, so the admin can also see exactly what each party was told and when

### 5.2 Frontend layout
- **Header summary card:** Deal ID, amount, current status, dispute reason, all three parties' phone numbers.
- **Timeline component:** a clear, chronological visual list of every action — e.g.:
  ```
  08:00 — Farmer marked "Shipped"
  11:15 — Driver marked "Delivered"
  11:20 — Buyer raised Dispute: "Driver Lying About Delivery"
  ```
  This is exactly the evidence that would, for example, prove a driver marked "Delivered" suspiciously early relative to a realistic travel time — the admin should be able to read this timeline and immediately spot that kind of red flag, per your original design intent.
- **Resolution panel:** three clearly labeled buttons matching Phase 1's outcomes:
  - "Driver Fraud — Refund Buyer"
  - "Faulty Goods — Refund Buyer, Honor Transport"
  - "False Buyer Claim — Force Payout to Farmer"
- Each button triggers a confirmation modal before submission (since this is an irreversible, fund-moving action) — e.g. "Are you sure? This will refund 500,000 RWF to the buyer and cannot be undone."

### 5.3 Guarding against acting on stale/incorrect data
- Before allowing a resolution action to submit, re-fetch the deal's current status to confirm it's still `Disputed` (in case, hypothetically, of some edge case where state changed) — avoid submitting a resolution against a deal that's no longer in the expected state.

**Exit criteria for Section 5:** opening a disputed deal's detail page shows an accurate, complete, correctly-ordered timeline and full party/amount details, matching what's actually stored in `deal_action_log`.

---

## 6. Resolution Execution

### 6.1 Backend endpoint
`POST /admin/disputes/:dealId/resolve` — body: `{ outcome: "DriverFraud" | "FaultyGoods" | "FalseBuyerClaim" }`
- Validates the authenticated admin's session (Section 3).
- Validates the deal is still in `Disputed` status (Section 5.3).
- Calls Phase 2's `resolveDisputeOnChain(adminWallet, dealId, outcome)` wrapper (built in Phase 2 Section 5.1), using the admin's custodial wallet (Section 3.3, Option A).
- Waits for on-chain confirmation, or immediately returns a "Processing" response and lets the event listener (Phase 2 Section 8) update final state asynchronously — **recommendation:** since this is a desktop/web interface (not USSD-timeout-constrained), it's acceptable to wait synchronously for confirmation here and show a loading spinner, unlike the USSD layer's async necessity.

### 6.2 Post-resolution feedback
- On confirmation, the frontend should show a clear success state ("Resolved: Driver Fraud — 500,000 RWF refunded to buyer"), and the deal should disappear from the active dispute queue on next load.
- The existing Phase 2 notification layer (already wired to the `DisputeResolved` event) handles informing all three original parties — no new notification logic needed here, just confirm it fires correctly end-to-end from this new entry point.

### 6.3 Audit logging of admin actions
- Insert a record into `deal_action_log` (or a dedicated `admin_actions` table, if you want to separate "system/party actions" from "admin actions" for clarity) capturing: which admin resolved which dispute, with which outcome, at what time — this is important accountability data, especially once multiple admins might exist.

**Exit criteria for Section 6:** clicking a resolution button on a real disputed test deal correctly executes the on-chain transaction, correctly updates the deal's final status, correctly removes it from the queue, and correctly triggers notifications to all three original parties (visible in the Phase 3 simulator's SMS inbox panel, if testing end-to-end).

---

## 7. Resolved/Historical Disputes View (Supporting Transparency & Trust)

### 7.1 Purpose
Beyond the active queue, a secondary view showing **past resolved disputes** is valuable both for admin accountability and for building trust in the system (e.g., a cooperative could point to a track record of fair, documented resolutions).

### 7.2 Backend endpoint
`GET /admin/disputes/history` — returns all deals with status `Refunded` or `Released` that originated from a `Disputed` state, along with which admin resolved them and the outcome chosen.

### 7.3 Frontend view
- A simple filterable/searchable table (by date range, outcome type, or admin) — a table is sufficient for a prototype; no need for advanced analytics yet.

**Exit criteria for Section 7:** after resolving a test dispute in Section 6, it correctly appears in this historical view with the correct outcome and admin attribution.

---

## 8. Optional/Stretch Features (Not Required for Prototype Completion)

These are worth listing explicitly as **deliberately deferred**, so they don't get treated as gaps in your design:

- **Multi-admin role separation** (e.g., senior admin vs. junior reviewer) — not needed while a single admin role suffices per your Section 9 "keep it simple" decision from the concept note.
- **Photo/evidence upload** during dispute resolution (e.g., admin uploads a photo of the rotten potatoes as part of the record) — valuable for a production system, out of scope for this prototype phase.
- **In-portal messaging with the disputing parties** — currently, all party communication happens via the existing SMS/notification layer; a two-way chat isn't part of this phase.
- **Analytics/dashboards** (dispute frequency by region, average resolution time, etc.) — nice for a pitch deck later, not required for functional completeness.

---

## 9. Testing Strategy

### 9.1 Backend tests
- Admin login success/failure/lockout.
- `GET /admin/disputes` correctly filters to only `Disputed` status deals.
- `GET /admin/disputes/:dealId` returns a complete, correctly-ordered action log.
- `POST /admin/disputes/:dealId/resolve` correctly calls the on-chain function for each of the three outcomes, correctly updates local state, and correctly rejects if the deal isn't in `Disputed` status.
- Non-admin (unauthenticated or invalid token) requests to any `/admin/*` route are rejected.

### 9.2 Frontend tests
- Dispute queue renders correctly from mock/real API data, including the empty state.
- Dispute detail timeline renders in correct chronological order.
- Resolution confirmation modal correctly blocks accidental submission (requires explicit confirm).
- Success/error states render clearly after a resolution attempt.

### 9.3 End-to-end integration test (ties Phases 2–4 together)
- Using the Phase 3 simulator to create a real dispute (three simulated phones: sender ships, driver delivers, receiver disputes), then log into the Phase 4 admin portal, confirm the exact same dispute appears with an accurate timeline, resolve it, and confirm all three simulated phones receive the correct final notification in their simulated SMS inbox.

**Exit criteria for Section 9:** the full integration test in 9.3 passes — proving Phases 2, 3, and 4 genuinely work together as one coherent system, not just independently.

---

## 10. Security & Operational Hardening Checklist

- [ ] Admin passwords hashed, never stored/logged in plaintext.
- [ ] Admin session tokens expire after a reasonable period of inactivity.
- [ ] All `/admin/*` routes require valid authentication — no accidental open endpoints.
- [ ] Resolution actions require explicit confirmation before submission (no single-click irreversible fund movement).
- [ ] Admin wallet's custodial private key handled with the same encryption discipline as user wallets (Phase 2 Section 3.2).
- [ ] Every resolution action is attributably logged (which admin, which outcome, when).
- [ ] Rate limiting on the admin login endpoint.

---

## 11. Documentation Deliverables for Phase 4

- **`ADMIN_PORTAL.md`** — describes the login flow, the dispute queue, the detail/timeline view, and the resolution action mapping to Phase 1's contract outcomes.
- A short addition to the project's overall `ARCHITECTURE.md` showing where the Admin Portal sits relative to the backend and contract layers (it's a client of Phase 2's API, just like the USSD layer is — worth diagramming both as parallel consumers of the same backend).
- Updated decisions log noting the chosen admin-wallet custody pattern (Section 3.3, Option A) and the single-admin-role simplification (Section 8) for future reference if you ever revisit multi-admin support.

---

## 12. Summary Checklist

- [ ] React admin portal frontend scaffolded, connected to a placeholder backend endpoint
- [ ] `admins` table created, seeded with at least one account holding a valid on-chain `ADMIN_ROLE` wallet
- [ ] Admin login/authentication implemented with lockout protection
- [ ] Dispute queue view implemented, correctly filtered and sorted
- [ ] Dispute detail view implemented with full accurate timeline and party/amount summary
- [ ] Resolution execution implemented for all three outcomes, wired to Phase 1's `resolveDispute` via Phase 2's wrapper
- [ ] Resolution confirmation modal and post-resolution feedback implemented
- [ ] Admin action audit logging implemented
- [ ] Historical/resolved disputes view implemented
- [ ] Backend and frontend unit tests passing
- [ ] Full end-to-end integration test (Phase 3 simulator → dispute → Phase 4 resolution → notification confirmation) passing
- [ ] Security/operational hardening checklist completed
- [ ] `ADMIN_PORTAL.md` and updated `ARCHITECTURE.md`/decisions log written

Once every box above is checked, your system has a genuinely complete fraud-resolution loop: a dispute raised on a simulated feature phone can be reviewed with full context and resolved by a human arbitrator through a proper web tool, with funds moving correctly on-chain and every original party correctly informed of the outcome — closing the last major functional gap before Phase 5's polish and demo work.
