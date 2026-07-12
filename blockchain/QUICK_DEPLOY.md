# Quick Deploy to Polygon Amoy

**5-Minute Deployment Guide**

## Prerequisites

- [ ] Node.js and npm installed
- [ ] Test MATIC in your wallet (get from https://faucet.polygon.technology/)
- [ ] Private key ready

## Step 1: Setup (First time only)

```bash
cd blockchain
npm install
cp .env.example .env
```

Edit `.env`:
```env
PRIVATE_KEY=your_wallet_private_key_here
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

## Step 2: Check Balance

```bash
npx hardhat run scripts/check-balance.js --network amoy
```

Need MATIC? Get it from: https://faucet.polygon.technology/

## Step 3: Deploy

```bash
npx hardhat run scripts/deploy.js --network amoy
```

Save the contract addresses from output! ✍️

## Step 4: Verify Contracts

```bash
# Get verification commands
npx hardhat run scripts/verify-contracts.js --network amoy

# Then copy and run the commands it shows
```

## Step 5: Test Deployment

```bash
npx hardhat run scripts/test-deployment.js --network amoy
```

## Done! 🎉

Your contracts are deployed to Polygon Amoy testnet.

**Next**: Update your backend configuration with the contract addresses.

---

## Troubleshooting

**"insufficient funds"** → Get more MATIC from faucet  
**"nonce already used"** → Wait a minute and try again  
**Verification fails** → Wait 1-2 minutes after deploy, then retry

## Contract Addresses

After deployment, your addresses will be saved in:
`blockchain/deployments/amoy-[timestamp].json`

---

## Quick Commands Reference

```bash
# Check network connection
npx hardhat run scripts/check-network.js --network amoy

# Check balance
npx hardhat run scripts/check-balance.js --network amoy

# Deploy
npx hardhat run scripts/deploy.js --network amoy

# Get verification commands
npx hardhat run scripts/verify-contracts.js --network amoy

# Test deployment
npx hardhat run scripts/test-deployment.js --network amoy

# Run tests
npx hardhat test
```

---

**Full Guide**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
