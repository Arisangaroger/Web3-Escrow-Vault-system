# Phase 3 — USSD Simulation Layer
## Full Detailed Implementation Plan

**Scope:** This phase builds the user-facing interaction layer — a custom backend-based simulator standing in for a real telecom USSD gateway (e.g. Africa's Talking), plus the full menu tree, session handling, and PIN flows that let a person complete an entire deal lifecycle using nothing but simulated "dial and respond" interactions. By the end of this phase, someone should be able to sit down at a simple interface (a web form or CLI mimicking a feature phone screen) and run a complete happy-path deal and a complete dispute path, with every action routed through the Phase 2 backend API — **no new business logic gets invented in this phase**; it is purely a UX/session/menu-building exercise on top of an already-complete backend.

---

## 1. Understanding Real USSD Behavior (Design Constraints to Replicate)

Before building the simulator, it's worth being explicit about the real-world constraints your simulator must faithfully reproduce, since these shape every decision below:

- **Session-based, not connection-based.** A USSD session is a back-and-forth of short requests/responses tied together by a `sessionId`, not a persistent open connection. Each "screen" the user sees is a fresh HTTP request from the telecom gateway to your server, carrying the accumulated input so far.
- **Short timeouts.** Real USSD sessions typically expire after 20–30 seconds of user inactivity between screens. Your simulator should replicate this so your backend logic (async blockchain calls returning "Processing…" instead of blocking) gets tested realistically rather than assuming unlimited time.
- **Text-only, narrow screen.** Real feature phones display very limited characters per screen (often ~182 characters total including the menu). Menus must be concise.
- **One request/response cycle per screen.** The gateway calls your server with the user's latest input; your server replies with either `CON` (continue session, show another menu) or `END` (terminate session, show final message) — this `CON`/`END` contract is the standard Africa's Talking-style protocol, and matching it now means a real gateway can be substituted later with minimal rework.

**Design decision to lock in now:** build the simulator's HTTP contract to exactly match this `CON`/`END`, `sessionId`+`phoneNumber`+`text` request shape (detailed in Section 3), even though you're not using a real gateway yet. This is the single most important decision in this phase for future-proofing.

---

## 2. Technology & Project Setup

### 2.1 Two components to build
1. **The USSD Simulator "Gateway"** — a minimal front-end (simple HTML page or CLI tool) that mimics what a feature phone screen + telecom network would do: accepts digit input, displays text responses, manages a fake "session," and calls your USSD application server the same way a real gateway would.
2. **The USSD Application Server** — the actual menu-tree logic, session state management, and integration with the Phase 2 backend API. This is the part that would be reused unchanged if you swapped in a real gateway later.

### 2.2 Recommended stack
- Reuse Node.js/Express (consistent with Phase 2) for the USSD Application Server — it can even live in the same backend project as a new set of routes, or as a separate service calling Phase 2's API over HTTP, depending on how modular you want to keep things. **Recommendation:** separate service/module calling Phase 2's REST API, to keep the "menu/session" concern cleanly decoupled from "business logic," matching the same separation-of-concerns principle used between Phase 1 and Phase 2.
- Simulator "Gateway" front-end: a simple HTML/JS page (an artifact-style single-page tool) that lets you type a phone number, dial the shortcode, and exchange text messages back and forth — good enough to demo and to manually test with multiple simulated phones in different browser tabs.

### 2.3 Project structure
```
/ussd-service
  /session         → session state store, timeout handling
  /menus           → menu tree definitions per screen/state
  /client          → thin HTTP client calling Phase 2's backend API
  /server.js       → CON/END protocol handler
/ussd-simulator-ui → simple front-end mimicking a feature phone
```

**Exit criteria for Section 2:** both components scaffolded; the simulator UI can send a raw "dial" request to the USSD Application Server and receive back a hardcoded placeholder menu, proving the plumbing works before any real logic is added.

---

## 3. The Gateway Contract (CON/END Protocol)

### 3.1 Request shape (mimicking Africa's Talking style)
Every request from the simulator "gateway" to your USSD Application Server carries:
```json
{
  "sessionId": "abc123",
  "phoneNumber": "+250788000000",
  "text": "1*2"   // accumulated user input this session, separated by *
}
```
The `text` field accumulates every input the user has entered so far in the session, separated by `*` — this is how a stateless-looking request can still be resolved to "which screen am I on," although you will **also** maintain explicit server-side session state (Section 4) rather than relying purely on parsing `text`, since your menus are dynamic (deal lists differ per user) and can't be fully derived from position alone.

### 3.2 Response shape
Your server replies with plain text prefixed by:
- `CON <message>` — session continues, simulator should show `<message>` and wait for more input.
- `END <message>` — session terminates, simulator shows `<message>` as a final screen.

### 3.3 Why explicit server-side session state is still needed
Because your menus are **dynamic** (e.g., "My Deliveries" lists whatever deals are currently active for that phone number, which can change between screens if something completes mid-session), you cannot rely solely on the `*`-separated `text` position to know what to show next. Maintain a session store (Section 4) keyed by `sessionId` that tracks: current menu node, any selections made so far (e.g., which deal was picked, which action is pending PIN confirmation), and a server-side timestamp for the timeout check.

**Exit criteria for Section 3:** a documented request/response contract (`USSD_PROTOCOL.md`) exists, and a basic echo test (simulator sends "1", server replies `CON You selected 1`) works end-to-end.

---

## 4. Session State Management

### 4.1 Session store choice
- Use an in-memory store (simple `Map`) for a prototype, or Redis if you want resilience across server restarts (recommended if you already introduced Redis in Phase 2 for queueing — otherwise in-memory is fine for a learning-stage build, just document the limitation that a server restart would drop active sessions).

### 4.2 Session data shape
```json
{
  "sessionId": "abc123",
  "phoneNumber": "+250788000000",
  "currentNode": "MAIN_MENU" | "SELECT_ROLE_CATEGORY" | "SELECT_DEAL" | "ENTER_PIN" | "CONFIRM_ACTION" | ...,
  "context": {
    "selectedCategory": "asDriver",
    "selectedDealId": 9872,
    "pendingAction": "markDelivered"
  },
  "createdAt": 1735000000,
  "lastActivityAt": 1735000010
}
```

### 4.3 Timeout enforcement
- On every incoming request, first check `lastActivityAt` against a configured timeout threshold (e.g., 20–30 seconds, matching real USSD behavior per Section 1). If expired, discard the session, respond with `END Session expired. Please dial again.`
- Update `lastActivityAt` on every valid request.

### 4.4 Session cleanup
- A lightweight periodic sweep (or lazy cleanup on next access) to evict expired sessions from the store, preventing unbounded memory growth over time.

**Exit criteria for Section 4:** a session that goes quiet for longer than the configured timeout correctly returns an expiry message on the next request, and a session that stays active within the window correctly persists context (e.g., a previously selected deal ID) across multiple request/response cycles.

---

## 5. Menu Tree Design

### 5.1 First-time user flow (PIN setup)
Before anything else, check whether the phone number exists in the backend's `users` table (via a Phase 2 API call). If not:
```
CON Welcome to the Escrow Platform.
Set your secret 4-digit PIN:
```
→ capture input, confirm by re-entering:
```
CON Confirm your 4-digit PIN:
```
→ on match, call Phase 2's `POST /users/:phone/pin`, then proceed to Main Menu. On mismatch, re-prompt (with a small retry limit to avoid infinite loops within one session).

### 5.2 Main menu
```
CON Escrow Main Menu:
1. My Shipments (Seller)
2. My Deliveries (Driver)
3. My Purchases (Buyer)
4. Create New Deal
```
- Before rendering, call Phase 2's `GET /users/:phone/deals` to get the role-segmented list, so the menu can optionally show counts (e.g., "My Deliveries (2)") — a nice UX touch, not strictly required for a functional prototype but easy to add.

### 5.3 Role category → deal list
Selecting option 1/2/3 calls the appropriate segment of the already-fetched deal list and renders an indexed list:
```
CON My Deliveries:
1. Kigali Market (Kimironko) - 50 Sacks
2. Nyabugogo Wholesale - 30 Sacks
3. Remera Grocery - 20 Sacks
0. Back
```
- Store the selected `dealId` in session context on numeric selection.
- Handle the "0. Back" convention consistently across all submenus.

### 5.4 Deal detail / available actions menu
Once a specific deal is selected, the menu shown must depend on **both** the user's role in that deal **and** the deal's current status (fetched via `GET /deals/:dealId`), e.g.:

| Role | Status | Menu Shown |
|---|---|---|
| Receiver | `Created` | "1. Lock Funds  2. Cancel Deal" |
| Receiver | `FundsLocked` | "1. Revoke (Request)  2. View Status" |
| Sender | `FundsLocked` | "1. Mark Shipped  2. Request Revoke" |
| Driver | `Shipped` | "1. Mark Delivered" |
| Receiver | `Delivered` (within window) | "1. Confirm/Do Nothing  2. Dispute" |
| Any | Terminal states | "1. View Summary" only |

This mapping should be built as an explicit lookup table/function — `getAvailableActions(role, status)` — rather than scattered conditionals, so it's easy to audit against your Phase 1 state machine and catch any mismatched/missing states.

### 5.5 Action confirmation + PIN entry
Every state-changing action (lock funds, mark shipped, mark delivered, dispute, revoke) follows a consistent sub-flow:
```
CON Confirm: Mark this delivery as DELIVERED?
1. Yes
2. No
```
→ on "Yes":
```
CON Enter your 4-digit PIN to confirm:
```
→ capture PIN, call the relevant Phase 2 endpoint with `{ phone, pin }`, then:
- On success: `END Delivery marked. All parties have been notified.`
- On PIN failure: `CON Incorrect PIN. X attempts remaining. Enter PIN:` (or `END Account locked for 15 minutes.` if lockout triggered — reflecting Phase 2's lockout response).
- On business-logic failure (e.g., deadline passed): `END This action is no longer available: <clean error message from Phase 2's error decoding layer>`.

### 5.6 Deal creation flow
```
CON Create New Deal
Enter Receiver's phone number:
```
→
```
CON Enter Driver's phone number:
```
→
```
CON Enter Deal Amount (RWF):
```
→
```
CON Confirm: Create deal for <amount> RWF with Receiver <phone> and Driver <phone>?
1. Yes
2. No
```
→ PIN confirmation → call Phase 2's `POST /deals` → `END Deal created. ID: <dealId>. Awaiting funds lock.`

- **Validation at each step:** phone number format check before moving to the next screen (re-prompt with an error rather than silently accepting bad input and failing later at the API layer).

### 5.7 Dispute reason sub-menu
When a receiver selects "Dispute" from the delivered-state action menu:
```
CON Select Dispute Reason:
1. Rotten/Damaged Goods
2. Driver Lying About Delivery
3. Incorrect Quantity
4. Other
```
→ maps directly to the `reasonCode` values locked in during Phase 1 (Section 4.5 of that plan) → proceeds to PIN confirmation as in 5.5.

### 5.8 Mutual revoke sub-flow
Since mutual revoke needs two separate people's confirmations, the menu must correctly reflect **which side of the revoke handshake the current user is on**:
- If `revokeRequestedBy` is empty → show "Request Revoke."
- If `revokeRequestedBy` is set to the *other* party → show "Confirm Revoke (requested by [counterparty])."
- If `revokeRequestedBy` is set to *this same user* → show "Revoke Requested — Awaiting Other Party" (no further action available from this side, just a status message).

**Exit criteria for Section 5:** a complete menu tree diagram/spec document exists (`MENU_TREE.md`) mapping every screen, every input, and every corresponding Phase 2 API call — reviewable end-to-end before writing the traversal code.

---

## 6. Menu Tree Implementation

### 6.1 Represent the tree as data, not nested if/else
Recommend defining menus as a structured configuration (a set of "node" objects with `id`, `render(context)`, `onInput(input, context)` returning the next node) rather than deeply nested conditional logic — this keeps the tree auditable and testable node-by-node, and makes it easy to spot any state from Section 5.4's table that hasn't been wired up.

### 6.2 Node handler responsibilities
Each node handler should:
1. Optionally call the Phase 2 API to fetch fresh data needed to render (e.g., deal list, deal detail).
2. Render the appropriate `CON`/`END` text.
3. On receiving the next input, validate it, update session context, and determine the next node.

### 6.3 Async/"Processing" handling
Since some backend actions (Section on Phase 2's contract calls) may take longer than a single USSD screen's timeout tolerance in a real gateway, replicate this constraint:
- For any action that triggers an on-chain write, immediately respond with `END Processing your request. You will receive an SMS confirmation shortly.` rather than blocking the USSD response on transaction confirmation.
- The actual confirmation (success/failure) is delivered via the notification layer (Phase 2 Section 10) as a simulated SMS, which your simulator's "SMS inbox" view (Section 8) can display.
- This is an important, deliberate design choice to test now — it validates that your system doesn't silently assume synchronous blockchain confirmation, a mistake that would fail badly against a real gateway's 20-30 second timeout.

**Exit criteria for Section 6:** the menu tree is implemented as data-driven node definitions, and every node from the `MENU_TREE.md` spec has a working handler; state-changing actions correctly respond with an immediate "Processing" message rather than blocking on-chain confirmation.

---

## 7. The Simulator "Gateway" Front-End

### 7.1 Purpose
A simple tool to let you (and anyone testing/demoing the project) simulate multiple different feature phones interacting with the system simultaneously, without needing real telecom infrastructure.

### 7.2 Features to build
- A simple interface where you can enter/select a phone number (simulating "whose phone this is"), see a text screen mimicking a feature phone display, and type digit input to respond — reproducing the "dial → see menu → type digit → see next menu" cycle.
- Support running **multiple independent simulated phones at once** (e.g., multiple browser tabs, or a multi-panel view — one for the buyer, one for the sender, one for the driver) so you can manually walk through a full three-party deal lifecycle in one sitting, watching each party's screen update independently.
- A visible "session expired" state when the timeout fires, matching the real behavior from Section 4.3.

### 7.3 Where this fits architecturally
This front-end talks **only** to the USSD Application Server's `CON`/`END` endpoint — it has zero direct knowledge of Phase 2's API or the blockchain. This mirrors reality: a real telecom gateway also only ever talks to your USSD Application Server via this same protocol. Keeping this boundary clean now is exactly what makes swapping in Africa's Talking later a non-event.

**Exit criteria for Section 7:** you can open three separate simulated "phones" (one per role) and manually complete a full deal — creation, locking, shipping, delivery, and either release or dispute — using only typed digit input, with no direct database/API access outside the simulator.

---

## 8. Simulated SMS Inbox (Supporting the Triangular Broadcast)

### 8.1 Why this is needed in this phase
Phase 2 already logs simulated notifications to a database table. Phase 3 needs a way to actually *see* those messages per simulated phone number, since your entire dispute-detection design depends on the buyer seeing a "Delivered" alert in near-real time.

### 8.2 Implementation
- A simple panel in the simulator UI per phone number, polling `GET /notifications/:phone` (a small new Phase 2-adjacent endpoint, or reuse the `notifications_log` table via a direct query) and displaying messages in order, newest last — mimicking an SMS inbox.
- This is what makes the "driver falsely clicks Delivered while still on the highway → buyer immediately sees the alert and disputes" scenario something you can actually **demonstrate**, not just describe.

**Exit criteria for Section 8:** triggering `markDelivered` on the "driver" simulated phone causes a visible new message to appear within moments on both the "sender" and "receiver" simulated phones' inbox panels.

---

## 9. Validation & Error Handling in the USSD Layer

### 9.1 Input validation per screen
- Phone number screens: reject non-numeric or malformed input with a clear re-prompt, not a crash.
- Amount screens: reject non-numeric or zero/negative amounts.
- Menu selection screens: reject out-of-range numeric choices, or non-numeric input, with a re-prompt (`CON Invalid choice. Please try again:` + re-render the same menu) — do not let an invalid keystroke silently advance the session or crash it.

### 9.2 Backend error surfacing
- Reuse Phase 2's clean error-decoding layer (Section 5.2 of the Phase 2 plan) so that any contract-level revert reaches the user as a short, plain-language `END` message rather than a raw error dump.

### 9.3 Defensive session guards
- Guard against a user attempting to act on a `dealId` no longer valid for their session/role (e.g., session context references a deal that has since closed) — re-fetch and re-validate deal status immediately before executing any state-changing action, not just at menu-render time, since state can change between screens (e.g., another party disputes mid-session).

**Exit criteria for Section 9:** deliberately feeding invalid input at every screen (wrong format, out-of-range choice, stale deal reference) produces a graceful, understandable message rather than a broken session or server error.

---

## 10. Testing Strategy

### 10.1 Scripted end-to-end tests (headless, not manual)
In addition to manual testing via the simulator UI (Section 7), build automated tests that drive the USSD Application Server directly via its `CON`/`END` HTTP contract (bypassing the UI), so the full menu tree can be regression-tested without manual clicking:
- **Happy path script:** simulate all three phone numbers' request sequences end-to-end — create deal, lock funds, mark shipped, mark delivered, wait/time-warp, confirm final `END` release notification appears.
- **Dispute path script:** same, but the receiver disputes within the window; confirm the deal reaches `Disputed` status and the admin-resolution outcome (tested at the Phase 2 layer already) is reflected correctly if queried afterward.
- **Session timeout script:** send a request, wait past the timeout threshold, send a follow-up input, confirm the session-expired message is returned instead of stale context being reused.
- **PIN lockout script:** submit 5 incorrect PINs in a row within a session (or across sessions from the same number), confirm the 6th attempt is rejected with a lockout message regardless of correctness.
- **Multi-deal role-switching script:** simulate a single phone number navigating "My Shipments," then backing out and navigating "My Deliveries," confirming the correct, independent deal lists appear for each role.
- **Invalid input script:** for each screen type (phone entry, amount entry, menu choice), send malformed input and confirm graceful re-prompting rather than a crash.

### 10.2 Manual demo rehearsal
- Once scripted tests pass, do at least one full manual run-through using the actual simulator UI (Section 7) with three separate "phones," as a final human-facing sanity check and as rehearsal for your eventual demo recording (Phase 5).

**Exit criteria for Section 10:** all scripted end-to-end tests pass reliably, and a manual three-phone run-through of both the happy path and the dispute path succeeds without any direct database/API intervention outside the simulator.

---

## 11. Documentation Deliverables for Phase 3

- **`USSD_PROTOCOL.md`** — the exact `CON`/`END` request/response contract, so a real gateway integration later is a documented, scoped task rather than a rediscovery exercise.
- **`MENU_TREE.md`** — the full menu/node/state diagram from Section 5, kept as the living reference for the implemented tree.
- A short note in the concept note's "deferred limitations" section confirming: *"USSD interactions currently run against a custom-built simulator matching the Africa's Talking `CON`/`END` protocol; swapping in a live gateway is a scoped integration task, not a redesign."*

---

## 12. Summary Checklist

- [ ] USSD Application Server scaffolded, implementing the `CON`/`END` protocol contract
- [ ] Session state store implemented with timeout enforcement and cleanup
- [ ] Full menu tree specified in `MENU_TREE.md` and implemented as data-driven nodes
- [ ] First-time PIN setup flow implemented
- [ ] Main menu + role-segmented deal list menus implemented
- [ ] Deal detail / available-actions-by-role-and-status logic implemented
- [ ] Action confirmation + PIN entry sub-flow implemented consistently across all actions
- [ ] Deal creation flow implemented with per-step input validation
- [ ] Dispute reason sub-menu implemented, mapped to Phase 1's reason codes
- [ ] Mutual revoke sub-flow correctly reflects requester/confirmer state
- [ ] Async "Processing" pattern implemented for all state-changing actions
- [ ] Simulator "Gateway" front-end built, supporting multiple simultaneous simulated phones
- [ ] Simulated SMS inbox panel implemented and wired to the notification layer
- [ ] Input validation and graceful error handling implemented at every screen
- [ ] Scripted end-to-end tests passing (happy path, dispute path, timeout, lockout, multi-deal, invalid input)
- [ ] Manual three-phone demo run-through completed successfully
- [ ] `USSD_PROTOCOL.md` and `MENU_TREE.md` written

Once every box above is checked, a complete deal — including a genuine dispute and its downstream resolution — can be run entirely through simulated feature-phone interaction, with no direct database, API, or blockchain access required by the person testing it. That's the point at which the project stops being "a smart contract with a backend" and becomes, functionally, the actual product you set out to build.
