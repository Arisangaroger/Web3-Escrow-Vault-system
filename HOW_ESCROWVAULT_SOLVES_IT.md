# How EscrowVault Solves the Problem

**A blockchain-backed escrow platform for agricultural trade, delivered over USSD.**

This document explains *how* EscrowVault solves the trust gap in farmer-to-market trade — with emphasis on the **architecture**, **why blockchain is the right foundation**, and the **design decisions** that make the system credible, safe, and accessible.

---

## 1. The Problem in One Sentence

In rural Rwanda, a farmer won't ship until they're paid, and a buyer won't pay until they receive goods — and neither party trusts the other or has access to a neutral escrow that works on a basic phone.

This is a **trust gap**, and it quietly excludes millions of small-scale farmers from larger, more profitable urban markets. Traditional escrow (banks, lawyers, platforms) is too expensive, too slow, requires smartphones/internet, and simply doesn't reach the village.

EscrowVault closes that gap with three moves:

1. **Neutrality** — funds sit in a smart contract, not in anyone's pocket.
2. **Accessibility** — the entire flow runs on USSD (`*384*96#`), so a $15 feature phone is enough.
3. **Fair dispute handling** — a human arbitrator (the cooperative manager) resolves conflicts, backed by a tamper-proof timeline.

---

## 2. How EscrowVault Solves It — The Core Idea

EscrowVault turns an informal, trust-based handshake into a **verifiable, state-driven workflow**:

```
Farmer creates deal → Buyer locks funds → Farmer ships → Driver confirms delivery
        → 3-hour dispute window → funds auto-release  (or)  dispute → human arbitration
```

At every step:

- **Money is locked in escrow**, not held by a middleman.
- **All three parties are notified simultaneously** (the "triangular broadcast"), so fraud is caught in real time.
- **Every action is timestamped and immutable**, giving the arbitrator hard evidence instead of "he said / she said".
- **Timers protect everyone** — funds can't be locked forever, and delivered goods can't be held hostage.

The result: a farmer ships knowing the money is already secured, and a buyer pays knowing the funds are only released once delivery is real and undisputed.

---

## 3. Architecture

EscrowVault is built as **four cooperating layers**, each with a single, clear responsibility. This separation is deliberate: it keeps the blockchain minimal and trustworthy, while letting the surrounding services handle accessibility, speed, and human judgment.

```
┌──────────────────────────────────────────────────────────────┐
│  INTERFACE LAYER                                               │
│  Feature Phone (USSD *384*96#)  •  Admin Portal (React SPA)    │
│                                  •  USSD Simulator (demo)      │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
┌───────────────┴───────────────────────────┴──────────────────┐
│  APPLICATION LAYER                                             │
│  ┌───────────────────────────┐   ┌────────────────────────┐   │
│  │ NestJS Backend            │   │ USSD Service (Express) │   │
│  │ • Custodial wallets       │   │ • Stateless menu tree  │   │
│  │ • PIN auth (Argon2id)     │   │ • 90-second sessions   │   │
│  │ • Meta-tx relay (EIP-712) │   │ • CON/END protocol     │   │
│  │ • Event listener + keeper │   │                        │   │
│  │ • Notifications           │   │                        │   │
│  └───────────────────────────┘   └────────────────────────┘   │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
┌───────────────┴───────────────────────────┴──────────────────┐
│  DATA & TRUST LAYER                                            │
│  ┌──────────────────────┐   ┌──────────────────────────────┐  │
│  │ PostgreSQL + Prisma  │   │ Polygon Amoy (Blockchain)     │  │
│  │ • Users / wallets    │   │ • Escrow.sol  (deal state)    │  │
│  │ • Deal cache         │   │ • eRWF.sol    (stablecoin)    │  │
│  │ • Action logs        │   │ • AccessControl / roles       │  │
│  │ • Notifications      │   │ • EIP-712 signature checks    │  │
│  └──────────────────────┘   └──────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 3.1 Interface Layer — meet users where they are
- **USSD** is the primary channel. It works offline-of-internet, on any GSM handset, in a familiar menu format (like checking airtime balance). This is the single most important accessibility decision in the product.
- **Admin Portal** is a lightweight React single-page app used only by cooperative managers to review and resolve disputes. It shows a full deal timeline and one-click resolution.

### 3.2 Application Layer — the "brain" that hides complexity
This is where EscrowVault does the heavy lifting so the *user* never has to think about crypto:

- **NestJS backend** — manages custodial wallets, authenticates PINs, signs and relays blockchain transactions, listens for on-chain events, runs automated keeper jobs, and sends notifications.
- **USSD service (Express.js)** — a deliberately thin, stateless menu engine that translates keypad input into backend API calls.

Splitting these into two processes means the USSD front door can be restarted or scaled independently of the heavier backend.

### 3.3 Data & Trust Layer — two sources, two jobs
This is the most important architectural insight in EscrowVault: **it uses the blockchain and a database together, each for what it's best at.**

| Concern | Home | Why |
|--------|------|-----|
| **Money & final state** (who owns locked funds, deal status) | **Blockchain** | Must be neutral, tamper-proof, and independently verifiable. |
| **Fast reads & human context** (phone numbers, timeline, notifications, search) | **PostgreSQL** | Fast, queryable, and holds off-chain data (like phone numbers) that shouldn't live on a public chain. |

The **event listener** keeps the database in sync with the chain (polling every 30s, with a 10-minute reconciliation safety net). The blockchain is the *source of truth for value*; the database is the *source of truth for the user experience*.

---

## 4. Why Blockchain?

Blockchain is not used here as a buzzword — it's used because the core problem is **trust between strangers with no neutral intermediary**. That is precisely the problem blockchains were invented to solve.

### 4.1 The requirement → the blockchain property

| The trade needs… | Blockchain provides… |
|------------------|----------------------|
| A neutral party to hold money that **no one can secretly take** | A smart contract that holds funds and only releases them under agreed rules — no human custodian to bribe or default. |
| **Proof** of what happened and when | Immutable, timestamped events (`FundsLocked`, `MarkedDelivered`, `DisputeResolved`) that no party can alter after the fact. |
| Rules that **execute automatically**, even if a party disappears | Self-executing contract logic + permissionless timelock functions (auto-cancel, auto-release). |
| **Independent verifiability** (a farmer or auditor can check the truth) | A public ledger anyone can inspect — trust is in the code and the record, not in EscrowVault the company. |
| **Forward-compatibility** with a future digital currency | Native fit for Rwanda's planned BNR e-Franc; our `eRWF` token simulates exactly that. |

### 4.2 Why a database alone is *not* enough
A traditional server-plus-database could *mimic* escrow, but it would reintroduce the very trust gap we're solving:

- Whoever runs the database can silently change balances or delete history.
- Parties have to trust *the operator*, not a neutral system.
- There is no independent proof for a dispute — the timeline is only as honest as the company hosting it.

Blockchain removes the operator from the position of "party you must trust with the money." EscrowVault can shut down and the record — and the rules governing the funds — still stand.

### 4.3 Why Polygon specifically
- **Low fees** — agricultural deals are small and frequent; gas costs must be negligible. Polygon makes per-transaction cost effectively invisible to the farmer.
- **Fast finality** — deals progress in seconds, not minutes.
- **EVM-compatible** — mature tooling (Solidity, ethers.js, OpenZeppelin, Hardhat) and a clear path to production.
- **Amoy testnet** — lets us demonstrate real on-chain behavior without real capital during the prototype phase.

### 4.4 The honest boundary: what blockchain does *not* do
A key design insight: **blockchains are great at enforcing rules, terrible at judging reality.** A smart contract cannot know whether the potatoes were fresh, or whether a driver actually delivered. EscrowVault therefore uses blockchain for what it's good at (holding funds, enforcing state, recording proof) and **human arbitration** for what requires judgment. This hybrid is a feature, not a compromise.

---

## 5. Design Decisions

These are the decisions that make EscrowVault work in the real world — grouped by the goal they serve.

### 5.1 Accessibility decisions (reach the actual user)

**USSD over a mobile app.**
~70% of the target population uses feature phones. A smartphone app would exclude the very people the product is for. USSD is the deliberate, defining choice — every other decision bends to keep the USSD experience simple.

**4-digit PINs, MoMo-style.**
Rwandans already trust and understand mobile-money PINs. Reusing that mental model means near-zero learning curve. PINs are protected with **Argon2id** hashing, a server-side **pepper**, and a **5-attempt lockout**.

**Custodial wallets.**
Users never see private keys, seed phrases, or gas. The backend creates and encrypts a wallet per user on first PIN setup and signs on their behalf. This trades pure self-custody for usability — the right call for a market that cannot be expected to manage crypto keys, and consistent with how mobile money already works.

### 5.2 Trust & fairness decisions (make fraud hard, disputes fair)

**Three separate roles: Sender, Driver, Receiver.**
The driver — not the buyer — marks "Delivered." Separating the logistics role from the payment roles removes the easiest collusion path and creates a natural checkpoint.

**Triangular broadcast.**
The instant delivery is marked, *all three parties* are notified at once. If a driver falsely marks delivery, the buyer sees it immediately and can dispute — fraud is surfaced in real time rather than discovered too late.

**Human arbitration via a cooperative manager.**
Disputes are resolved by a trusted local authority who already exists in Rwanda's cooperative structure — not by an algorithm that can't assess produce quality. The arbitrator acts on a **tamper-proof timeline** (e.g. "delivered marked 2 minutes after shipped" is an obvious red flag).

**Universal `revoke()` as a single escalation path.**
Rather than many special-case dispute functions, one `revoke()` freezes a deal for review at any post-lock stage. It never moves money itself — it only pauses and flags — which keeps the contract simple and safe.

**Strict fund conservation in resolution.**
When an admin resolves a dispute, the split amounts **must sum exactly to the deal amount** — the contract cannot create or destroy funds. Outcomes map to real scenarios: *Driver Fraud* and *Faulty Goods* refund the buyer; *False Buyer Claim* pays the farmer.

### 5.3 Safety & liveness decisions (nobody gets stuck)

**Fail-safe timelocks.**
- **24-hour fund-lock deadline** — if the buyer never locks funds, the deal auto-cancels, protecting the farmer's time and liquidity.
- **3-hour dispute window** — after delivery, funds auto-release to the farmer unless the buyer disputes, guaranteeing prompt payment while still leaving room to catch fraud.

**Permissionless keeper functions.**
Anyone can trigger `autoCancelIfUnlocked()` and `releaseFunds()`. The backend runs a keeper job to do this automatically, but because *anyone* can call these, the system has no single point of failure for its safety guarantees.

**Optimistic UX with on-chain reconciliation.**
The interface responds immediately (e.g. a dispute shows "Processing…") while blockchain confirmation happens in the background; a listener and reconciliation job finalize the true state. Users get a fast experience without ever being shown a false result.

### 5.4 Blockchain design decisions (keep the chain minimal and secure)

**Meta-transactions (EIP-712) with a relay wallet.**
Users sign a typed message proving intent; a **relay wallet pays the gas** and submits it. This is what lets a feature-phone user transact on-chain without ever owning crypto for fees. Per-user **nonces** prevent replay attacks.

**`pullFrom` instead of approvals.**
The Escrow contract holds a dedicated role on the `eRWF` token and pulls funds only after verifying the buyer's signature — removing the confusing multi-step "approve then transfer" pattern entirely.

**Freely-usable stablecoin, custodied only while locked.**
`eRWF` is a standard, fully transferable ERC-20 — users own their balance and can hold, receive, or spend it anywhere, just like real money. The **Escrow contract is a separate entity**: when a buyer locks funds for a deal, Escrow (holding a dedicated `ESCROW_ROLE` on the token) uses `pullFrom` to move the exact amount **into the Escrow contract**, where it is held until the deal is released, refunded, or resolved. Crucially, this pull only happens *after* Escrow has verified the owner's signed instruction — so funds can only ever enter escrow with the owner's explicit consent, and everything outside an active deal remains the user's to use freely.

**Battle-tested security primitives.**
`ReentrancyGuard` on all fund-moving functions, OpenZeppelin `AccessControl` for roles, and an explicit enum **state machine** that rejects invalid transitions at the contract level.

**Custom `eRWF` stablecoin.**
A purpose-built ERC-20 simulating a digital Rwandan Franc — no dependence on testnet liquidity, controlled minting for demos, and a clean drop-in path for the real **BNR e-Franc** when it launches.

### 5.5 Data architecture decision (right data, right place)

**Phone number as identity; database for context, chain for value.**
Users are identified by phone number (what they remember), not wallet address. Human-readable, searchable context (timelines, notifications, phone numbers) lives in PostgreSQL — off the public chain — while funds and final deal state live on-chain. This protects privacy, keeps the UI fast, and keeps the blockchain lean.

---

## 6. Why This Combination Wins

EscrowVault's edge is not any single technology — it's the **synthesis**:

- **Blockchain** supplies neutrality, immutability, and automatic enforcement.
- **USSD** supplies universal reach on the phones people actually own.
- **A custodial, meta-transaction backend** hides all crypto complexity behind a familiar PIN.
- **Human arbitration** handles the real-world judgment a contract can't.
- **A hybrid data model** gives blockchain-grade trust with database-grade speed.

Individually, each piece exists. **Together, they make trustworthy, low-cost, feature-phone-native escrow possible for a market that has never had access to it** — while remaining forward-compatible with Rwanda's digital-currency roadmap.

---

## 7. One-Paragraph Pitch (for marketing use)

> EscrowVault brings bank-grade trust to informal agricultural trade using the phones farmers already own. Buyers lock payment into a neutral blockchain escrow; farmers ship with confidence; drivers confirm delivery; and funds release automatically once the deal is verified — all through a simple USSD menu, no smartphone, app, or crypto knowledge required. When something goes wrong, a local cooperative manager resolves the dispute using an unforgeable, timestamped record of every step. It's the security of blockchain, the reach of USSD, and the fairness of human judgment — combined into infrastructure that finally lets rural farmers trade safely with distant urban buyers.

---

*Prepared as an architecture & design-decision brief for analysis and marketing. For deeper technical detail, see `DECISIONS.md` (full decision log), `blockchain/CONTRACTS.md` (contract reference), and `README.md` (system overview).*
