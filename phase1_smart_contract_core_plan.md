# Phase 1 — Smart Contract Core
## Full Detailed Implementation Plan

**Scope:** This phase produces a fully tested, standalone smart contract system for the escrow logic — the `Deal` state machine, the simulated `eRWF` token, and every access-control and timing rule the project depends on. Nothing in this phase touches USSD, telecom, or the backend bridge. Everything is validated through local test scripts, Hardhat/Foundry test suites, and testnet deployment.

---

## 1. Environment & Project Setup

### 1.1 Toolchain decision
- Choose **Hardhat** (recommended for this project — larger ecosystem, JS/TS-native, easier to pair with your Node.js backend later) or **Foundry** (faster tests, Solidity-native tests). Given the rest of your stack is Node.js/Python, Hardhat is the more natural fit.
- Install Node.js LTS, initialize a Hardhat project (`npx hardhat init`).
- Set up folder structure:
  ```
  /contracts
  /test
  /scripts
  /deploy
  hardhat.config.js
  ```

### 1.2 Dependency installation
- `@openzeppelin/contracts` — for ERC-20 base (eRWF token), `AccessControl`/`Ownable` patterns, and `ReentrancyGuard`.
- `hardhat-toolbox` — bundles ethers.js, waffle/chai matchers, gas reporter, coverage.
- `dotenv` — for managing testnet RPC URLs and deployer keys safely.

### 1.3 Network configuration
- Configure `hardhat.config.js` with:
  - Local network (Hardhat Network) for fast iterative testing.
  - A public testnet (Avalanche Fuji or Ethereum Sepolia — pick one; Fuji is cheaper/faster for iteration).
- Set up a `.env.example` documenting required variables (RPC URL, private key, etc.) without committing secrets.

### 1.4 Version control & workflow hygiene
- Initialize git repo, `.gitignore` for `node_modules`, `.env`, `artifacts`, `cache`.
- Adopt a simple commit convention (e.g. `feat(contract): add markDelivered function`) so contract history is easy to audit later — useful since this is a financial system.

**Exit criteria for Section 1:** `npx hardhat test` runs (even with zero tests) with no configuration errors, and you can deploy a placeholder contract to both local and testnet networks.

---

## 2. The eRWF Token Contract

### 2.1 Token design decisions
- Implement as an ERC-20 token (`eRWF.sol`) using OpenZeppelin's `ERC20` base for safety and standard compliance.
- Decide decimals — likely `2` (to mirror RWF's real-world lack of subdivision in practice) or standard `18` for simplicity with existing tooling. Recommendation: use `18` decimals to avoid custom math edge cases, and just format display values in the backend/UI layer.
- Mint/burn control: only the backend's **Relay/Operator address** (or the Escrow contract itself) may mint or burn — this simulates the future CBDC's controlled-issuance model.

### 2.2 Functions to implement
- `mint(address to, uint256 amount)` — restricted to `onlyOperator` (your backend relay wallet). Used to simulate a buyer "loading" eRWF, or an admin issuing test funds during development.
- `burn(address from, uint256 amount)` — restricted similarly, for simulating cash-out/off-ramp in later phases (not used yet, but scaffolded).
- Standard ERC-20 `transfer`, `approve`, `transferFrom` inherited from OpenZeppelin — but consider whether end users should ever call these directly, or whether **only the Escrow contract** should move funds (recommended: restrict direct transfers, route everything through Escrow, to prevent users from moving locked funds outside the deal lifecycle).

### 2.3 Access control pattern
- Use OpenZeppelin's `AccessControl` (role-based) rather than simple `Ownable`, since you'll likely want distinct roles later:
  - `OPERATOR_ROLE` — backend relay wallet(s), allowed to mint/burn.
  - `ESCROW_ROLE` — granted specifically to the deployed Escrow contract address, allowing it to move tokens between parties without needing individual `approve` calls from users (since users don't manage their own transactions).

### 2.4 Tests for eRWF token
- Mint respects role restriction (non-operator mint attempt reverts).
- Burn respects role restriction.
- Only the Escrow contract (once granted `ESCROW_ROLE`) can move funds on behalf of users.
- Standard ERC-20 behavior (transfer, balance updates, event emission) works as expected.

**Exit criteria for Section 2:** eRWF token deployed locally, mintable only by the operator, transferable only via the Escrow contract, with full test coverage of restricted functions.

---

## 3. The Deal State Machine — Core Data Structures

### 3.1 Enum: Deal Status
Define every state discussed in your workflow analysis:
```solidity
enum Status {
    Created,        // deal container created, awaiting fund lock
    FundsLocked,     // buyer has locked funds
    Shipped,         // sender marked shipped
    Delivered,       // driver marked delivered, 3hr timer running
    Disputed,        // receiver disputed within window, frozen for admin
    Released,        // funds paid out to sender
    Cancelled,       // auto-cancelled (unlocked funds expired) or revoked pre-lock
    RevokeRequested, // mutual revoke initiated, awaiting second confirmation
    Refunded         // funds returned to buyer via revoke or dispute resolution
}
```
*(Exact naming can be refined, but every state your Section 7 workflow described needs a first-class representation — don't collapse states together, since your keeper job and access-control checks depend on precise status checks.)*

### 3.2 Struct: Deal
```solidity
struct Deal {
    address sender;
    address driver;
    address receiver;
    uint256 amount;
    Status status;
    uint256 createdAt;
    uint256 fundLockDeadline;   // createdAt + 24 hours
    uint256 shipDeadline;       // agreed deadline for unilateral revoke eligibility
    uint256 payoutReadyTime;    // set at markDelivered; +3 hours
    bool isDisputed;
    address revokeRequestedBy;  // address that first requested mutual revoke (address(0) if none)
    uint8 disputeReasonCode;    // maps to reasons like "Rotten Goods", "Driver Lying", etc.
}
```

### 3.3 Storage design
- `mapping(uint256 => Deal) public deals;`
- `uint256 public nextDealId;` — simple incrementing counter (private/internal with a public getter, or public directly).
- Consider a secondary index for the backend's convenience — e.g. `mapping(address => uint256[]) public dealsByParticipant` — **or** decide this indexing is purely an off-chain backend/database responsibility (recommended: keep this off-chain in Phase 2's database, since on-chain array indexing by participant gets gas-expensive as it grows; the contract just needs to emit good events, and the backend indexes them).

### 3.4 Events
Emit an event for every state transition — these are what your backend listens to for the triangular broadcast and what your admin portal reads for the audit trail:
- `DealCreated(dealId, sender, driver, receiver, amount, createdAt)`
- `FundsLocked(dealId, receiver, amount, timestamp)`
- `DealAutoCancelled(dealId, timestamp)`
- `MarkedShipped(dealId, sender, timestamp)`
- `MarkedDelivered(dealId, driver, timestamp, payoutReadyTime)`
- `DisputeRaised(dealId, receiver, reasonCode, timestamp)`
- `FundsReleased(dealId, sender, amount, timestamp)`
- `DisputeResolved(dealId, admin, outcome, timestamp)`
- `RevokeRequested(dealId, requestedBy, timestamp)`
- `RevokeConfirmed(dealId, timestamp)`
- `UnilateralRevoke(dealId, receiver, timestamp)`

**Exit criteria for Section 3:** contract compiles with the full struct/enum/event set defined and documented with NatSpec comments explaining each field's purpose (important for future-you and any collaborator reading this months later).

---

## 4. Core Function Implementation — Grouped by Feature

### 4.1 Feature: Deal Creation
**Function:** `createDeal(address driver, address receiver, uint256 amount)`
- Caller becomes `sender`.
- Validate: `driver != address(0)`, `receiver != address(0)`, `amount > 0`.
- Consider: should `driver == sender` or `receiver == sender` be explicitly disallowed? (Recommendation: yes — disallow identical addresses across roles to prevent degenerate/self-dealing states.)
- Set `createdAt = block.timestamp`, `fundLockDeadline = createdAt + 24 hours`.
- Store the new `Deal`, increment `nextDealId`.
- Emit `DealCreated`.

**Sub-decisions to lock down:**
- Who is allowed to call this — literally anyone, or must sender already be "known" to the system? (Recommendation for Phase 1: no restriction at contract level; identity/registration checks belong in the backend layer in Phase 2, since the contract doesn't know about phone numbers at all — only wallet addresses.)

### 4.2 Feature: Fund Locking (with 24-hour expiry)
**Function:** `lockFunds(uint256 dealId)`
- Require `msg.sender == deals[dealId].receiver`.
- Require `deals[dealId].status == Status.Created`.
- Require `block.timestamp <= deals[dealId].fundLockDeadline`.
- Pull `amount` in eRWF from receiver into the contract (via the `ESCROW_ROLE` transfer pattern established in Section 2.3).
- Update `status = Status.FundsLocked`.
- Emit `FundsLocked`.

**Function:** `autoCancelIfUnlocked(uint256 dealId)` — **keeper-callable**
- Require `deals[dealId].status == Status.Created`.
- Require `block.timestamp > deals[dealId].fundLockDeadline`.
- Set `status = Status.Cancelled`.
- No funds to return (none were ever locked) — this function only changes state and emits `DealAutoCancelled`.
- **Design question to resolve:** should this be `onlyRole(KEEPER_ROLE)` restricted, or callable by anyone? (Recommendation: allow *anyone* to call it — it's a pure state-cleanup function with a hard-coded time check, so there's no harm in permissionless calling; this also means your keeper job isn't a single point of failure — any of the three parties' own USSD "refresh" action could opportunistically trigger it too.)

**Function:** `cancelBeforeLock(uint256 dealId)`
- Require `msg.sender == deals[dealId].sender || msg.sender == deals[dealId].receiver`.
- Require `status == Status.Created`.
- Set `status = Status.Cancelled`.
- No funds to return (none were ever locked) — no admin involvement needed, since nothing is at stake yet.
- Emit `DealCancelled`.

### 4.3 Feature: Shipment Marking
**Function:** `markShipped(uint256 dealId)`
- Require `msg.sender == deals[dealId].sender`.
- Require `status == Status.FundsLocked`.
- Update `status = Status.Shipped`.
- Emit `MarkedShipped`.

### 4.4 Feature: Delivery Confirmation & Timer Start
**Function:** `markDelivered(uint256 dealId)`
- Require `msg.sender == deals[dealId].driver`.
- Require `status == Status.Shipped`.
- Set `payoutReadyTime = block.timestamp + 3 hours`.
- Update `status = Status.Delivered`.
- Emit `MarkedDelivered` (this event is what the backend listens to for triggering the triangular SMS broadcast in Phase 2 — the contract itself has no concept of SMS, it just needs to emit a clean, complete event).

### 4.5 Feature: Revoke (Single Escalation Mechanism)
**Function:** `revoke(uint256 dealId)`
- Require `msg.sender == deals[dealId].sender || msg.sender == deals[dealId].receiver`.
- Require `status == Status.FundsLocked || status == Status.Shipped || status == Status.Delivered` (available at any post-lock stage, up until the deal closes).
- If `status == Status.Delivered`, this also implicitly halts the automatic payout — `releaseFunds` must never succeed once a deal is in `Disputed` status (see 4.6).
- Set `status = Status.Disputed`.
- Emit `DealRevoked(dealId, msg.sender, timestamp)`.
- **This function never moves funds.** It only freezes the deal and flags it for admin review — this is deliberate: Revoke is the single "something is wrong" action for both parties, at any stage, covering stalled shipment, suspected driver/buyer collusion, disputed delivery condition or quantity, or any other breakdown, without needing separate named functions per scenario or per stage.

**Sub-decision:** should `revoke` accept an optional short reason code (matching the categories used in your USSD dispute-reason menu — e.g. "Rotten Goods," "Suspected Collusion," "Incorrect Quantity") purely for the admin's context, even though it has zero effect on contract logic? (Recommendation: yes — store it as a plain `uint8 reasonCode` field on the `Deal` struct and emit it in the event; it costs almost nothing in gas and gives the Admin Portal a head start on triaging the case.)

### 4.6 Feature: Automatic Payout Release
**Function:** `releaseFunds(uint256 dealId)` — **keeper-callable, permissionless like 4.2**
- Require `status == Status.Delivered` (i.e., not revoked — revoked deals move to `Disputed` status and are excluded here).
- Require `block.timestamp >= deals[dealId].payoutReadyTime`.
- Transfer `amount` from contract balance to `sender`.
- Update `status = Status.Released`.
- Emit `FundsReleased`.

### 4.7 Feature: Dispute Resolution (Admin Arbitration)
**Function:** `resolveDispute(uint256 dealId, uint256 amountToSender, uint256 amountToReceiver)`
- Require `hasRole(ADMIN_ROLE, msg.sender)`.
- Require `status == Status.Disputed`.
- Require `amountToSender + amountToReceiver == deals[dealId].amount` (guarantees no funds can vanish or be minted out of thin air — the admin can only *redistribute* the exact locked amount, never move more or less than what's actually in escrow).
- Transfer `amountToSender` to `sender` (if non-zero) and `amountToReceiver` to `receiver` (if non-zero).
- Set `status = Status.Resolved` (a single terminal status covering every possible split — full refund, full payout, or anything in between — rather than separate named outcome statuses).
- Emit `DisputeResolved(dealId, msg.sender, amountToSender, amountToReceiver, timestamp)`.

**Why a flexible split instead of fixed named outcomes:** real disputes (e.g., goods arrived both rotten *and* short of the agreed quantity) rarely resolve cleanly to "full refund" or "full payout." Giving the admin a generic two-way split, constrained only by the total, lets them resolve *any* real-world outcome — including the degenerate cases that used to be named "Driver Fraud" (`amountToReceiver = amount`), "Faulty Goods" (`amountToReceiver = amount`), or "False Buyer Claim" (`amountToSender = amount`) — without the contract needing to know or care which named scenario it represents. The admin's off-chain investigation and the Admin Portal's UI can still *present* those as convenient preset buttons (Section 5.2 of the Phase 4 plan) that simply call this same function with the appropriate pre-filled amounts.

**Sub-decision:** Who holds `ADMIN_ROLE`? A single hardcoded address for the prototype, or a mapping allowing multiple admins (e.g., different cooperative managers for different deals)? Given your Section 9 (multi-tenant idea was simplified away), a single admin role for the whole contract is consistent with your "keep it simple" decisions — recommend starting there.

**Note on the driver's transport fee:** since the driver is not paid via this contract (payment is a private off-chain arrangement with the sender, per your Section 6 design), no split calculation here needs to account for the driver separately — the admin's split is only ever between `sender` and `receiver`. Whatever the sender ultimately does with their share regarding the driver's fee remains entirely off-chain.

**Exit criteria for Section 4:** every function above implemented, compiling, with explicit `require` statements matching every rule described — no implicit assumptions left as comments-only.

---

## 5. Access Control & Security Hardening

### 5.1 Role setup
- Deploy-time: grant `ADMIN_ROLE` to your designated arbitrator address, `OPERATOR_ROLE`/`KEEPER_ROLE` (if you decide keeper functions should be restricted) to your backend relay wallet.
- Document all role assignments in a deployment README so it's not tribal knowledge.

### 5.2 Re-entrancy protection
- Apply OpenZeppelin's `ReentrancyGuard` (`nonReentrant` modifier) to every function that moves funds (`lockFunds`, `releaseFunds`, `resolveDispute`) — even though eRWF is your own controlled token, this is a cheap, standard safety habit worth building now. Note that `revoke` and `cancelBeforeLock` no longer need this guard, since neither moves funds.

### 5.3 Integer/timestamp edge cases
- Confirm `block.timestamp` arithmetic can't overflow (Solidity 0.8+ has built-in overflow checks, but explicitly test boundary conditions — e.g., a deal created at `type(uint256).max - 1` is absurd but worth a defensive test).
- Test behavior exactly *at* deadline boundaries (e.g., `releaseFunds` called at exactly `payoutReadyTime` — should this succeed or fail? Decide `<=` vs `<` deliberately and test it, since off-by-one timing bugs are a classic escrow contract failure mode).
- For `resolveDispute`, explicitly test the boundary case `amountToSender = 0` and `amountToReceiver = 0` together, which should revert (since it wouldn't sum to `amount` unless `amount` is itself `0`, which `createDeal` already disallows) — confirm the sum-equality check correctly rejects any mismatched pair, including both-zero and both-full attempts.

### 5.4 Front-running / MEV considerations
- Since gas is relayed by your backend (not public users submitting transactions directly), classic front-running risk is low, but document this assumption explicitly — if you ever allow direct user-signed transactions in the future, revisit this section.

### 5.5 Pausability (optional but recommended)
- Consider adding OpenZeppelin's `Pausable` to the Escrow contract, with `ADMIN_ROLE` able to pause new deal creation / fund locking in case of a discovered bug post-deployment, without needing a full redeploy. Existing in-flight deals could still be allowed to resolve normally, or also paused — decide based on risk appetite for a learning-stage prototype (recommendation: pause new actions only, let in-flight deals with active timers still resolve, to avoid stranding funds).

---

---

## 6. Testing Strategy

### 6.1 Testing framework
- Use Hardhat + Chai + `hardhat-network-helpers` (for time manipulation — `time.increase()`, `time.increaseTo()` — essential for testing your 24hr and 3hr windows without waiting in real time).

### 6.2 Test suites to build (one file per feature area recommended)

**`eRWF.test.js`**
- Mint/burn role restrictions.
- Escrow-only transfer restriction.

**`dealCreation.test.js`**
- Successful creation with valid inputs.
- Reverts on zero address for driver/receiver.
- Reverts on zero amount.
- Reverts if sender == driver or sender == receiver (if you adopt that restriction).

**`fundLocking.test.js`**
- Successful lock within 24hrs.
- Revert if locking attempted by non-receiver.
- Revert if locking attempted after `fundLockDeadline`.
- `autoCancelIfUnlocked` succeeds only after deadline passed and status is still `Created`.
- `autoCancelIfUnlocked` reverts/no-ops if funds already locked.

**`shipmentAndDelivery.test.js`**
- `markShipped` only callable by sender, only from `FundsLocked` state.
- `markDelivered` only callable by driver, only from `Shipped` state.
- `payoutReadyTime` correctly set to `+3 hours` from call time.

**`disputeAndRelease.test.js`**
- **Happy path:** delivered → time-warp past 3hrs → `releaseFunds` succeeds, sender receives funds.
- **Ghosting buyer path:** same as above but explicitly simulate buyer doing nothing — confirm release still succeeds (this is your core anti-hostage guarantee, test it explicitly and name the test clearly).
- **Dispute freeze:** delivered → receiver disputes within window → confirm `releaseFunds` now reverts/no-ops, status is `Disputed`.
- **Early-fake-delivered scenario:** simulate driver marking delivered "early" (from the contract's perspective this is indistinguishable from a normal delivered call, since the contract doesn't know geolocation — but *test that the dispute path correctly overrides it* regardless of timing, since that's your real-world mitigation).
- **Dispute after window closed:** attempt to call `dispute()` after `payoutReadyTime` has passed — should revert, confirming the window is enforced precisely.

**`arbitration.test.js`**
- Only `ADMIN_ROLE` can call `resolveDispute`.
- `DriverFraud` outcome → funds returned to receiver.
- `FaultyGoods` outcome → funds returned to receiver.
- `FalseBuyerClaim` outcome → funds released to sender.
- Reverts if called on a deal not in `Disputed` status.

**`revoke.test.js`**
- Pre-lock cancellation succeeds from either party while `Created`.
- Mutual revoke: `requestRevoke` by one party, `confirmRevoke` reverts if called by the *same* party again, succeeds when called by the *other* party, funds returned to receiver.
- Unilateral revoke: reverts if called before `shipDeadline`; succeeds after `shipDeadline` passed while still `FundsLocked`; reverts if deal has already moved to `Shipped` (since unilateral revoke should only apply pre-shipment).

**`multiDealRoleSwitching.test.js`**
- Single address acts as `sender` in Deal A, `driver` in Deal B, `receiver` in Deal C, all simultaneously — confirm each deal's access control checks correctly isolate role per `dealId` and none interfere with each other.
- Confirm completing/closing one deal doesn't affect the state of the others.

**`accessControlAndSecurity.test.js`**
- Non-operator cannot mint eRWF.
- Non-admin cannot resolve disputes.
- Reentrancy guard present on all fund-moving functions (can be tested with a malicious mock receiver contract attempting reentry, if you want to go deep — optional for a prototype but good practice).
- Pause functionality (if implemented) blocks new deal creation but not in-flight resolution.

### 6.3 Coverage & gas reporting
- Run `hardhat-coverage` and target close to 100% line/branch coverage on the Escrow contract specifically, since this is the financial core.
- Run `hardhat-gas-reporter` to get a sense of per-function gas cost — useful later when deciding if your backend's gas relay budget is realistic at scale.

**Exit criteria for Section 6:** every scenario listed above has a passing, clearly-named test; `npx hardhat coverage` shows high coverage on `Escrow.sol` and `eRWF.sol`.

---

## 7. Local Deployment & Manual Verification

### 7.1 Deployment script
- Write a Hardhat deploy script (`scripts/deploy.js`) that:
  1. Deploys `eRWF.sol`.
  2. Deploys `Escrow.sol`, passing the eRWF token address.
  3. Grants `ESCROW_ROLE` on the token to the deployed Escrow contract address.
  4. Grants `ADMIN_ROLE` on Escrow to your designated admin address.
  5. Grants `OPERATOR_ROLE` on eRWF to your designated backend relay address.
  6. Logs all deployed addresses clearly to console/JSON file for later reuse.

### 7.2 Manual smoke test via Hardhat console or a script
- Run through one full happy-path deal manually using `hardhat console` or a small script: create deal → mint eRWF to a test receiver → lock funds → mark shipped → mark delivered → time-warp → release funds → confirm balances.
- Run through one full dispute path manually the same way.

**Exit criteria for Section 7:** you can deploy the full contract system to a fresh local node and manually walk through both a happy-path and a dispute-path deal successfully, confirming balances change exactly as expected at each step.

---

## 8. Testnet Deployment

### 8.1 Choose and fund a testnet
- Deploy to Avalanche Fuji (or Sepolia) using a funded test wallet (faucet funds).
- Re-run the deployment script against the testnet configuration.

### 8.2 Verify on block explorer
- Verify contract source code on the relevant explorer (Snowtrace for Fuji, Etherscan for Sepolia) so you (and anyone reviewing your project) can inspect the deployed bytecode against source.

### 8.3 Repeat manual smoke tests on testnet
- Confirm the same happy-path and dispute-path flows work against real (if slower) block times and gas costs, not just the instant local Hardhat network — this surfaces any assumptions your code silently made about instant mining that won't hold on a real chain.

**Exit criteria for Section 8:** contract deployed and verified on a public testnet, with both core flows manually confirmed working end-to-end.

---

## 9. Documentation Deliverables for Phase 1

Before moving to Phase 2, produce:
- **NatSpec comments** on every public/external function (purpose, parameters, access restrictions).
- A short **`CONTRACTS.md`** summarizing: deployed addresses (local + testnet), role assignments, and a state-transition diagram (can reuse/extend the one in your concept note).
- A **decisions log** capturing the sub-decisions flagged throughout this plan (e.g., FaultyGoods vs DriverFraud fund-movement equivalence, admin role singularity, shipDeadline default duration) so Phase 2's backend is built against confirmed rules, not assumptions.

---

## 10. Summary Checklist

- [ ] Hardhat project scaffolded, local + testnet networks configured
- [ ] eRWF token implemented with role-restricted mint/burn/transfer
- [ ] Deal struct, enum, and events fully defined
- [ ] `createDeal`, `lockFunds`, `autoCancelIfUnlocked`, `cancelBeforeLock` implemented
- [ ] `markShipped`, `markDelivered` implemented
- [ ] `dispute`, `releaseFunds` implemented with correct window enforcement
- [ ] `resolveDispute` implemented with all three outcomes
- [ ] `requestRevoke`/`confirmRevoke` and `unilateralRevoke` implemented
- [ ] ReentrancyGuard applied to all fund-moving functions
- [ ] Full test suite passing across all listed scenario files
- [ ] Coverage report generated and reviewed
- [ ] Local deployment script working, manual smoke tests passed (happy path + dispute path)
- [ ] Testnet deployment complete, contract verified, manual smoke tests repeated
- [ ] NatSpec, CONTRACTS.md, and decisions log written

Once every box above is checked, Phase 1 is genuinely complete and Phase 2 (Backend Bridge) can be built against a stable, tested, documented contract interface rather than a moving target.
