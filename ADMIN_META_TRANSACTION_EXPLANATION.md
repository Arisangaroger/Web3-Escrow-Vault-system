# Admin Meta-Transaction Pattern Explanation

## Overview

The admin portal uses a **different pattern** than regular user actions when resolving disputes. This document explains why and how it works.

---

## User Actions: Meta-Transaction Pattern (EIP-712 Signatures)

### How It Works

For regular user actions (createDeal, lockFunds, markShipped, etc.):

1. **User signs off-chain** with their custodial wallet
2. **Backend generates EIP-712 signature**
3. **Relay wallet submits transaction** to blockchain
4. **Smart contract verifies signature** to identify real actor
5. **Relay wallet pays gas**

### Smart Contract Pattern

```solidity
function markShipped(uint256 dealId, bytes calldata signature) external {
    Deal storage deal = deals[dealId];
    
    // Verify who signed (actual user)
    address sender = _verifySigner(deal.sender, "markShipped", dealId, signature);
    
    // msg.sender is relay wallet, but sender is the actual user
    require(deal.status == Status.FundsLocked, "Funds must be locked first");
    deal.status = Status.Shipped;
    
    emit MarkedShipped(dealId, sender, block.timestamp);
}
```

**Key Points:**
- `msg.sender` = relay wallet (pays gas)
- `sender` (from signature) = actual user (has authority)
- Contract uses `_verifySigner()` to recover real actor
- User's nonce incremented to prevent replay

---

## Admin Actions: Direct Role-Based Access Control

### How It Works

For admin dispute resolution:

1. **Admin authenticates via JWT** (email + password)
2. **Backend uses admin wallet directly** (custodial, like users)
3. **Admin wallet submits transaction** (not relay wallet!)
4. **Smart contract checks msg.sender has ADMIN_ROLE**
5. **Admin wallet pays gas**

### Smart Contract Pattern

```solidity
function resolveDispute(
    uint256 dealId,
    uint256 amountToSender,
    uint256 amountToReceiver
) external onlyRole(ADMIN_ROLE) nonReentrant {
    Deal storage deal = deals[dealId];
    
    // msg.sender must have ADMIN_ROLE (checked by modifier)
    require(deal.status == Status.Disputed, "Deal not in Disputed status");
    require(
        amountToSender + amountToReceiver == deal.amount,
        "Amounts must sum to deal amount"
    );
    
    deal.status = Status.Resolved;
    
    // Transfer funds...
    
    emit DisputeResolved(
        dealId,
        msg.sender,  // Admin wallet address
        amountToSender,
        amountToReceiver,
        block.timestamp
    );
}
```

**Key Points:**
- NO signature parameter
- `msg.sender` = admin wallet (must have ADMIN_ROLE)
- `onlyRole(ADMIN_ROLE)` modifier checks role directly
- No `_verifySigner()` call
- Admin wallet pays gas

---

## Why the Difference?

### Technical Reasons

1. **Security Model:**
   - Users: Need replay protection (nonce), signature verification
   - Admin: Role-based access control is simpler and more direct
   - Admin actions are rare (only disputes), so gas cost is acceptable

2. **Smart Contract Design:**
   - `resolveDispute` uses OpenZeppelin's AccessControl
   - No need for meta-transaction complexity
   - Direct role check is more gas-efficient for this use case

3. **Audit Trail:**
   - Users: Real actor recovered from signature
   - Admin: msg.sender is the actual admin wallet
   - Both approaches provide clear attribution

### Practical Reasons

1. **Admin Wallet Management:**
   - Admin wallet stored in backend (ADMIN_PRIVATE_KEY)
   - Single admin wallet for all cooperative managers
   - Custodial pattern consistent with user wallets

2. **Gas Costs:**
   - Admin actions are infrequent (only disputes)
   - Direct submission is simpler
   - No need for relay wallet complexity

3. **Authorization:**
   - Admin is authenticated via JWT (email + password)
   - Backend holds admin's custodial wallet
   - Backend submits transaction on their behalf

---

## Implementation Details

### Backend (ContractsService)

```typescript
/**
 * Resolve dispute — caller must hold ADMIN_ROLE (ADMIN_PRIVATE_KEY)
 * Note: Does NOT use meta-transactions like user actions
 */
async resolveDisputeOnChain(
  dealId: number,
  amountToSender: string,
  amountToReceiver: string,
): Promise<string> {
  try {
    const amountToSenderWei = ethers.parseEther(amountToSender);
    const amountToReceiverWei = ethers.parseEther(amountToReceiver);

    // Admin wallet submits directly (not relay wallet!)
    const tx = await this.escrowContract
      .connect(this.adminWallet)  // ADMIN_PRIVATE_KEY
      .resolveDispute(dealId, amountToSenderWei, amountToReceiverWei);
    
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error) {
    throw new Error(this.formatContractError('resolveDispute', error));
  }
}
```

### Admin Wallet Setup

```typescript
// In ContractsService constructor
const adminKey =
  this.configService.get<string>('ADMIN_PRIVATE_KEY') ||
  this.configService.get<string>('TREASURY_PRIVATE_KEY');  // Fallback

this.adminWallet = new ethers.Wallet(adminKey, provider);
```

**Important:** The admin wallet must have `ADMIN_ROLE` granted on the Escrow contract.

### Granting Admin Role

```javascript
// In smart contract deployment or setup script
const escrow = await ethers.getContractAt("Escrow", escrowAddress);
const ADMIN_ROLE = await escrow.ADMIN_ROLE();

// Grant role to admin wallet
await escrow.grantRole(ADMIN_ROLE, adminWalletAddress);
```

---

## Comparison Table

| Aspect | User Actions | Admin Actions |
|--------|--------------|---------------|
| **Pattern** | Meta-transaction (EIP-712) | Direct role-based |
| **Signature** | Yes (off-chain) | No |
| **Who Submits** | Relay wallet | Admin wallet |
| **Who Pays Gas** | Relay wallet | Admin wallet |
| **Contract Verification** | `_verifySigner()` | `onlyRole(ADMIN_ROLE)` |
| **Nonce Tracking** | Yes (per user) | No |
| **msg.sender** | Relay wallet address | Admin wallet address |
| **Real Actor** | Recovered from signature | msg.sender |
| **Examples** | createDeal, lockFunds, markShipped | resolveDispute |

---

## Security Considerations

### Admin Wallet

1. **Custodial Pattern:**
   - Admin wallet private key stored in backend (ADMIN_PRIVATE_KEY)
   - Encrypted at rest (same as user wallets)
   - Decrypted only for transaction signing

2. **Authentication:**
   - Admin authenticates via JWT (email + password)
   - Password hashed with Argon2
   - JWT tokens expire after 8 hours
   - HTTP-only cookies prevent XSS

3. **Authorization:**
   - Smart contract checks `onlyRole(ADMIN_ROLE)`
   - Only addresses with role can call resolveDispute
   - Role granted during contract setup

4. **Audit Trail:**
   - Every resolution logged to database
   - Includes admin email, outcome, tx hash
   - Blockchain event includes admin wallet address

### Why This Is Secure

1. **Multi-Layer Authentication:**
   - Layer 1: Admin must know password (JWT authentication)
   - Layer 2: Backend must have admin private key (custodial)
   - Layer 3: Smart contract checks ADMIN_ROLE on-chain

2. **Accountability:**
   - Backend logs which admin (by email) triggered resolution
   - Blockchain logs which wallet (by address) executed transaction
   - Both logs are immutable

3. **Separation of Concerns:**
   - Frontend: JWT authentication, user identity
   - Backend: Custodial wallet management, transaction signing
   - Blockchain: Role-based access control, fund movement

---

## Alternative Approach (Not Implemented)

### Option: Admin Signs, Relay Submits

You could implement admin actions with meta-transactions too:

```solidity
// Hypothetical approach (NOT in current implementation)
function resolveDispute(
    uint256 dealId,
    uint256 amountToSender,
    uint256 amountToReceiver,
    address admin,
    bytes calldata signature
) external nonReentrant {
    // Verify admin signature
    _verifySigner(admin, "resolveDispute", dealId, signature);
    
    // Check admin role
    require(hasRole(ADMIN_ROLE, admin), "Not admin");
    
    // Rest of resolution logic...
}
```

**Why We Don't Use This:**

1. **Added Complexity:** Admin actions are rare, don't need meta-tx optimization
2. **Gas Costs:** Direct submission is simpler, gas cost is acceptable
3. **Security:** Role-based AC is well-tested pattern (OpenZeppelin)
4. **Audit Trail:** msg.sender = admin wallet is clearer

---

## Configuration

### Environment Variables

```env
# Relay wallet for user meta-transactions
TREASURY_PRIVATE_KEY="0xRELAY_WALLET_PRIVATE_KEY"

# Admin wallet for dispute resolution (must have ADMIN_ROLE)
ADMIN_PRIVATE_KEY="0xADMIN_WALLET_PRIVATE_KEY"
```

**Note:** If ADMIN_PRIVATE_KEY not set, falls back to TREASURY_PRIVATE_KEY.

### On-Chain Setup

```bash
# Grant ADMIN_ROLE to admin wallet
npx hardhat run scripts/grant-admin-role.js --network amoy

# Verify role granted
npx hardhat console --network amoy
> const escrow = await ethers.getContractAt("Escrow", "ADDRESS");
> const ADMIN_ROLE = await escrow.ADMIN_ROLE();
> await escrow.hasRole(ADMIN_ROLE, "ADMIN_WALLET_ADDRESS");
# Should return: true
```

---

## Summary

- **User actions** = Meta-transactions (user signs, relay submits, contract verifies signature)
- **Admin actions** = Direct role-based (admin wallet submits, contract checks role)
- Both are **custodial** (backend holds private keys)
- Both are **secure** (multi-layer authentication and authorization)
- Both provide **audit trails** (database + blockchain logs)

The key difference is in the **authorization mechanism**:
- Users: Signature verification (`_verifySigner()`)
- Admin: Role verification (`onlyRole(ADMIN_ROLE)`)

This design choice balances **security**, **simplicity**, and **gas efficiency** for the different use cases.

---

**Last Updated:** July 13, 2026  
**Related Files:**
- `backend/src/modules/contracts/contracts.service.ts`
- `backend/src/modules/admin/admin.service.ts`
- `blockchain/contracts/Escrow.sol`
