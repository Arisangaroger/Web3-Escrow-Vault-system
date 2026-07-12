# Escrow Smart Contracts

Phase 1 implementation of the Programmable Escrow smart contract system for agricultural trade.

## Overview

This folder contains:
- **eRWF.sol**: Simulated Rwanda Franc token (ERC-20 with restricted transfers)
- **Escrow.sol**: Deal lifecycle management with role-based access control

## Quick Start

### Installation

```bash
npm install
```

### Run Tests

```bash
npx hardhat test
```

### Deploy to Polygon Amoy Testnet

**Quick Deploy** (5 minutes):
```bash
# Setup .env first (copy from .env.example)
cp .env.example .env
# Add your PRIVATE_KEY to .env

# Check your balance
npx hardhat run scripts/check-balance.js --network amoy

# Deploy
npx hardhat run scripts/deploy.js --network amoy

# Verify contracts
npx hardhat run scripts/verify-contracts.js --network amoy
```

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for step-by-step guide or [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete documentation.

## Test Coverage

All core functionality is tested:

- ✅ **eRWF Token**: Minting, burning, transfer restrictions
- ✅ **Deal Creation**: Validation, role assignment
- ✅ **Fund Locking**: 24-hour deadline, auto-cancel
- ✅ **Shipment & Delivery**: Role-specific actions
- ✅ **Dispute & Release**: 3-hour window, auto-release
- ✅ **Arbitration**: Admin resolution with flexible splits
- ✅ **Multi-Deal Role Switching**: Same address in different roles

## Contract Architecture

### eRWF Token
- ERC-20 compliant with 18 decimals
- Minting/burning restricted to OPERATOR_ROLE (backend relay)
- Transfers only via ESCROW_ROLE (Escrow contract)
- Designed as drop-in replacement for BNR's future CBDC

### Escrow Contract
- State machine: Created → FundsLocked → Shipped → Delivered → Released/Disputed
- Time windows: 24h fund lock, 3h dispute window
- Permissionless keeper functions (auto-cancel, release)
- Flexible admin arbitration (any split that sums to deal amount)

## Key Design Features

1. **Revoke as Universal Escalation**
   - Single function for all "something is wrong" scenarios
   - Available post-lock at any stage
   - Freezes deal for admin review

2. **Triangular Broadcast Pattern**
   - Driver's "Delivered" alert goes to both sender AND receiver
   - Prevents collusion via transparency

3. **Role-Per-Deal Architecture**
   - Same address can be sender/driver/receiver in different deals
   - Access control scoped to dealId, not global

4. **Ghosting Buyer Protection**
   - Automatic release after 3 hours if no dispute
   - Seller can't be held hostage by unresponsive buyer

## Documentation

- **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)**: 5-minute deployment guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: Complete deployment documentation
- **[CONTRACTS.md](./CONTRACTS.md)**: Full technical documentation
- **[DECISIONS_LOG.md](./DECISIONS_LOG.md)**: Design decisions and rationale
- **[PHASE1_CHECKLIST.md](./PHASE1_CHECKLIST.md)**: Implementation checklist
- **phase1_smart_contract_core_plan.md**: Implementation plan (in root folder)
- **concept_note.md**: Project overview (in root folder)

## Next Steps (Phase 2)

- Backend bridge with custodial wallet management
- Gas relay for user transactions
- Event listening for triangular broadcasts
- Keeper job for timer-based actions

## Security Notes

- ReentrancyGuard on all fund-moving functions
- Role-based access control via OpenZeppelin
- Strict validation on all state transitions
- Sum validation in dispute resolution (prevents fund creation/loss)

## License

MIT
