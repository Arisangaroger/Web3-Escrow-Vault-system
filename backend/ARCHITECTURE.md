# Backend Architecture

## System Overview

The backend serves as the bridge between users (via USSD in Phase 3 and Admin Portal in Phase 4) and the blockchain. It manages custodial wallets, PIN authentication, transaction signing, and maintains a queryable cache of blockchain state.

```
┌───────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ USSD Gateway │  │ Admin Portal │  │ Direct API               │  │
│  │ (Phase 3)    │  │ (Phase 4)    │  │ (Testing/Integration)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────────────┐
│                      API LAYER (NestJS)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ ApiController│  │AdminController│ │ Validation  │ │ Error       │ │
│  │ (User Deals)│  │ (Disputes)   │ │ (DTOs)      │ │ Handling    │ │
│  └──────┬──────┘  └──────┬───────┘  └─────────────┘ └─────────────┘ │
└─────────┼─────────────────┼─────────────────────────────────────────────┘
          │                 │
┌─────────┴─────────────────┴───────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ DealsService: Deal lifecycle coordination                    │    │
│  │ - createDeal, lockFunds, markShipped, markDelivered          │    │
│  │ - revoke, getActiveDeals, etc.                               │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ AdminService: Dispute resolution (Phase 4)                   │    │
│  │ - login, getDisputedDeals, getDisputeDetail                  │    │
│  │ - resolveDispute, getResolvedDisputes                        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└────────┬──────────────┬──────────────┬─────────────────────────────────┘
         │              │              │
    ┌────┴───┐    ┌────┴───┐    ┌────┴──────┐
    │ Wallets│    │  Auth  │    │ Contracts │
    │ Service│    │ Service│    │  Service  │
    └────┬───┘    └────┬───┘    └────┬──────┘
         │             │              │
┌────────┴─────────────┴──────────────┴───────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐        │
│  │  Prisma     │  │  Argon2     │  │  Ethers.js              │        │
│  │  (Database) │  │  (PIN Hash) │  │  (Blockchain)           │        │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
         │                                      │
    ┌────┴────┐                          ┌─────┴─────┐
    │PostgreSQL│                          │Polygon RPC│
    └─────────┘                          └───────────┘
```

---

## Core Services

### 1. **WalletsService** (`src/modules/wallets/`)
**Responsibility:** Custodial wallet generation and key management

**Key Functions:**
- `getOrCreateWallet(phoneNumber)` - First-contact wallet generation
- `getWallet(phoneNumber)` - Decrypt for signing
- `getWalletAddress(phoneNumber)` - Read-only access

**Security:**
- Private keys encrypted using `ethers.Wallet.encrypt()` with master key
- Keys decrypted in-memory only, for single operation
- Never logged or returned in API responses

**Storage:**
```sql
users {
  phone_number PK
  wallet_address UNIQUE
  encrypted_private_key TEXT (JSON keystore)
  ...
}
```

---

### 2. **AuthService** (`src/modules/auth/`)
**Responsibility:** PIN authentication with brute-force protection

**Key Functions:**
- `setPin(phoneNumber, pin)` - Hash and store PIN
- `verifyPin(phoneNumber, pin)` - Validate with lockout logic
- `hasPinSet(phoneNumber)` - Check initialization

**Security:**
- Argon2id hashing (memory-hard, parallelism-resistant)
- Server-side pepper (not stored in DB)
- 5-attempt lockout → 15-minute timeout
- Lockout checked before hash comparison (no timing leak)

**Flow:**
```
PIN Verification
├─ Check lockout_until
├─ Compare argon2(pin + pepper) with stored hash
├─ On failure: increment attempts, lock if >= 5
└─ On success: reset attempts
```

---

### 3. **ContractsService** (`src/modules/contracts/`)
**Responsibility:** Blockchain interaction wrapper

**Key Functions:**
- `createDealOnChain(wallet, driver, receiver, amount)`
- `lockFundsOnChain(wallet, dealId)`
- `markShippedOnChain(wallet, dealId)`
- `markDeliveredOnChain(wallet, dealId)`
- `revokeOnChain(wallet, dealId, reasonCode)`
- `releaseFundsOnChain(dealId)` - Permissionless
- `autoCancelOnChain(dealId)` - Permissionless
- `resolveDisputeOnChain(dealId, amountToSender, amountToReceiver)`

**Signature Generation:**
- Uses `SignatureService` for EIP-712 structured signatures
- Matches blockchain test helper: `test/helpers/signatures.js`
- Prevents replay attacks via on-chain nonce tracking

**Error Handling:**
- Decodes Solidity revert strings
- Maps to user-friendly messages
- Retries on nonce conflicts

---

### 4. **SignatureService** (`src/modules/contracts/signature.service.ts`)
**Responsibility:** EIP-712 signature generation

**Implementation:**
```typescript
signAction(wallet, contractAddress, chainId, functionName, dealId, nonce)
├─ Build EIP-712 domain { name: "EscrowContract", version: "1", chainId, verifyingContract }
├─ Build Action typed data { functionName, dealId, nonce }
└─ Sign with wallet.signTypedData(...)  // NOT signMessage (breaks on-chain recover)
```

**Matches Contract:**
```solidity
Action(string functionName,uint256 dealId,uint256 nonce)
```

---

### 5. **GasRelayService** (`src/modules/contracts/gas-relay.service.ts`)
**Responsibility:** Single relay wallet management for meta-transactions

**Key Functions:**
- `getTreasuryWallet()` - Returns relay wallet that submits ALL transactions
- `getTreasuryBalance()` - Monitor treasury health
- `checkTreasuryHealth()` - Warn if low
- `ensureGasFunded(walletAddress)` - Top up custodial wallets ONLY for token approvals

**Pattern:** Meta-Transaction Relay (EIP-712 Signatures)
- **Single relay wallet** submits ALL blockchain transactions
- Users sign actions with custodial wallets (off-chain)
- Smart contracts verify signature to identify real caller
- Relay wallet pays gas for every transaction

**Key Design:**
```typescript
// User signs (no gas needed)
const signature = await userWallet.signTypedData(...);

// Relay wallet submits (pays gas)
const tx = await contract.connect(relayWallet).createDeal(
  userAddress,  // Real actor
  ...params,
  signature     // Proof of authorization
);
```

**Exception:** Token approvals require custodial wallet to have gas (~0.05 ETH top-up)

**Configuration:**
```env
TREASURY_PRIVATE_KEY="0x..."  # Single relay wallet
GAS_THRESHOLD="0.01"          # For approval top-ups only
GAS_TOP_UP_AMOUNT="0.05"      # For approval top-ups only
```


---

### 6. **DealsService** (`src/modules/services/`)
**Responsibility:** Business logic coordination

**Key Functions:**
- Orchestrates Wallets + Auth + Contracts services
- Validates business rules (status transitions, role checks)
- Handles PIN verification before blockchain calls
- Formats responses for API/USSD consumption

**Example Flow (Lock Funds):**
```
lockFunds(receiverPhone, dealId, pin)
├─ Verify PIN (AuthService)
├─ Get deal from DB, validate receiver role
├─ Decrypt receiver wallet (WalletsService)
├─ Submit on-chain transaction (ContractsService)
│   ├─ Approve eRWF token transfer
│   └─ Call escrow.lockFunds()
└─ Return transaction hash
```

---

### 7. **EventListenerService** (`src/modules/services/`)
**Responsibility:** Blockchain → Database sync

**Key Functions:**
- Polls blockchain every 30 seconds for new events
- Updates `deals` table to match on-chain state
- Creates `deal_action_log` entries for audit trail
- Triggers notifications via `NotificationsService`

**Events Handled:**
- `DealCreated`, `FundsLocked`, `MarkedShipped`, `MarkedDelivered`
- `DealRevoked`, `FundsReleased`, `DisputeResolved`
- `DealAutoCancelled`, `DealCancelled`

**Sync Safety:**
```
Tracks last_synced_block in sync_state table
├─ On startup: resume from last checkpoint
├─ Process events in order
└─ Update checkpoint after each batch
```

**Database as Cache:**
- Blockchain = source of truth for financial state
- Database = read-optimized cache for fast queries
- Event listener keeps them in sync

---

### 8. **NotificationsService** (`src/modules/notifications/`)
**Responsibility:** Simulated SMS notifications

**Key Functions:**
- `sendNotification(phone, message, dealId)` - Log to DB + console
- Event-specific functions: `notifyDealCreated`, `notifyDelivered`, etc.

**Triangular Broadcast (Critical):**
```
notifyDelivered(dealId)
├─ Notify sender: "Funds will release in 3 hours"
└─ Notify receiver: "If you did NOT receive goods, DISPUTE NOW!"
```
This simultaneous alert is the fraud prevention mechanism.

**Production Gap (Acknowledged):**
- Phase 2: Writes to `notifications_log` + console
- Phase 3+: Replace with real SMS gateway (Africa's Talking, etc.)
- Known risk: Real SMS can fail/delay, weakening triangular broadcast

---

### 9. **AdminService** (`src/modules/admin/`) - **Phase 4**
**Responsibility:** Dispute resolution and admin authentication

**Key Functions:**
- `login(email, password)` - JWT-based admin authentication
- `verifyToken(token)` - Validate admin session
- `getDisputedDeals()` - List all active disputes
- `getDisputeDetail(dealId)` - Full deal info with timeline
- `resolveDispute(adminId, dealId, outcome)` - Execute resolution on-chain
- `getResolvedDisputes()` - Historical dispute view

**Resolution Outcomes:**
```
DRIVER_FRAUD      → 100% refund to receiver
FAULTY_GOODS      → 100% refund to receiver  
FALSE_BUYER_CLAIM → 100% payment to sender
```

**Security:**
- Admin passwords hashed with Argon2 (same as user PINs)
- JWT tokens with 8-hour expiration
- HTTP-only cookies prevent XSS
- AdminAuthGuard protects all routes
- Admin wallet managed custodially (same pattern as users)

**Audit Trail:**
- Every resolution logged to `deal_action_log`
- Includes admin identifier, outcome, transaction hash
- Immutable blockchain record provides verification

---

### 10. **KeeperService** (`src/modules/keeper/`)
**Responsibility:** Scheduled automation jobs

**Jobs:**

**A. Sweep Expired Fund Locks** (every 5 minutes)
```
Find deals: status=Created AND fundLockDeadline < now
├─ Verify on-chain status
├─ Call autoCancelOnChain(dealId)
└─ Idempotent (checks status before acting)
```

**B. Sweep Expired Payouts** (every 5 minutes)
```
Find deals: status=Delivered AND payoutReadyTime < now
├─ Verify on-chain status
├─ Call releaseFundsOnChain(dealId)
└─ Idempotent
```

**C. Health Check** (every hour)
```
├─ Log treasury balance
└─ Warn if below minimum (0.5 ETH)
```

**Design Notes:**
- Permissionless on-chain (anyone can call)
- Backend is just one caller (reliability)
- Individual failures don't halt entire sweep
- Checks on-chain state before acting (idempotency)

---

## Data Flow Diagrams

### Write Path (User Action → Blockchain)
```
User submits action (e.g., "Mark Delivered")
    │
    ↓
API Controller validates request
    │
    ↓
DealsService.markDelivered()
├─ AuthService.verifyPin() → ✓
├─ WalletsService.getWallet() → decrypts key
├─ ContractsService.markDeliveredOnChain()
│   ├─ SignatureService.signAction()
│   ├─ GasRelayService.ensureGasFunded()
│   └─ Submit transaction to blockchain
└─ Return transaction hash
    │
    ↓
(Transaction mined on blockchain)
    │
    ↓
EventListenerService detects MarkedDelivered event
├─ Update deals table: status=Delivered
├─ Insert deal_action_log entry
└─ NotificationsService.notifyDelivered()
    ├─ Notify sender
    ├─ Notify receiver (fraud alert)
    └─ Log to notifications_log
```

### Read Path (Query Deals)
```
GET /users/+250788123456/deals
    │
    ↓
DealsService.getActiveDealsForPhone()
    │
    ↓
Query deals table (cache)
├─ WHERE senderPhone OR driverPhone OR receiverPhone = phone
├─ AND status NOT IN (Released, Cancelled, Resolved)
└─ Segment by role: {asSeller, asDriver, asBuyer}
    │
    ↓
Return formatted response
```
**No blockchain call needed** - served from synced cache.

---

## Database Schema

```sql
-- User management + custodial wallets
users (
  phone_number PK
  wallet_address UNIQUE
  encrypted_private_key TEXT  -- JSON keystore
  pin_hash TEXT               -- argon2id hash
  pin_attempts INT DEFAULT 0
  lockout_until TIMESTAMP NULL
  created_at TIMESTAMP
)

-- Admin accounts (Phase 4)
admins (
  admin_id PK
  name TEXT
  email TEXT UNIQUE
  password_hash TEXT          -- argon2id hash
  wallet_address TEXT         -- Must have ADMIN_ROLE on contract
  created_at TIMESTAMP
  last_login_at TIMESTAMP NULL
)

-- Deal state cache (synced from blockchain)
deals (
  deal_id PK
  sender_phone FK → users
  driver_phone FK → users
  receiver_phone FK → users
  amount DECIMAL
  status ENUM (Created, FundsLocked, Shipped, Delivered, Disputed, Released, Cancelled, Resolved)
  created_at TIMESTAMP
  fund_lock_deadline TIMESTAMP
  payout_ready_time TIMESTAMP NULL
  dispute_reason_code INT NULL
  tx_hash_created TEXT
  last_synced_block INT
)

-- Audit trail (immutable log)
deal_action_log (
  id PK
  deal_id FK → deals
  actor_phone FK → users  -- OR admin email for admin actions
  action TEXT (e.g., "MarkedShipped", "AdminResolution_DRIVER_FRAUD")
  timestamp TIMESTAMP
  tx_hash TEXT
)

-- Simulated SMS log (will be real gateway in production)
notifications_log (
  id PK
  deal_id FK → deals
  recipient_phone FK → users
  message TEXT
  sent_at TIMESTAMP
  delivery_status ENUM (Simulated_Sent, Pending, Failed)
)

-- Event sync checkpoint
sync_state (
  id PK
  last_synced_block INT
  updated_at TIMESTAMP
)
```

---

## Security Layers

### 1. **Private Key Protection**
- ✅ Encrypted at rest (ethers.js encrypted keystore)
- ✅ Master key in environment (not in code)
- ✅ Decrypted in-memory only (single operation)
- ✅ Never logged or API-returned
- ⚠️ **Gap:** Master key loss = all wallets lost (acknowledged for Phase 2)

### 2. **PIN Security**
- ✅ Argon2id hashing (memory-hard)
- ✅ Server-side pepper (defense in depth)
- ✅ 5-attempt lockout → 15-minute timeout
- ✅ Lockout checked before hash comparison
- ⚠️ **Gap:** No self-service reset (manual admin for Phase 2)

### 3. **Transaction Security**
- ✅ EIP-712 structured signatures
- ✅ On-chain nonce prevents replay attacks
- ✅ Role checks in smart contract
- ✅ ReentrancyGuard on fund transfers

### 4. **Operational Security**
- ✅ Input validation (class-validator DTOs)
- ✅ Nonce management (no collisions)
- ✅ Idempotent keeper jobs
- ⚠️ **Gap:** No rate limiting yet (Phase 3)

---

## Failure Modes & Resilience

### Database Failure
- **Impact:** API down, no new actions
- **Mitigation:** Blockchain still authoritative, can rebuild from events
- **Recovery:** Event listener replays from block 0

### RPC Endpoint Failure
- **Impact:** Cannot submit transactions or read blockchain
- **Mitigation:** Configure backup RPC URLs
- **Recovery:** Automatic retry on next keeper run

### Event Listener Lag
- **Impact:** Database cache stale
- **Mitigation:** Tracked in `last_synced_block`, auto-resumes
- **Recovery:** Polls until caught up

### Keeper Job Failure
- **Impact:** Missed auto-cancel or auto-release
- **Mitigation:** Idempotent (safe to retry), permissionless (users can trigger)
- **Recovery:** Next run picks up same deals

### Treasury Wallet Empty
- **Impact:** Cannot fund custodial wallets
- **Mitigation:** Hourly health check logs warning
- **Recovery:** Manual refill by operator

---

## Performance Characteristics

### Bottlenecks
1. **Blockchain RPC calls** - Rate limited by provider
2. **Transaction confirmations** - 2-5 seconds per block
3. **Event polling** - 30-second delay max

### Optimizations
1. **Database queries** - All user queries served from cache
2. **Parallel processing** - Event listener processes events concurrently
3. **Nonce caching** - Reduces RPC calls

### Scalability
- **Current:** Single-instance (Phase 2 prototype)
- **Phase 3+:** Can horizontalize API layer, single keeper instance

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Production Setup                    │
├─────────────────────────────────────────────────────┤
│  Load Balancer                                      │
│       │                                              │
│   ┌───┴────┬─────────┬─────────┐                   │
│   │ API 1  │  API 2  │  API 3  │ (Stateless)       │
│   └────────┴─────────┴─────────┘                   │
│                                                      │
│   ┌────────────────────────────┐                   │
│   │  Keeper Service (Singleton)│                   │
│   └────────────────────────────┘                   │
│                                                      │
│   ┌────────────────────────────┐                   │
│   │  Event Listener (Singleton)│                   │
│   └────────────────────────────┘                   │
│                                                      │
│   ┌────────────────────────────┐                   │
│   │  PostgreSQL (Primary + Replica)               │
│   └────────────────────────────┘                   │
│                                                      │
│   External Dependencies:                            │
│   - Polygon RPC (+ backup)                         │
│   - SMS Gateway (Phase 3+)                         │
└─────────────────────────────────────────────────────┘
```

**Stateless API:** Can scale horizontally  
**Stateful Services:** Keeper + EventListener (singleton, failover on crash)

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | NestJS | Modular architecture, DI, decorators |
| Language | TypeScript | Type safety, maintainability |
| Database | PostgreSQL + Prisma | Relational integrity, migrations |
| Blockchain | ethers.js v6 | Contract interaction, signing |
| Hashing | argon2 | PIN security (memory-hard) |
| Scheduling | @nestjs/schedule | Keeper cron jobs |
| Validation | class-validator | DTO validation |
| Encryption | ethers.Wallet.encrypt | Keystore encryption |

---

## Phase 2 → Phase 3 Evolution

### Phase 2 (Current)
- REST API for testing
- Simulated SMS (console logs)
- Single backend instance
- No rate limiting
- No admin authentication

### Phase 3 (USSD Integration)
- Add USSD gateway adapter
- Replace simulated SMS with real gateway
- Add rate limiting per phone number
- Add admin authentication for dispute resolution
- Add structured logging and metrics
- Consider Redis for session state (USSD multi-step flows)

### Phase 4 (Admin Portal)
- Add web dashboard for dispute management
- Visualize `deal_action_log` and `notifications_log`
- Treasury balance monitoring UI
- User support tools

---

## Development Workflow

### Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Setup database
npx prisma migrate dev
npx prisma generate

# 3. Copy ABIs from blockchain
cp ../blockchain/artifacts/contracts/Escrow.sol/Escrow.json src/modules/contracts/abis/
cp ../blockchain/artifacts/contracts/eRWF.sol/eRWF.json src/modules/contracts/abis/

# 4. Configure environment
cp .env.example .env
# Edit .env with RPC URL, contract addresses, treasury key

# 5. Run backend
npm run start:dev
```

### Testing Strategy
- **Unit Tests:** Individual services (wallets, auth, contracts)
- **Integration Tests:** Full lifecycle via API calls
- **E2E Tests:** Against local Hardhat node

---

## Monitoring & Observability

### Logs to Watch
- `✅ Deal X created` - Business events
- `⛽ Funding wallet...` - Gas management
- `🧹 Sweeping expired...` - Keeper jobs
- `❌ Failed to...` - Errors (investigate immediately)
- `⚠️  Treasury balance low` - Operational alert

### Metrics to Track (Phase 3+)
- Deals created per hour
- Average deal lifecycle time
- Dispute rate
- Keeper job success rate
- Treasury balance trend
- PIN lockout frequency

---

## Known Limitations (Acknowledged for Phase 2)

1. **No wallet recovery** - Lost master key = all wallets lost
2. **No PIN reset** - Lost PIN requires manual admin intervention
3. **Simulated SMS** - Real delivery failures not handled
4. **Single instance** - Keeper/EventListener not distributed
5. **No rate limiting** - Vulnerable to spam (Phase 3)
6. **No admin auth** - Dispute resolution endpoint unprotected (Phase 3)
7. **Master key in env** - Should use KMS in production

These are documented tradeoffs for a learning-stage prototype and will be addressed in production hardening.
