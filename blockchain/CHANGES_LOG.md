# Changes Log

## July 11, 2026 - Transfer Restriction Removal

### Summary
Removed transfer restrictions from eRWF token to allow real-world CBDC behavior. Users can now freely transfer eRWF for any purpose, not just escrow.

### Rationale
- **Original Design**: Transfer restrictions prevented users from directly transferring eRWF tokens
- **Problem**: This made eRWF unusable for everyday transactions (groceries, bills, etc.)
- **Impact**: Limited adoption potential for country-wide deployment
- **Solution**: Allow standard ERC-20 transfers while maintaining escrow security through contract custody

### Changes Made

#### 1. eRWF.sol - Token Contract
**Removed**:
- `ESCROW_ROLE` constant
- Transfer restrictions in `transfer()` and `transferFrom()`
- Role check in `transferFrom()`

**Added**:
- Standard ERC-20 `transfer()` implementation
- Standard ERC-20 `transferFrom()` with allowance spending

**Result**: Users can now freely transfer eRWF tokens to anyone

#### 2. Escrow.sol - Escrow Contract
**Changed**:
- `releaseFunds()`: Changed from `token.transferFrom(address(this), ...)` to `token.transfer(...)`
- `resolveDispute()`: Changed from `token.transferFrom(address(this), ...)` to `token.transfer(...)`

**Rationale**: Contract OWNS the tokens after lockFunds(), so it uses `transfer()` not `transferFrom()`

#### 3. Test Files
**Updated all test files to remove**:
- ESCROW_ROLE setup
- ESCROW_ROLE grants to escrow contract

**Updated eRWF.test.js**:
- Changed "Transfer Restrictions" tests to verify FREE transfers work
- Added tests for everyday use cases

#### 4. Deployment Scripts
**Updated**:
- `deploy.js`: Removed ESCROW_ROLE grant
- `test-deployment.js`: Removed ESCROW_ROLE check
- `test-flow.js`: Removed ESCROW_ROLE setup

### Security Model

#### Before (Restrictive)
```
User Balance: 10,000 eRWF
├─ Can't transfer directly ❌
└─ Must go through escrow for ALL movements
```

#### After (Flexible)
```
User Balance: 10,000 eRWF
├─ Can transfer freely ✅
│   ├─ Pay for groceries
│   ├─ Send to friends
│   └─ Any normal transaction
│
└─ When locking in escrow:
    ├─ 1,000 eRWF → Escrow Contract
    ├─ User balance: 9,000 eRWF
    └─ Contract holds 1,000 eRWF (user can't touch)
```

### Escrow Protection Mechanism

**How funds are protected**:
1. User approves escrow contract: `token.approve(escrow, 1000)`
2. Contract pulls funds: `token.transferFrom(user, escrow, 1000)`
3. Contract OWNS the tokens (they're in contract's balance)
4. User's balance decreased by 1000
5. User CANNOT move those 1,000 tokens (contract has them)
6. Only contract code can release them

**Key Insight**: Protection comes from CONTRACT CUSTODY, not transfer restrictions.

### Real-World Analogy

**Before**: 
- eRWF was like "escrow-only money" - you could only use it in the escrow system
- Like having cash that you can ONLY put in a safety deposit box

**After**:
- eRWF behaves like normal money - use it anywhere
- Escrow is just ONE use case
- Like having cash you can spend normally, OR choose to put in escrow for a deal

### Testing

**Verification**:
- ✅ Happy path test passed
- ✅ Users can freely transfer eRWF
- ✅ Escrow still locks funds securely
- ✅ Funds release correctly after deal completion

**Test Command**:
```bash
npx hardhat run scripts/test-flow.js
```

### Benefits

1. **Real-World Usability**
   - Users can use eRWF for everyday transactions
   - Not limited to escrow only
   - Better CBDC simulation

2. **Country-Wide Adoption**
   - People can spend eRWF anywhere
   - Escrow is optional feature, not required
   - More realistic for national deployment

3. **Industry Standard**
   - Follows standard ERC-20 behavior
   - Same pattern as USDC, DAI, USDT
   - Same pattern as Uniswap, Aave (contracts hold tokens)

4. **Maintains Security**
   - Escrow protection via contract custody (standard approach)
   - Once locked, user can't access funds
   - Only contract can release based on rules

### Migration Notes

**For Phase 2 Backend**:
- No changes needed to lockFunds() flow
- Users still approve and contract still pulls tokens
- Backend doesn't need to manage ESCROW_ROLE
- Simpler role management (only OPERATOR_ROLE needed)

**For Deployment**:
- No ESCROW_ROLE to grant during deployment
- Simpler deployment script
- One less role to manage

### Documentation Updated

- [x] DECISIONS_LOG.md - Updated decision #2
- [x] CONTRACTS.md - Updated to reflect free transfers
- [x] eRWF.sol - Updated NatSpec comments
- [x] Escrow.sol - Updated transfer method calls
- [x] README.md - Reflects new transfer behavior
- [x] CHANGES_LOG.md - This document

### Backward Compatibility

**Breaking Changes**:
- ESCROW_ROLE no longer exists
- Tests that checked for transfer restrictions will fail
- Deployment scripts that grant ESCROW_ROLE will fail

**Migration Path**:
- Update all references to remove ESCROW_ROLE
- Update tests to expect free transfers
- Update deployment scripts

### Future Considerations

**For Production CBDC**:
- This design aligns with how real CBDCs will work
- Users have normal spending power
- Programmable contracts (like escrow) use standard custody
- No special permissions needed for contracts
- BNR e-Franc integration will be seamless

---

**Status**: ✅ Implemented and Tested  
**Breaking Change**: Yes (ESCROW_ROLE removed)  
**Security Impact**: None (maintains same security via custody)  
**User Impact**: Positive (more flexibility)
