# Deployment Guide - Polygon Amoy Testnet

This guide walks through deploying the Escrow smart contracts to Polygon Amoy testnet.

## Prerequisites

### 1. Get Test MATIC from Faucet

You need Amoy testnet MATIC to pay for gas fees.

**Polygon Faucet**: https://faucet.polygon.technology/
- Select "Polygon Amoy"
- Connect your wallet or paste your address
- Request test MATIC (you'll receive ~0.5 MATIC)

**Alternative Faucets**:
- https://www.alchemy.com/faucets/polygon-amoy
- https://faucets.chain.link/polygon-amoy

### 2. Get PolygonScan API Key (Optional but Recommended)

For contract verification on PolygonScan:

1. Go to https://polygonscan.com/
2. Sign up/Login
3. Go to API Keys section
4. Create a new API key
5. Copy the key

### 3. Setup Environment Variables

Create `.env` file in the `blockchain/` folder:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` and add:

```env
# Your deployer wallet private key (NEVER COMMIT THIS!)
PRIVATE_KEY=your_private_key_here

# Polygon Amoy RPC (default is fine, or use your own from Alchemy/Infura)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Optional: For contract verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
```

⚠️ **SECURITY WARNING**: 
- NEVER commit your `.env` file
- NEVER share your private key
- Use a separate wallet for testnet deployments

## Deployment Steps

### Step 1: Verify Configuration

```bash
cd blockchain

# Check your deployer balance
npx hardhat run scripts/check-balance.js --network amoy
```

### Step 2: Deploy Contracts

```bash
npx hardhat run scripts/deploy.js --network amoy
```

Expected output:
```
Starting deployment...

Deploying contracts with account: 0x...
Account balance: 0.5 ETH

Admin address: 0x...
Operator address: 0x...

Deploying eRWF token...
eRWF token deployed to: 0x...

Deploying Escrow contract...
Escrow contract deployed to: 0x...

Setting up roles...
✓ OPERATOR_ROLE granted
✓ ESCROW_ROLE granted to Escrow contract

✅ Deployment complete!

Deployment Summary:
==================
Network: amoy
eRWF Token: 0x...
Escrow Contract: 0x...

Deployment info saved to: deployments/amoy-[timestamp].json
```

### Step 3: Verify Contracts on PolygonScan

After deployment, verify the source code.

**Manual Verification** (Recommended - see [MANUAL_VERIFICATION.md](./MANUAL_VERIFICATION.md)):

1. Get flattened contract:
```bash
npx hardhat flatten contracts/eRWF.sol > eRWF-flat.sol
npx hardhat flatten contracts/Escrow.sol > Escrow-flat.sol
```

2. Go to PolygonScan and manually verify:
   - Visit: https://amoy.polygonscan.com/
   - Navigate to each contract address
   - Click "Verify and Publish"
   - Upload flattened source code
   - Set compiler to v0.8.20 with optimization enabled (200 runs)
   - Add constructor arguments (ABI-encoded)

Full guide: [MANUAL_VERIFICATION.md](./MANUAL_VERIFICATION.md)

### Step 4: Test Deployment

Run a test transaction to verify everything works:

```bash
npx hardhat run scripts/test-deployment.js --network amoy
```

## Post-Deployment Checklist

- [ ] eRWF token deployed and verified
- [ ] Escrow contract deployed and verified
- [ ] Roles properly assigned (check on PolygonScan)
- [ ] Deployment addresses saved to `deployments/` folder
- [ ] Test transaction successful
- [ ] Addresses added to backend `.env` configuration

## Contract Addresses on Amoy

*Update after deployment:*

| Contract | Address | Explorer Link |
|----------|---------|---------------|
| eRWF Token | `0x...` | [View](https://amoy.polygonscan.com/address/0x...) |
| Escrow | `0x...` | [View](https://amoy.polygonscan.com/address/0x...) |

## Useful Commands

### Check Network Connection
```bash
npx hardhat run scripts/check-network.js --network amoy
```

### Check Contract Status
```bash
npx hardhat run scripts/check-contract.js --network amoy
```

### Mint Test Tokens
```bash
npx hardhat run scripts/mint-tokens.js --network amoy
```

## Network Information

| Parameter | Value |
|-----------|-------|
| Network Name | Polygon Amoy Testnet |
| Chain ID | 80002 |
| Currency Symbol | MATIC |
| Block Explorer | https://amoy.polygonscan.com/ |
| RPC URL | https://rpc-amoy.polygon.technology |

## Troubleshooting

### Issue: "insufficient funds for intrinsic transaction cost"

**Solution**: Get more test MATIC from faucet

### Issue: "nonce has already been used"

**Solution**: 
```bash
# Reset your account nonce
npx hardhat clean
rm -rf artifacts cache
```

### Issue: Contract verification fails

**Solution**: 
1. Check API key is correct
2. Wait 1-2 minutes after deployment
3. Try manual verification on PolygonScan using Hardhat output artifacts

### Issue: "replacement fee too low"

**Solution**: Increase gas price in hardhat.config.js:
```javascript
amoy: {
  // ... other config
  gasPrice: 10000000000, // Increase from 8 to 10 gwei
}
```

## Next Steps

After successful deployment:

1. **Update Backend Configuration**
   - Add contract addresses to backend `.env`
   - Configure backend to use Amoy network

2. **Test Integration**
   - Test backend can interact with contracts
   - Verify event listening works
   - Test deal creation flow

3. **Admin Portal Setup**
   - Configure admin portal with contract addresses
   - Test dispute resolution functionality

## Security Notes for Production

When deploying to mainnet:

1. Use a hardware wallet or secure key management solution
2. Implement multi-sig for admin operations
3. Consider using a proxy pattern for upgradability
4. Conduct professional security audit
5. Implement pausability for emergency stops
6. Set up monitoring and alerting

## Resources

- [Polygon Amoy Documentation](https://docs.polygon.technology/tools/faucets/)
- [Hardhat Deployment Guide](https://hardhat.org/hardhat-runner/docs/guides/deploying)
- [PolygonScan API Documentation](https://docs.polygonscan.com/)
- [Project Concept Note](../concept_note.md)
- [Smart Contracts Documentation](./CONTRACTS.md)

---

**Last Updated**: July 11, 2026  
**Network**: Polygon Amoy Testnet  
**Status**: Ready for Deployment
