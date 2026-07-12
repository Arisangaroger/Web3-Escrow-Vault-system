# Project Concept Note

## Programmable Escrow via USSD for Agricultural Trade

**A Web3-Powered Trust Layer for Feature-Phone Agricultural Commerce in Rwanda**

---

## 1. Executive Summary

This project is a trust-enabling payment and logistics coordination system for agricultural trade, designed for people who do not have smartphones, internet access, or crypto wallets. It allows farmers (or cooperatives), transporters, and buyers to safely conduct trade using simple USSD menus (e.g. `*123#`) on any basic feature phone — the same way Rwandans already use Mobile Money (MoMo).

Behind the simple phone menu sits a Web3 smart contract escrow system. Funds are locked when a deal is agreed, held safely while goods are in transit, and released automatically once delivery is confirmed — without requiring either party to trust the other, and without requiring either party to understand blockchain technology at all.

Because the National Bank of Rwanda (BNR) restricts the use of standard cryptocurrencies and unapproved stablecoins for consumer payment, the system transacts in a simulated digital currency (**eRWF**), architected to be a drop-in replacement for BNR's programmable e-Franc once that CBDC infrastructure goes live. This positions the project not just as a student/portfolio build, but as a forward-compatible prototype for Rwanda's digital currency future.

This is the third project in a three-step personal learning roadmap (Step 1: certificate verification platform, Step 2: supply chain application, Step 3: this project), each step deliberately building the skills required for the next.

---

## 2. The Problem

Agricultural trade between rural producers and urban buyers in Rwanda is built on a structural trust gap:

- **The Farmer's Fear:** "If I harvest and send my goods to Kigali, what stops the buyer from taking delivery and refusing to pay?"
- **The Buyer's Fear:** "If I send Mobile Money in advance, what stops the goods from never arriving, or arriving spoiled?"

This mutual distrust currently forces people into inefficient workarounds: relying on expensive middlemen, traveling long distances to transact face-to-face, or simply accepting financial risk as the cost of doing business. It disproportionately hurts smallholder farmers and cooperatives, who have the least power to absorb a loss.

---

## 3. The Solution — In Plain Terms

A **programmable escrow smart contract**, operated entirely through USSD, that enforces the rules of a trade automatically instead of relying on either party's honesty.

**The trade lifecycle, in one line:**

```
Buyer Locks Funds → Farmer Dispatches Goods → Driver Confirms Delivery → Funds Automatically Released
```

Because a feature phone cannot hold a private key or sign a blockchain transaction, a backend server acts as a secure, invisible bridge between the USSD menu and the smart contract. To the user, it feels exactly like using MoMo. Underneath, every action is a cryptographically signed, auditable blockchain event.

---

## 4. Why This Project, and Why Third in the Roadmap

| Step | Project | Skill Learned |
|---|---|---|
| 1 | Certificate Verification Platform | Data integrity fundamentals |
| 2 | Supply Chain Application | Tracking physical goods on-chain |
| 3 | **This Project** | Bridging feature-phone UX with financial smart contract logic, telecom integration, custodial wallet architecture |

This project intentionally combines the lessons of Steps 1 and 2 (data integrity + physical goods tracking) with real financial logic — escrow pools, timed releases, and dispute arbitration — which prepares the codebase for more advanced future work such as fractional community investment products.

---

## 5. Core Design Principles

These principles were arrived at through extensive workflow analysis and adversarial "what if someone tries to cheat" stress-testing, and they underpin every architectural decision below:

1. **Meet users where they are.** No app downloads, no wallets, no internet — just USSD and a PIN, like MoMo.
2. **Nobody should be able to hold anyone else hostage.** Every party has a way to be protected without depending on another party's goodwill.
3. **Radical transparency over hidden mediation.** All status updates broadcast to all parties in the deal, so a lie is visible immediately to the person it would hurt.
4. **Temporary, self-cleaning containers, not permanent accounts.** Deals exist as ephemeral "rooms" that appear at deal creation and are archived at deal completion — no heavyweight organizational registration.
5. **Role is per-transaction, not per-person.** The same phone number can be a seller in one deal, a driver in another, and a buyer in a third, all simultaneously.
6. **Complexity lives in the backend, not in the user's hands.** Wallets, keys, and gas fees are fully abstracted away from the end user.

---

## 6. Actors in the System

| Actor | Description | On-Chain Role |
|---|---|---|
| **Sender** | Farmer or cooperative selling goods | Escrow beneficiary; triggers "Shipped" |
| **Driver** | Transporter (individually engaged by the sender, outside the smart contract's financial scope) | Human oracle; triggers "Delivered" and starts the payout timer |
| **Receiver** | Buyer purchasing goods | Escrow depositor; can dispute within the timer window |
| **Admin (4th party)** | Cooperative manager / market authority | Tie-breaking arbitrator for disputes only |

**Note on the driver's financial role:** The driver is *not* paid through the smart contract. Payment terms between the driver and the farmer are a private, off-system agreement. The driver still requires a system identity (custodial wallet) because their "Delivered" click is a cryptographically signed event that starts the countdown timer — a purely logistical/oracle role, not a financial one.

---

## 7. The Trade Lifecycle (Detailed Workflow)

### 7.1 Deal Creation
- Any party (typically the sender) initiates a new deal via USSD, entering the receiver's phone number, driver's phone number, and the agreed amount.
- The system creates a temporary **Deal Container** (e.g. `DEAL-9872`) holding these three phone numbers, an amount, and a status.
- An SMS is broadcast to the other two parties inviting them to engage with the deal.

### 7.2 Fund Locking (with expiry)
- The buyer must lock funds within **24 hours** of deal creation.
- If the buyer does not lock funds within this window, the deal **auto-cancels** — no funds are at risk, the container is destroyed.
- Once locked, the buyer sees a **Revoke** option instead of a "lock" option.

### 7.3 Shipment
- The sender marks the deal **"Shipped"** via USSD once goods are dispatched.
- This action is broadcast to both the driver and the receiver.

### 7.4 Delivery Confirmation (The Core Security Mechanism)
- The driver marks the deal **"Delivered"** via USSD upon arrival.
- This action **triangularly broadcasts** to both the sender and the receiver simultaneously — critically, *before* the payout is final. If the driver falsely marks "Delivered" while still en route, the receiver (who does not yet have the goods) will see the alert and can immediately dispute.
- Marking "Delivered" starts a **3-hour countdown timer** (`payoutReadyTime`).

### 7.5 The Two Paths After Delivery

**Path A — Passive Release (Happy Path / Ghosting Buyer Path)**
If the 3-hour window elapses with no dispute raised, the smart contract automatically releases the full locked amount to the sender. This protects the sender/driver from a buyer who received goods in good order but refuses to formally confirm out of laziness or bad faith.

**Path B — Active Dispute**
If the receiver raises a dispute within the 3-hour window (e.g. goods are rotten, or the driver's "Delivered" claim was false), the contract **instantly freezes** the funds and enters an **Arbitration State**. The automatic timer is void; only the Admin (4th party) can now move the funds.

### 7.6 Dispute Resolution
The Admin uses a dedicated web portal (not USSD, due to complexity) to review:
- Transaction ID and escrow amount
- All party phone numbers/IDs
- A full, timestamped action log (who clicked what, when — this is what proves, e.g., a driver marked "Delivered" while still 20km from the destination)
- The buyer's selected dispute reason (e.g. "Driver Lying," "Rotten Goods," "Incorrect Quantity")

After physical/offline investigation, the Admin selects one of the predefined resolutions, each mapped directly to a smart contract function:

| Resolution | Outcome |
|---|---|
| **Driver Fraud** | Full refund to buyer; driver forfeits any transport-linked funds as a penalty |
| **Faulty Goods (not driver's fault)** | Buyer refunded for goods; driver's portion (if any) still honored for completed physical work |
| **False Buyer Claim** | Contract overrides the freeze and force-releases funds to the sender |

### 7.7 Revoke Logic

Revoke is the system's single escalation mechanism. It is available to either the 
sender or the receiver at any point after funds are locked and before the deal is 
closed — whether the deal is still awaiting shipment, already shipped, or already 
marked delivered.

Clicking Revoke never moves money by itself. It immediately freezes the deal 
(halting any running timer) and flags it for the 4th-party admin to review and 
resolve. This covers every "something is wrong" scenario with one consistent 
action — stalled shipment, suspected driver/buyer collusion, disputed delivery 
condition or quantity, or any other breakdown — rather than maintaining separate 
named actions per stage.

**Pre-lock (Case A):** Before funds are locked, no Revoke is needed — either party 
may simply cancel directly, since nothing is at stake yet.

**Post-lock (Case B):** Once funds are locked, Revoke is available to either party 
at any stage until the deal closes. The admin investigates offline and resolves 
the deal using the same resolution authority already defined for dispute handling — 
directing funds wherever the facts on the ground warrant.

### 7.8 Container Destruction
Once a deal reaches a terminal state (`Released`, `Cancelled`, or `Resolved`), the backend marks it `CLOSED`. It is instantly removed from all three parties' active USSD menus, though the full record remains permanently on-chain for audit/history purposes.

---

## 8. Handling Multiple Simultaneous Deals and Fluid Roles

Because a single sender may supply multiple buyers, a driver may run multiple deliveries in one trip, and any person may act as sender/driver/receiver across different deals at once, the system does not assign a fixed role to a phone number. Instead:

- Every USSD login runs a query for all active deals where that phone number appears in **any** role slot (`sender`, `driver`, or `receiver`).
- The main menu is generated dynamically:

```
Escrow Main Menu:
1. My Shipments (As Seller)
2. My Deliveries (As Driver)
3. My Purchases (As Buyer)
4. Create New Deal
```

- Selecting a category shows an indexed list of that user's active deals in that specific role (e.g., a driver managing three simultaneous deliveries sees three line items, and completing one instantly removes it from the list without affecting the other two).

---

## 9. Wallets, Custody, and Gas — Fully Abstracted from the User

Because smart contracts require cryptographically signed transactions from wallet addresses, but users only ever interact via phone number + PIN, the system uses a **custodial wallet architecture**:

- On a user's first interaction, the backend silently generates a public/private keypair for their phone number.
- The public address is stored against the phone number and used inside deal containers.
- The private key is encrypted and held by the backend (or an institutional Key Management Service).
- When a user performs an action via USSD (e.g. "I Delivered"), the backend authenticates them via PIN, then signs and relays the transaction on their behalf.

**Gas fees are never charged to users.** The backend operates a **Gas Relay** (account abstraction pattern) that pays network fees from a central operational wallet — a pattern that also mirrors how BNR's permissioned e-Franc network is expected to operate (validator nodes run by institutions, zero or fixed cost to end users). The platform instead monetizes via a small transparent commission taken automatically from settled deals.

---

## 10. Non-Technical / Business Considerations

- **Regulatory posture:** All financial logic operates on a simulated eRWF token specifically to remain compliant with BNR's current restriction on consumer use of unapproved cryptocurrencies/stablecoins, while architecturally preparing for direct integration once BNR's programmable e-Franc CBDC pilot matures.
- **Monetization:** A small flat or percentage commission deducted automatically at successful settlement — mirrors existing MoMo-style transaction fee expectations, so it won't feel unfamiliar to users.
- **Social accountability as a security layer:** Because delivery status is broadcast transparently to all parties, dishonest drivers or buyers risk immediate detection and community reputational damage (e.g. a cooperative "blacklisting" an unreliable driver), reducing reliance on purely technical enforcement.
- **Explicitly out of scope for this prototype stage** (documented as known limitations, not oversights):

  - Wrong phone number entry at deal creation (no correction/edit window yet)
  - Real-money on/off-ramp — converting eRWF balances into actual MoMo cash withdrawals
  - Formal KYC / BNR licensing requirements for holding custodial balances (even simulated) — full production deployment would require regulatory engagement here

---

## 11. System Architecture Overview

```
[ Farmer/Driver/Buyer Phone ]
            │  (USSD dial-in, e.g. *123#)
            ▼
[ USSD Simulation Layer ]  ← custom-built backend simulator (replaces Africa's Talking for now,
            │                 built to the same session/callback contract so a real gateway can be
            │                 swapped in later without rewriting logic)
            ▼
[ Backend Bridge Server (Node.js / Python) ]
   - Custodial wallet management (keygen, encrypted key storage)
   - PIN authentication (hashed, 5-attempt limit, 15-minute lockout)
   - Session & multi-deal indexing (role-aware menu builder)
   - Gas Relay (signs & pays for all on-chain transactions)
   - SMS/notification broadcaster (triangular alerts)
   - Scheduled Keeper Job (polls for expired fund-lock deadlines and expired 3-hour payout timers)
            │
            ▼
[ Smart Contract Layer (eRWF Escrow) ]
   - Deal struct & state machine
   - Role-scoped access control (per dealId, not global)
   - eRWF ERC-20-style simulated token (mint/burn controlled by backend relay)
            │
            ▼
[ Admin Arbitration Portal (Web Dashboard) ]
   - Dispute queue, full timestamped audit trail per deal
   - Resolution actions wired directly to contract functions
```

---

## 12. Data Model (Core Entities)

**Deal Container**
| Field | Description |
|---|---|
| `dealId` | Unique identifier |
| `sender` | Wallet address (mapped from phone number) |
| `driver` | Wallet address (mapped from phone number) |
| `receiver` | Wallet address (mapped from phone number) |
| `amount` | Locked eRWF amount |
| `status` | `Created` → `FundsLocked` → `Shipped` → `Delivered` → `Released` \| `Disputed` → `Closed`/`Cancelled` |
| `createdAt` | Timestamp |
| `fundLockDeadline` | `createdAt` + 24 hours |
| `payoutReadyTime` | Set when marked "Delivered"; `+3 hours` |
| `isDisputed` | Boolean flag |
| `revokeRequestedBy` | Tracks mutual-consent revoke state |

**User (Phone-Wallet Mapping)**
| Field | Description |
|---|---|
| `phoneNumber` | Primary identifier |
| `walletAddress` | Custodial public address |
| `encryptedPrivateKey` | Backend/KMS-held |
| `pinHash` | Hashed PIN |
| `pinAttempts` | For lockout logic |
| `lockoutUntil` | Timestamp, if locked out |

---

## 13. Smart Contract Function Surface

| Function | Caller | Purpose |
|---|---|---|
| `createDeal(driver, receiver, amount)` | Sender | Initializes a new Deal Container |
| `lockFunds(dealId)` | Receiver | Locks buyer's funds into escrow, before `fundLockDeadline` |
| `cancelBeforeLock(dealId)` | Sender or Receiver | Pre-lock cancellation; no funds at stake, no admin involvement needed |
| `autoCancelIfUnlocked(dealId)` | Keeper | Cancels deal if funds not locked in 24hrs |
| `markShipped(dealId)` | Sender | Marks goods dispatched |
| `markDelivered(dealId)` | Driver | Starts 3-hour payout timer; triggers triangular broadcast |
| `revoke(dealId)` | Sender or Receiver | Single escalation mechanism — freezes the deal at any post-lock stage (locked, shipped, or delivered) and flags it for admin review. Never moves money by itself. Covers every "something is wrong" scenario: stalled shipment, suspected driver/buyer collusion, disputed delivery condition or quantity, or any other breakdown |
| `releaseFunds(dealId)` | Keeper | Executes payout once the 3-hour timer expires with no revoke raised |
| `resolveDispute(dealId, amountToSender, amountToReceiver)` | Admin only | Final arbitration action; moves the locked amount between sender and receiver however the admin determines is fair, with the constraint that `amountToSender + amountToReceiver` must equal the deal's locked amount |

All functions are scoped to a specific `dealId` — the contract checks `msg.sender` against the specific role stored for *that* deal, not a global user role, enabling the same address to hold different roles across different deals simultaneously.



---

## 14. Implementation Roadmap

### Phase 0 — Design Lock
- Finalize the full state machine and every transition/authorization rule on paper before writing code.
- Confirm revoke logic (mutual consent + unilateral escape hatch, as defined in Section 7.7).

### Phase 1 — Smart Contract Core
- Set up Hardhat/Foundry local testnet environment.
- Implement the `Deal` struct, enums, and all functions listed in Section 13.
- Implement the simulated eRWF token (mint/burn controlled by the backend relay address).
- Write exhaustive unit tests covering: happy path, buyer-ghosting, early-fake-"Delivered" + dispute, all three admin resolution outcomes, 24-hour auto-cancel, mutual revoke, unilateral revoke, and multi-deal role-switching per address.
- Deploy to a public testnet once local tests pass.

### Phase 2 — Backend Bridge
- Build custodial wallet generation and encrypted key storage.
- Build PIN authentication (5-attempt limit, 15-minute lockout).
- Build the Gas Relay so the backend's master wallet absorbs all network fees.
- Build backend functions mapping 1:1 to each contract function.
- Build the multi-deal indexing query powering role-based menus.
- Build the scheduled Keeper job (cron/worker) to poll for expired fund-lock deadlines and expired payout timers.
- Build the custom SMS/notification simulation layer for triangular broadcasts.
- Validate the full deal lifecycle via direct API calls (e.g. Postman) before touching USSD.

### Phase 3 — USSD Simulation Layer
- Build a custom backend-based USSD simulator (replacing Africa's Talking for now), structured to mimic a real gateway's session/callback contract so a live provider can later be substituted with minimal rework.
- Build the full menu tree: main menu, role-based submenus, deal creation, lock/ship/deliver/dispute/revoke flows, PIN entry with lockout handling.
- Wire every menu action to the Phase 2 backend functions.
- Validate a complete deal lifecycle — including a dispute path — using only the simulated USSD interface.

### Phase 4 — Admin Arbitration Portal
*(can be built in parallel with Phase 3 once the backend API exists)*
- Web dashboard listing all disputed deals.
- Full timestamped audit trail view per dispute.
- Three resolution actions (Driver Fraud / Faulty Goods / False Buyer Claim), each wired to `resolveDispute()`.
- Basic admin authentication.

### Phase 5 — Polish & Demo Readiness
- Logging/monitoring for Keeper job runs and failed transactions.
- Seed/demo script to quickly spin up sample deals for presentation.
- Written documentation of explicitly deferred limitations (Section 10) so they read as scoped decisions, not oversights.
- Recorded demo walkthrough covering both the happy path and a dispute path.

---

## 15. Summary

This project delivers a fraud-resistant, feature-phone-native escrow system for agricultural trade, engineered through extensive adversarial workflow analysis to close off the realistic ways a buyer, driver, or farmer could exploit the system. It is deliberately scoped as a learning-stage prototype — using a simulated eRWF token and a custom USSD simulator — while being architecturally positioned to plug directly into Rwanda's BNR-led CBDC infrastructure and real telecom USSD gateways when the time comes for production deployment.
