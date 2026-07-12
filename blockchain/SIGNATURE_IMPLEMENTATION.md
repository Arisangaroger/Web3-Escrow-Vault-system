# Signature Implementation Guide

## Overview
The Escrow contract now requires EIP-712 signatures for all user actions to support the custodial wallet model where a relay wallet pays gas on behalf of users.

## Architecture

### Custodial Model
- **Backend holds private keys** for all users
- **Relay wallet** pays gas for all transactions
- **User signatures** prove intent and ownership
- **Nonces** prevent replay attacks

### Functions Requiring Signatures
1. `createDeal(driver, receiver, amount, signature)`
2. `lockFunds(dealId, signature)`
3. `cancelBeforeLock(dealId, signature)`
4. `markShipped(dealId, signature)`
5. `markDelivered(dealId, signature)`
6. `revoke(dealId, reasonCode, signature)`

### Permissionless Functions (No Signature)
- `autoCancelIfUnlocked(dealId)` - Anyone can call
- `releaseFunds(dealId)` - Anyone can call after timer
- `resolveDispute(dealId, amountToSender, amountToReceiver)` - Admin only

## Signature Generation

### Helper Module
Located at: `test/helpers/signatures.js`

```javascript
const { signAction } = require("./helpers/signatures");

// Generate signature
const nonce = await escrow.getNonce(signer.address);
const signature = await signAction(
  signer,          // Ethers signer object
  escrowAddress,   // Contract address
  chainId,         // Network chain ID
  "functionName",  // e.g., "createDeal"
  dealId,          // Deal ID (use 0 for createDeal)
  nonce            // Current nonce
);

// Call function via relay
await escrow.connect(relay).functionName(...args, signature);
```

### EIP-712 Structure
```solidity
Action(string functionName,uint256 dealId,uint256 nonce)
```

Domain:
```solidity
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
- name: "EscrowContract"
- version: "1"
- chainId: network chain ID
- verifyingContract: escrow contract address
```

## Test Updates Required

### 1. Setup Changes
```javascript
let relay; // Add relay wallet

beforeEach(async function () {
  [admin, operator, sender, driver, receiver, other, relay] = await ethers.getSigners();
  
  // ... deploy contracts ...
  
  escrowAddress = await escrow.getAddress();
  chainId = (await ethers.provider.getNetwork()).chainId;
});
```

### 2. Function Call Pattern
**Before:**
```javascript
await escrow.connect(sender).createDeal(driver.address, receiver.address, amount);
```

**After:**
```javascript
const nonce = await escrow.getNonce(sender.address);
const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
await escrow.connect(relay).createDeal(driver.address, receiver.address, amount, signature);
```

### 3. Nonce Management
- Nonce increments after **successful** signature verification
- Must fetch **current** nonce before each signed action
- Cannot reuse signatures (replay protection)

## Backend Implementation (Phase 2)

### Signature Generation Service
```javascript
const ethers = require('ethers');

class SignatureService {
  constructor(privateKey, contractAddress, chainId) {
    this.wallet = new ethers.Wallet(privateKey);
    this.contractAddress = contractAddress;
    this.chainId = chainId;
    this.domain = this.getDomainSeparator();
  }

  getDomainSeparator() {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
          ethers.keccak256(ethers.toUtf8Bytes("EscrowContract")),
          ethers.keccak256(ethers.toUtf8Bytes("1")),
          this.chainId,
          this.contractAddress
        ]
      )
    );
  }

  async signAction(functionName, dealId, nonce) {
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256", "uint256"],
        [
          ethers.keccak256(ethers.toUtf8Bytes("Action(string functionName,uint256 dealId,uint256 nonce)")),
          ethers.keccak256(ethers.toUtf8Bytes(functionName)),
          dealId,
          nonce
        ]
      )
    );

    const digest = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes("\x19\x01"),
        this.domain,
        structHash
      ])
    );

    return await this.wallet.signMessage(ethers.getBytes(digest));
  }
}

// Usage
const signer = new SignatureService(userPrivateKey, escrowAddress, 80002);
const signature = await signer.signAction("createDeal", 0, currentNonce);
```

### Nonce Tracking
Backend must maintain nonce state or fetch from contract:
```javascript
const currentNonce = await escrowContract.getNonce(userAddress);
```

## Security Considerations

1. **Nonce Management**: Critical for replay protection
2. **Signature Validation**: Contract verifies signer matches expected role
3. **tx.origin Usage**: Used for nonce lookup since relay submits transactions
4. **Private Key Security**: Backend must securely store user private keys

## Testing Checklist

- [x] dealCreation.test.js - Updated with signatures
- [ ] fundLocking.test.js - Needs signature updates
- [ ] shipmentAndDelivery.test.js - Needs signature updates  
- [ ] disputeAndRelease.test.js - Needs signature updates
- [ ] arbitration.test.js - Needs signature updates
- [ ] multiDealRoleSwitching.test.js - Needs signature updates
- [ ] eRWF.test.js - No changes needed (no signatures required)

## Deployment Notes

1. Deploy eRWF with operator address
2. Deploy Escrow with eRWF address and admin address
3. Backend tracks nonces or fetches from `getNonce(address)`
4. Relay wallet needs sufficient MATIC for gas
5. Users never see their private keys (custodial model)
