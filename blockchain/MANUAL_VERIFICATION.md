# Manual Contract Verification on PolygonScan

Since automated verification has compatibility issues, here's how to verify contracts manually on PolygonScan.

## Why Verify?

Verified contracts allow users to:
- Read the source code directly on PolygonScan
- Interact with contract functions through the web interface
- Verify security and transparency
- Build trust with users

## Step-by-Step Verification

### 1. Deploy Your Contracts

```bash
npx hardhat run scripts/deploy.js --network amoy
```

Save the contract addresses from the output.

### 2. Go to PolygonScan Amoy

Visit: https://amoy.polygonscan.com/

### 3. Verify eRWF Token

**A. Navigate to Contract**
- Go to: `https://amoy.polygonscan.com/address/YOUR_ERWF_ADDRESS`
- Click on the "Contract" tab
- Click "Verify and Publish"

**B. Fill in Verification Form**

| Field | Value |
|-------|-------|
| Compiler Type | Solidity (Single file) |
| Compiler Version | v0.8.20+commit.a1b79de6 |
| Open Source License Type | MIT License (MIT) |

Click "Continue"

**C. Enter Contract Source Code**

1. **Contract Address**: Already filled
2. **Contract Name**: `eRWF`
3. **Optimization**: Yes
4. **Runs**: 200

**Solidity Source Code**: Copy the flattened contract

Get flattened contract:
```bash
npx hardhat flatten contracts/eRWF.sol > eRWF-flat.sol
```

Then copy the entire content from `eRWF-flat.sol` and paste it into the form.

**Remove duplicate SPDX and pragma lines** - keep only the first occurrence of:
- `// SPDX-License-Identifier: MIT`
- `pragma solidity ^0.8.20;`

5. **Constructor Arguments ABI-encoded**: 

Get constructor args:
```javascript
// Admin address (the one you used during deployment)
// Example: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

// Encode it:
const adminAddress = "0xYOUR_ADMIN_ADDRESS";
const encoded = ethers.utils.defaultAbiCoder.encode(["address"], [adminAddress]);
console.log(encoded);
```

Or use online ABI encoder: https://abi.hashex.org/

Input format:
```
address: YOUR_ADMIN_ADDRESS
```

Click "Verify and Publish"

### 4. Verify Escrow Contract

**Repeat same process for Escrow contract:**

1. Go to: `https://amoy.polygonscan.com/address/YOUR_ESCROW_ADDRESS`
2. Click "Verify and Publish"
3. Fill form:
   - Compiler: v0.8.20+commit.a1b79de6
   - Optimization: Yes (200 runs)
   - Contract Name: `Escrow`

4. **Source Code**: Get flattened contract:
```bash
npx hardhat flatten contracts/Escrow.sol > Escrow-flat.sol
```

5. **Constructor Arguments**: Two parameters

```javascript
// Encode both eRWF address and admin address
const erwfAddress = "0xYOUR_ERWF_ADDRESS";
const adminAddress = "0xYOUR_ADMIN_ADDRESS";

const encoded = ethers.utils.defaultAbiCoder.encode(
  ["address", "address"], 
  [erwfAddress, adminAddress]
);
console.log(encoded);
```

Or use ABI encoder with:
```
address: YOUR_ERWF_ADDRESS
address: YOUR_ADMIN_ADDRESS
```

Click "Verify and Publish"

## Alternative: Simplified Flattening

If you get compilation errors from duplicate imports:

### Option 1: Clean the flattened file manually

Remove all duplicate:
- `// SPDX-License-Identifier` lines (keep first)
- `pragma solidity` lines (keep first)
- Import statements (already inlined)

### Option 2: Use Hardhat Compiler Settings

The flattened file should compile with these settings on PolygonScan:
- **Compiler**: 0.8.20
- **EVM Version**: paris (or default)
- **Optimization**: Enabled
- **Runs**: 200

## Verification Success

Once verified, you'll see:
- ✅ Green checkmark on contract page
- "Contract Source Code Verified" label
- Readable source code in "Contract" tab
- "Read Contract" and "Write Contract" tabs enabled

## Common Issues

### Issue: "Compiler version mismatch"
**Solution**: Ensure you select v0.8.20+commit.a1b79de6 exactly

### Issue: "Constructor argument error"
**Solution**: Double-check the ABI-encoded arguments match deployment parameters

### Issue: "Bytecode mismatch"
**Solution**: 
- Verify optimization is set to "Yes" with 200 runs
- Check that flattened code doesn't have duplicate SPDX/pragma
- Ensure no whitespace changes in the source

### Issue: "Already verified"
**Solution**: Contract is already verified - you're done!

## Helper Script for Constructor Arguments

Create `scripts/encode-constructor-args.js`:

```javascript
const hre = require("hardhat");

async function main() {
  // eRWF constructor (single address)
  const adminAddress = "0xYOUR_ADMIN_ADDRESS";
  const erwfArgs = hre.ethers.utils.defaultAbiCoder.encode(
    ["address"], 
    [adminAddress]
  );
  
  console.log("eRWF Constructor Args:");
  console.log(erwfArgs);
  
  // Escrow constructor (two addresses)
  const erwfAddress = "0xYOUR_ERWF_ADDRESS";
  const escrowArgs = hre.ethers.utils.defaultAbiCoder.encode(
    ["address", "address"], 
    [erwfAddress, adminAddress]
  );
  
  console.log("\nEscrow Constructor Args:");
  console.log(escrowArgs);
}

main();
```

Run:
```bash
node scripts/encode-constructor-args.js
```

## Verification Checklist

- [ ] eRWF token deployed
- [ ] Escrow contract deployed
- [ ] eRWF source code flattened
- [ ] Escrow source code flattened
- [ ] eRWF constructor args ABI-encoded
- [ ] Escrow constructor args ABI-encoded
- [ ] eRWF verified on PolygonScan
- [ ] Escrow verified on PolygonScan
- [ ] "Read Contract" tab works
- [ ] "Write Contract" tab works

## After Verification

Test the verified contract:
1. Go to contract page on PolygonScan
2. Click "Read Contract"
3. Try calling view functions (name, symbol, etc.)
4. Click "Write Contract"
5. Connect wallet to test write functions

---

**Need Help?** 
- PolygonScan Support: https://polygonscan.com/contactus
- Hardhat Docs: https://hardhat.org/hardhat-runner/docs/guides/verifying
