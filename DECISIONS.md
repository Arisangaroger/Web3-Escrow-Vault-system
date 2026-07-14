# Technical Decisions Log

This document consolidates all major technical decisions across Phases 1-5, chronologically ordered with rationale.

---

## Phase 1: Smart Contracts (Blockchain Layer)

### 1.1 Solidity 0.8.20 + Polygon (Amoy Testnet)
**Decision:** Use Solidity 0.8.20 and deploy to Polygon Amoy testnet  
**Rationale:**  
- Polygon offers low transaction costs suitable for frequent state changes
- Testnet allows realistic testing without real capital
- 0.8.x includes built-in overflow protection
- Forward-compatible with BNR e-Franc plans

### 1.2 State Machine Design (Single Deal Lifecycle)
**Decision:** Enum-based state machine with explicit transitions  
**States:** `Created → FundsLocked → Shipped → Delivered → Released/Disputed/Resolved/Cancelled`  
**Rationale:**  
- Clear, auditable state progression
- Prevents invalid transitions at contract level
- Matches real-world escrow flow
- Events emitted at each transition for off-chain sync

### 1.3 Meta-Transaction Pattern (EIP-712)
**Decision:** Users sign typed data, relay wallet pays gas  
**Rationale:**  
- Feature phone users can't hold gas tokens
- Custodial model is acceptable for target market (rural farmers)
- EIP-712 provides replay protection via nonces
- Separates identity (user signature) from gas payment (relay wallet)

**Implementation:**  
- Domain: `EscrowContract` with `chainId`, contract address
- Per-action message types: `Action{user, dealId, action, nonce}`
- Nonce tracked per user address (`getNonce(user)`)
- Relay wallet verifies signature before submitting transaction

### 1.4 Three-Role Model (Sender, Driver, Receiver)
**Decision:** Explicitly separate driver from sender/receiver  
**Rationale:**  
- Reflects real-world agricultural logistics
- Driver marks "Delivered" (not buyer) → prevents collusion
- Triangular broadcast catches early false delivery
- Multi-role support: same user can be sender in Deal A, driver in Deal B

### 1.5 Dispute Mechanism (Revoke + Admin Resolution)
**Decision:** User-initiated dispute (revoke) + human arbitration (resolveDispute)  
**Rationale:**  
- Smart contracts can't adjudicate "was produce fresh?" questions
- Cooperative managers already exist as trust nodes in rural Rwanda
- Reason codes (1=faulty goods, 2=driver fraud, 3=false claim) enable analytics later
- Admin role uses AccessControl, not hardcoded address

### 1.6 Time-Based Automation (Timelock + Auto-Cancel/Release)
**Decision:**  
- 24-hour fund-lock deadline (auto-cancel if not locked)
- 3-hour dispute window after delivery (auto-release if no dispute)

**Rationale:**  
- Prevents indefinite deal holds (farmer liquidity)
- Balances fraud detection time vs payment speed
- Off-chain keeper jobs trigger on-chain methods (not Chainlink Automation for prototype)

### 1.7 ERC20 Stablecoin (eRWF)
**Decision:** Implement custom ERC20 token for prototype  
**Rationale:**  
- Simulates BNR's planned e-Franc (digital RWF)
- Avoids external dependencies on testnet liquidity
- Allows controlled minting for demo scenarios
- Production would integrate with real BNR e-Franc API

### 1.8 Non-Upgradeable Contracts
**Decision:** No proxy pattern, deploy new contracts for changes  
**Rationale:**  
- Prototype scope, not production
- Upgradeability adds complexity and attack surface
- Production would use UUPS or Transparent Proxy pattern

---

## Phase 2: Backend (Application Layer)

### 2.1 NestJS Framework
**Decision:** Use NestJS instead of Express  
**Rationale:**  
- Modular dependency injection matches Phase 2 service boundaries
- TypeScript-first with strong typing
- Built-in decorators for validation, guards, interceptors
- Scales better than raw Express for multi-module systems

### 2.2 Custodial Wallet Management
**Decision:** Backend holds encrypted private keys for all users  
**Rationale:**  
- Feature phone users can't manage crypto wallets
- Matches mobile money (MoMo) mental model
- Central trust in backend vs user sovereignty trade-off acceptable for target market

**Implementation:**  
- Wallets created on first PIN setup
- Keys encrypted with ethers.js wallet encryption (password derived from master key)
- Master key in environment variable (production would use HSM/KMS)
- Keys only decrypted in-memory during transaction signing

### 2.3 PIN Authentication (Argon2id)
**Decision:** 4-digit PINs + Argon2id hashing + pepper + lockout  
**Rationale:**  
- 4 digits familiar from MoMo (low learning curve)
- Argon2id winner of Password Hashing Competition (memory-hard, GPU-resistant)
- Pepper adds server secret to prevent rainbow table attacks
- 5-attempt lockout prevents brute force (requires admin unlock)

**Parameters:**  
- Memory: 64MB, Time: 3, Parallelism: 4
- Pepper stored in environment variable (not in database)

### 2.4 Event Listener (Blockchain → Database Sync)
**Decision:** Polling-based event listener (30-second interval)  
**Rationale:**  
- Polygon RPC doesn't always support WebSocket reliably
- Polling is simpler to implement and debug
- 30-second latency acceptable for prototype
- Reconciliation job catches missed events

**Implementation:**  
- Tracks last synced block in database
- Queries contract events from `lastSyncedBlock + 1` to current
- Updates database deal status, action logs, notifications
- Reconciliation job runs every 10 minutes to fix drift

### 2.5 Keeper Jobs (Automated Actions)
**Decision:** Cron-based scheduled jobs for timelock enforcement  
**Rationale:**  
- Simpler than Chainlink Automation for prototype
- Keeper jobs check eligible deals and submit transactions
- 5-minute intervals balance timeliness vs RPC load

**Jobs:**  
- Auto-cancel sweep: finds `Created` deals past 24hr deadline
- Auto-release sweep: finds `Delivered` deals past 3hr dispute window

### 2.6 Notification System (Simulated SMS)
**Decision:** Database-stored notifications instead of real SMS gateway  
**Rationale:**  
- Real SMS requires licensed gateway and costs money
- Database notifications demonstrate the notification logic
- Frontend can poll and display as "inbox"
- Production would integrate with Africa's Talking or similar

### 2.7 Treasury Wallet (Relay + Admin)
**Decision:** Single wallet for meta-transaction relay AND admin resolution  
**Rationale:**  
- Simplifies gas management (one wallet to fund)
- Admin role granted to this wallet during contract deployment
- Acceptable for prototype scale
- Production might separate relay and admin wallets for security

---

## Phase 3: USSD Service (User Interface)

### 3.1 Express.js (Not NestJS)
**Decision:** Lightweight Express.js server for USSD  
**Rationale:**  
- USSD is stateless protocol, doesn't need NestJS's DI overhead
- Express is faster to prototype
- Separate process allows independent scaling/restarting
- Plain JavaScript (not TypeScript) for simplicity

### 3.2 In-Memory Session Store
**Decision:** Memory-based sessions with 90-second timeout  
**Rationale:**  
- USSD sessions are short-lived by protocol design
- Memory is sufficient for prototype scale
- Production would use Redis for horizontal scaling
- 90 seconds matches telecom industry standards

**Limitation:** Single-instance architecture, no shared sessions across servers

### 3.3 15-Node Menu Tree
**Decision:** Modular menu node registry vs monolithic switch statement  
**Rationale:**  
- Easier to test individual nodes
- Clear separation of concerns (render vs handleInput)
- Menu tree documented separately in MENU_TREE.md
- Extensible for future menu additions

### 3.4 Phone Number Normalization
**Decision:**  
- User-facing: `0788123456` (local format, familiar)
- Storage/API: `+250788123456` (E.164 international)

**Rationale:**  
- Users type local format on feature phones
- E.164 ensures uniqueness and international compatibility
- Normalization layer in utils prevents mismatch bugs

### 3.5 CON/END Protocol Compliance
**Decision:** Strict adherence to USSD gateway protocol  
**Rationale:**  
- `CON` = continue (more menu screens)
- `END` = terminate (close session)
- Protocol enforced by telecom gateways (Africa's Talking, etc.)
- Simulator replicates real behavior for testing

---

## Phase 4: Admin Portal (Dispute Resolution)

### 4.1 React SPA (Not Server-Side Rendered)
**Decision:** Client-side React app (Vite) instead of Next.js  
**Rationale:**  
- Admin portal is internal tool, not public SEO-sensitive site
- Vite faster dev experience than Next.js
- SPA sufficient for dashboard use case
- No server-side data fetching needed

### 4.2 JWT Authentication (HTTP-Only Cookies)
**Decision:** JWT tokens in HTTP-only cookies, not localStorage  
**Rationale:**  
- HTTP-only cookies prevent XSS token theft
- Same-site attribute prevents CSRF
- Refresh token mechanism deferred (short-lived sessions acceptable for prototype)

### 4.3 Direct Database Query (No Smart Contract Read)
**Decision:** Admin portal reads from database, not blockchain  
**Rationale:**  
- Faster than RPC calls for every dispute load
- Timeline shows action logs with timestamps and phone numbers (not on-chain)
- Database is source of truth for UI state (synced via event listener)

### 4.4 Three Resolution Outcomes
**Decision:**  
- `DRIVER_FRAUD` → Refund receiver (driver lied about delivery)
- `FAULTY_GOODS` → Partial refund (produce quality issue)
- `FALSE_BUYER_CLAIM` → Release to sender (buyer lied about dispute)

**Rationale:**  
- Covers most common agricultural trade disputes
- Flexible split allocation (0-100% to sender/receiver)
- Audit trail persists on-chain via DisputeResolved event

### 4.5 Admin Meta-Transaction Clarification
**Decision:** Admin uses direct role-based access, NOT meta-transaction relay  
**Rationale:**  
- `resolveDispute` checks `onlyRole(ADMIN_ROLE)` on `msg.sender`
- Admin wallet (treasury/relay) submits transaction directly
- No EIP-712 signature needed (admin already trusted)
- Simpler than separate admin key + meta-tx pattern

### 4.6 Rate Limiting
**Decision:** 5 login attempts per 15 minutes, 20 requests/minute globally  
**Rationale:**  
- Prevents brute-force attacks on admin login
- Global rate limit prevents DoS on dispute queue
- Uses `@nestjs/throttler` for simplicity

---

## Phase 5: Polish & Demo Readiness

### 5.1 Structured Logging (Pino)
**Decision:** Replace `console.log` with Pino structured logging  
**Rationale:**  
- JSON logs enable log aggregation (ELK, CloudWatch, etc.)
- Consistent log shape (timestamp, context, severity, IDs)
- `pino-pretty` for human-readable dev logs
- Production would disable pretty-printing for performance

**Implementation:**  
- LoggerService wrapper with specialized methods
- `logTransaction(event, txHash, data)` for blockchain operations
- `logDeal(event, dealId, data)` for deal lifecycle
- `logKeeper(summary, stats)` for keeper job summaries

### 5.2 Seed & Reset Scripts
**Decision:** TypeScript scripts with hardcoded demo users and deals  
**Rationale:**  
- Instant demo-ready state (no manual USSD setup)
- Known PINs documented in DEMO_CREDENTIALS.md
- Covers all deal states (Created, FundsLocked, Shipped, Delivered, Disputed)
- Reset script cleans up for fresh demos

### 5.3 Internal Status Endpoint
**Decision:** `/internal/status` endpoint for health monitoring  
**Rationale:**  
- Quick sanity check during demos (treasury balance, deal counts)
- No authentication (internal use only, not production-ready)
- Returns JSON with counts by status, dispute count, last keeper run

### 5.4 Limitations Document (Not Apology)
**Decision:** `LIMITATIONS.md` as confident scoping document  
**Rationale:**  
- Every deferred feature explicitly listed with production path
- Separates design decisions (intentional) from limitations (deferred)
- Shows thoughtful consideration, not oversight
- Portfolio artifact demonstrating realistic scoping

---

## Cross-Cutting Decisions

### Database Schema (Prisma)
**Decision:**  
- `users` table: phone as PK (not wallet address)
- `deals` table: dealId from contract as PK
- `dealActionLog`: immutable audit trail
- `admins` table: separate from users (different auth flow)

**Rationale:**  
- Phone numbers are user identity (users remember phones, not wallet addresses)
- DealId mirrors on-chain state (1:1 mapping)
- Action logs provide timeline for admin arbitration
- Admin separation prevents privilege escalation

### Error Handling
**Decision:** Try-catch at service boundaries, throw descriptive errors  
**Rationale:**  
- NestJS exception filters handle HTTP status codes
- Contract errors formatted with reason extraction
- PIN lockout errors thrown explicitly (not generic 401)

### Testing Strategy
**Decision:**  
- Backend: Jest unit tests + E2E tests
- Frontend: Vitest component tests
- Smart contracts: Hardhat tests
- Manual integration testing via seed scripts

**Rationale:**  
- Unit tests for business logic (PIN validation, keeper eligibility)
- E2E tests for API flows (login, create deal, resolve dispute)
- Component tests for UI interactions
- No automated USSD tests (protocol complexity deferred)

### Environment Configuration
**Decision:** `.env` files for all secrets, `.env.example` templates  
**Rationale:**  
- Never commit secrets to version control
- Example files document required variables
- Separate `.env` per service (backend, USSD, blockchain)

---

## Decisions NOT Made (Explicitly Deferred)

These are documented in LIMITATIONS.md but worth noting here:

1. **Real MoMo integration** - Deferred, requires BNR e-Franc API or licensed aggregator
2. **KYC/AML compliance** - Deferred, requires regulatory engagement
3. **Real SMS gateway** - Deferred, requires licensed gateway contract
4. **Wallet recovery** - Deferred, requires secure identity recovery flow
5. **Multi-cooperative scaling** - Simplified to single admin role
6. **Smart contract upgradeability** - Deferred, non-upgradeable for prototype
7. **Production security audit** - Required before real-money deployment
8. **Database replication** - Single instance sufficient for prototype
9. **Horizontal scaling** - In-memory sessions don't scale across instances
10. **Advanced analytics** - Basic status counts only, no dashboard

---

## Key Design Principles

1. **Prototype First, Production Path Clear** - Every limitation has a documented production solution
2. **Security by Design** - Argon2, PIN lockout, HTTP-only cookies, rate limiting
3. **Accessibility Over Sophistication** - USSD over mobile app, 4-digit PINs over complex passwords
4. **Human Arbitration Over Algorithmic** - Cooperative managers resolve disputes, not smart contracts
5. **Forward-Compatible** - Designed for BNR e-Franc integration when available
6. **Fail-Safe Timelocks** - Auto-cancel/release prevents indefinite locks
7. **Triangular Fraud Prevention** - Driver marks delivery, all parties notified simultaneously
8. **Audit Trail Everywhere** - Blockchain events + database logs + action logs

---

**Last Updated:** Phase 5 Implementation  
**Status:** Complete prototype, documented trade-offs, production roadmap defined

