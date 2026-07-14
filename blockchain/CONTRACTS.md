# Smart Contracts Documentation

## Overview

This folder contains the core smart contracts for the Programmable Escrow system:
- **eRWF.sol**: Simulated Rwanda Franc (eRWF) token
- **Escrow.sol**: Deal lifecycle management and escrow logic

## Contract Addresses

### Local Network (Hardhat)
*Deployed addresses will be saved in `deployments/` folder after running deploy script*

### Fuji Testnet
*To be deployed*

### Sepolia Testnet
*To be deployed*

## Role Assignments

### eRWF Token Roles
- **DEFAULT_ADMIN_ROLE**: Can manage all other roles
- **OPERATOR_ROLE**: Can mint and burn eRWF tokens (backend relay wallet)
- **ESCROW_ROLE**: Can transfer tokens on behalf of users (Escrow contract only)

### Escrow Contract Roles
- **DEFAULT_ADMIN_ROLE**: Can manage all other roles
- **ADMIN_ROLE**: Can resolve disputed deals (4th party arbitrator)

## State Machine

### Deal Status Flow

```
Created
  ├─> Cancelled (auto-cancel if not locked in 24hrs)
  ├─> Cancelled (manual cancel by sender/receiver before lock)
  └─> FundsLocked
        ├─> Disputed (revoke by sender/receiver)
        └─> Shipped
              ├─> Disputed (revoke by sender/receiver)
              └─> Delivered
                    ├─> Disputed (revoke by sender/receiver)
                    └─> Released (auto after 3hrs if no dispute)

Disputed
  └─> Resolved (admin arbitration)
```

## Time Windows

- **Fund Lock Deadline**: 24 hours from deal creation
- **Dispute Window**: 3 hours from delivery confirmation
- **Payout Ready Time**: Set when goods marked delivered, expires after 3 hours

## Key Design Decisions

### 1. Revoke as Universal Escalation
- Single `revoke()` function covers all "something is wrong" scenarios
- Available to sender or receiver at any post-lock stage
- Never moves funds itself - only freezes deal for admin review
- Accepts optional reason code for admin context

### 2. Flexible Dispute Resolution
- Admin can split funds any way that sums to deal amount
- Covers all real-world outcomes without predefined categories
- Prevents fund loss or creation (strict sum validation)

### 3. Driver's Financial Role
- Driver is NOT paid through the smart contract
- Driver payment is a private arrangement with sender
- Driver only provides oracle role (delivery confirmation)

### 4. Permissionless Keeper Functions
- `autoCancelIfUnlocked()` - anyone can call
- `releaseFunds()` - anyone can call
- Reduces single point of failure
- Backend keeper job is just one possible caller

### 5. Transfer Restrictions
- Direct `transfer()` disabled on eRWF token
- Only Escrow contract can move funds via `transferFrom()`
- Prevents users from moving locked funds outside deal lifecycle

### 6. Role-Per-Deal Architecture
- Same address can hold different roles in different deals simultaneously
- Access control checks are scoped to specific `dealId`
- No global role registry - enables flexible multi-deal participation

## Functions Reference

### eRWF Token

#### `mint(address to, uint256 amount)` - OPERATOR_ROLE only
Mints new eRWF tokens.

#### `burn(address from, uint256 amount)` - OPERATOR_ROLE only
Burns eRWF tokens.

#### `transferFrom(address from, address to, uint256 amount)` - ESCROW_ROLE only
Moves tokens (direct transfers blocked).

### Escrow Contract

#### `createDeal(address driver, address receiver, uint256 amount)` → uint256
Creates new deal, returns dealId. Caller becomes sender.

#### `lockFunds(uint256 dealId)` - receiver only
Locks funds into escrow within 24-hour window.

#### `autoCancelIfUnlocked(uint256 dealId)` - permissionless
Cancels deal if funds not locked after deadline.

#### `cancelBeforeLock(uint256 dealId)` - sender or receiver
Cancels deal before funds locked (no admin needed).

#### `markShipped(uint256 dealId)` - sender only
Marks goods as shipped.

#### `markDelivered(uint256 dealId)` - driver only
Marks goods delivered, starts 3-hour dispute window.

#### `revoke(uint256 dealId, uint8 reasonCode)` - sender or receiver
Universal escalation mechanism. Freezes deal for admin review.

#### `releaseFunds(uint256 dealId)` - permissionless
Releases funds to sender after dispute window expires (if not disputed).

#### `resolveDispute(uint256 dealId, uint256 amountToSender, uint256 amountToReceiver)` - ADMIN_ROLE
Splits locked funds between parties. Amounts must sum to deal amount.

## Events

All state transitions emit events for backend indexing and triangular broadcast:

- `DealCreated`
- `FundsLocked`
- `DealAutoCancelled`
- `DealCancelled`
- `MarkedShipped`
- `MarkedDelivered`
- `DealRevoked`
- `FundsReleased`
- `DisputeResolved`

## Security Features

- **ReentrancyGuard**: Applied to all fund-moving functions
- **AccessControl**: Role-based permissions via OpenZeppelin
- **Transfer Restrictions**: Prevents direct token transfers
- **Strict Sum Validation**: Admin can't create or destroy funds in disputes
- **Per-Deal Role Checks**: Prevents cross-deal permission leakage

## Testing

Run tests:
```bash
npx hardhat test
```

Run with gas reporting:
```bash
REPORT_GAS=true npx hardhat test
```

Generate coverage report:
```bash
npx hardhat coverage
```

## Deployment (Polygon Amoy)

```bash
# blockchain/.env: PRIVATE_KEY with Amoy MATIC
npx hardhat run scripts/deploy.js --network amoy
```

Copy Escrow + eRWF addresses into `backend/.env` (`CHAIN_ID=80002`, Amoy `RPC_URL`).

Unit tests (local Hardhat network, not Amoy):
```bash
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat coverage
```

Verify on PolygonScan Amoy after deploy (optional):
```bash
npx hardhat run scripts/verify-contracts.js --network amoy
```
