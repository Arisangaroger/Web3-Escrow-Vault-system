# Smart Contract Implementation Status

## COMPLETED

### Contracts
- **eRWF.sol** - ERC-20 with role-based minting/burning
- **Escrow.sol** - Full deal lifecycle with EIP-712 meta-transactions

### Features
- Deal creation (sender, driver, receiver)
- 24-hour fund lock window
- Shipment and delivery tracking
- 3-hour dispute window + revoke escalation
- Admin arbitration
- Permissionless auto-cancel and release
- Signature verification via `_verifySigner(account, ...)`
- Per-user nonce replay protection (not relay/`tx.origin`)

### Tests
- All Hardhat tests passing (`npx hardhat test`)

### Deployment tooling
- `scripts/deploy.js` - deploys eRWF + Escrow, writes `deployments/<network>-latest.json`
- `scripts/test-deployment.js` - smoke-tests a deployed pair
- `scripts/verify-contracts.js` - prints explorer verify commands
- `scripts/check-balance.js` / `scripts/check-network.js`
- Hardhat networks: `amoy`, `fuji`, `sepolia`
- Contract verification config for Amoy (PolygonScan)

## Deploy (Polygon Amoy)

```bash
cd blockchain
cp .env.example .env
# set PRIVATE_KEY (and optional OPERATOR_ADDRESS / ADMIN_ADDRESS / POLYGONSCAN_API_KEY)
npm install
npm run check:balance
npm run deploy:amoy
npm run verify:help
npm run test:deployment
```

## Local dry-run

```bash
npm run smoke:local
# or deploy only:
npm run deploy:local
```

Note: Hardhat's in-process network resets between script runs, so use `smoke:local`
(or deploy+test on Amoy) rather than separate local deploy then test-deployment.
