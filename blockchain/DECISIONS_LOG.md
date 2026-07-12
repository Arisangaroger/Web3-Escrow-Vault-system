# Implementation Decisions Log

## Phase 1 - Smart Contract Core

This document captures key design decisions made during Phase 1 implementation.

### 1. eRWF Token Decimals

**Decision**: Use 18 decimals (standard ERC-20)

**Rationale**:
- Avoids custom math edge cases
- Compatible with existing tooling (wallets, explorers)
- Display formatting handled in backend/UI layer
- RWF's real-world lack of subdivision handled at presentation layer

**Alternative Considered**: 2 decimals to mirror real RWF

**Status**: ✅ Implemented

---

### 2. Transfer Restriction Pattern

**Decision**: Block direct `transfer()`, allow only `transferFrom()` by ESCROW_ROLE

**Rationale**:
- Prevents users from moving locked funds outside deal lifecycle
- Forces all movements through escrow contract logic
- Users can still `approve()` the escrow contract

**Alternative Considered**: Allow transfers but track locked balance separately

**Status**: ✅ Implemented

---

### 3. Revoke vs. Separate Dispute Actions

**Decision**: Single `revoke()` function for all escalations

**Rationale**:
- Simpler UX - one action for "something is wrong"
- Covers all scenarios: stalled shipment, suspected collusion, disputed delivery
- Available at any post-lock stage
- Reason code provides admin context without affecting contract logic

**Alternative Considered**: Separate functions per scenario (disputeDelivery, reportStall, etc.)

**Status**: ✅ Implemented

---

### 4. Dispute Resolution Flexibility

**Decision**: Generic split (amountToSender, amountToReceiver) instead of fixed outcomes

**Rationale**:
- Real disputes rarely fit clean categories
- Allows partial refunds for partial delivery/quality issues
- Admin can handle any outcome: 100/0, 0/100, 60/40, etc.
- Sum validation prevents fund creation/loss

**Alternative Considered**: Fixed outcome functions (refundBuyer, paySeller, split50/50)

**Status**: ✅ Implemented

---

### 5. Driver's Financial Role

**Decision**: Driver NOT paid through smart contract

**Rationale**:
- Transport payment is private arrangement between sender and driver
- Driver only provides oracle role (delivery confirmation)
- Simplifies contract logic
- Matches real-world practice (farmer pays transporter separately)

**Alternative Considered**: Three-way split in escrow

**Status**: ✅ Implemented, documented

---

### 6. Keeper Function Permissions

**Decision**: Permissionless (anyone can call `autoCancelIfUnlocked`, `releaseFunds`)

**Rationale**:
- Reduces single point of failure
- Hard-coded time checks prevent abuse
- Backend keeper is just one possible caller
- Any party can "refresh" state opportunistically

**Alternative Considered**: Restricted to KEEPER_ROLE

**Status**: ✅ Implemented

---

### 7. Admin Role Structure

**Decision**: Single ADMIN_ROLE for all disputes

**Rationale**:
- Prototype simplicity
- Matches concept note's "4th party arbitrator" model
- Can be extended to per-deal or per-cooperative admins in Phase 2+

**Alternative Considered**: Multi-tenant admin mapping per deal

**Status**: ✅ Implemented (single admin), documented as future extension

---

### 8. Role-Per-Deal vs. Global Roles

**Decision**: Roles scoped per dealId, not globally

**Rationale**:
- Same address can be sender in Deal A, driver in Deal B, receiver in Deal C
- Matches real-world flexibility
- Access checks validate `msg.sender` against specific deal's role fields

**Alternative Considered**: Global role registry

**Status**: ✅ Implemented, tested in multiDealRoleSwitching.test.js

---

### 9. Fund Lock Deadline Handling

**Decision**: 24-hour window, auto-cancel if not met, permissionless trigger

**Rationale**:
- Prevents indefinite "Created" state limbo
- Protects sender from having deal hang
- No funds at risk (nothing locked yet)

**Alternative Considered**: Manual cancellation only

**Status**: ✅ Implemented

---

### 10. Dispute Window Enforcement

**Decision**: 3-hour timer starts at `markDelivered`, revoke freezes timer

**Rationale**:
- Receiver has time to physically verify goods
- Auto-release protects seller from ghosting buyer
- Revoke at any point (even after timer) still works - just freezes auto-release

**Alternative Considered**: Receiver must actively accept delivery

**Status**: ✅ Implemented

---

### 11. Pre-Lock Cancellation

**Decision**: Either sender or receiver can cancel before funds locked, no admin needed

**Rationale**:
- No funds at risk yet
- Reduces admin burden
- Fast exit for changed plans

**Alternative Considered**: Only sender can cancel

**Status**: ✅ Implemented

---

### 12. Role Validation at Deal Creation

**Decision**: Disallow sender == driver, sender == receiver, driver == receiver

**Rationale**:
- Prevents degenerate self-dealing states
- Matches real-world expectation of three distinct parties

**Alternative Considered**: Allow same address in multiple roles per deal

**Status**: ✅ Implemented

---

### 13. Pausability

**Decision**: NOT implemented in Phase 1

**Rationale**:
- Prototype stage - redeploy if needed
- Noted as production consideration in CONTRACTS.md

**Alternative Considered**: Include OpenZeppelin Pausable

**Status**: ⏸️ Deferred to production phase

---

### 14. Upgrade Mechanism

**Decision**: NOT implemented (no proxy pattern)

**Rationale**:
- Prototype simplicity
- Direct deployment easier to reason about
- Testnet redeployment acceptable

**Alternative Considered**: UUPS or Transparent Proxy pattern

**Status**: ⏸️ Deferred to production phase

---

### 15. Gas Relay vs. User-Signed Transactions

**Decision**: Backend relay pattern (Phase 2), contract doesn't enforce

**Rationale**:
- Contract accepts any valid transaction
- Phase 2 backend will sign on behalf of users
- Matches USSD UX (users never see wallets/gas)

**Alternative Considered**: Meta-transaction pattern (EIP-2771)

**Status**: ✅ Architecture documented, backend implementation in Phase 2

---

### 16. Event Emission Strategy

**Decision**: Emit detailed events for every state transition

**Rationale**:
- Backend indexes events for triangular broadcasts
- Admin portal uses events for audit trail
- Off-chain indexing more efficient than on-chain participant arrays

**Alternative Considered**: On-chain mapping(address => dealId[]) for participant lookup

**Status**: ✅ Implemented

---

### 17. Ship Deadline (Mutual vs. Unilateral Revoke)

**Decision**: Removed shipDeadline field and unilateral revoke logic

**Rationale**:
- Simpler mental model: one revoke mechanism for all scenarios
- Original concept note emphasized simplicity
- Stalled shipment handled via regular revoke + admin arbitration

**Alternative Considered**: Unilateral revoke after shipDeadline expires

**Status**: ✅ Simplified to single revoke mechanism

---

### 18. Test Framework Choice

**Decision**: Hardhat + Chai + Ethers v5

**Rationale**:
- Mature ecosystem
- JavaScript-native (matches backend stack)
- Good error messages
- Time manipulation via hardhat-network-helpers

**Alternative Considered**: Foundry (Solidity tests)

**Status**: ✅ Implemented

---

### 19. Solidity Version

**Decision**: 0.8.20

**Rationale**:
- Built-in overflow checks
- Compatible with OpenZeppelin 4.x
- Stable, widely used version

**Alternative Considered**: 0.8.latest

**Status**: ✅ Implemented

---

### 20. Network Helpers vs Manual Time Warp

**Decision**: Use @nomicfoundation/hardhat-network-helpers for time manipulation

**Rationale**:
- Clean API (`time.increaseTo()`)
- Standard tool
- Readable test code

**Alternative Considered**: Manual `evm_increaseTime` calls

**Status**: ✅ Implemented

---

## Future Decisions (Phase 2+)

These will need decisions during backend implementation:

- Phone number to wallet mapping strategy
- Custodial key storage (KMS vs. database encryption)
- Gas relay wallet management (single vs. per-user)
- Event listener architecture (polling vs. websocket)
- Keeper job scheduling (cron vs. queue-based)
- SMS broadcast provider (Africa's Talking vs. custom simulator)

---

## Changelog

- 2026-07-11: Initial decisions log created during Phase 1 implementation
