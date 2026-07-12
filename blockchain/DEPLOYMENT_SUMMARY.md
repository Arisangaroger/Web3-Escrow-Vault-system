# Deployment Summary - Polygon Amoy Testnet

## 🎯 Deployment Status

**Target Network**: Polygon Amoy Testnet  
**Status**: ✅ Ready for Deployment  
**Chain ID**: 80002  
**Block Explorer**: https://amoy.polygonscan.com/

## 📦 Contracts to Deploy

1. **eRWF Token** (`contracts/eRWF.sol`)
   - Simulated Rwanda Franc (eRWF)
   - ERC-20 with restricted transfers
   - Minting controlled by OPERATOR_ROLE

2. **Escrow Contract** (`contracts/Escrow.sol`)
   - Deal lifecycle management
   - Role-based access control
   - Time-enforced actions (24h fund lock, 3h dispute window)

## 🚀 Quick Deployment Commands

```bash
# 1. Setup environment
cd blockchain
npm install
cp .env.example .env
# Edit .env and add your PRIVATE_KEY

# 2. Check balance (need ~0.1 MATIC)
npx hardhat run scripts/check-balance.js --network amoy

# 3. Check network connection
npx hardhat run scripts/check-network.js --network amoy

# 4. Deploy contracts
npx hardhat run scripts/deploy.js --network amoy

# 5. Test deployment
npx hardhat run scripts/test-deployment.js --network amoy

# 6. Flatten for verification
npx hardhat flatten contracts/eRWF.sol > eRWF-flat.sol
npx hardhat flatten contracts/Escrow.sol > Escrow-flat.sol

# 7. Manually verify on PolygonScan (see MANUAL_VERIFICATION.md)
```

## 💰 Gas Cost Estimates

Based on Polygon Amoy testnet gas prices (~30-40 gwei):

| Operation | Estimated Cost |
|-----------|----------------|
| Deploy eRWF | ~0.005 MATIC |
| Deploy Escrow | ~0.015 MATIC |
| Setup Roles | ~0.002 MATIC |
| **Total** | **~0.025 MATIC** |

**Recommended**: Have at least **0.1 MATIC** in deployer wallet for safety margin.

## 🔑 Required Information

Before deployment, prepare:

1. **Deployer Wallet**
   - Private key
   - Sufficient MATIC balance (≥0.1 MATIC)
   - Get test MATIC from: https://faucet.polygon.technology/

2. **Admin Address** (optional, defaults to deployer)
   - Address that will have ADMIN_ROLE on Escrow
   - Address that will have DEFAULT_ADMIN_ROLE on eRWF

3. **Operator Address** (optional, defaults to deployer)
   - Address that will have OPERATOR_ROLE on eRWF
   - Backend relay wallet address

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] `npm install` completed
- [ ] `.env` file configured with PRIVATE_KEY
- [ ] Test MATIC acquired from faucet
- [ ] Balance checked (≥0.1 MATIC)
- [ ] Network connection verified
- [ ] All tests passing (`npx hardhat test`)

### Deployment
- [ ] Contracts compiled successfully
- [ ] Deployment script executed
- [ ] Contract addresses saved
- [ ] Deployment info saved to `deployments/` folder
- [ ] Test deployment script executed successfully

### Post-Deployment
- [ ] Contracts flattened for verification
- [ ] eRWF verified on PolygonScan
- [ ] Escrow verified on PolygonScan
- [ ] Roles verified on explorer
- [ ] Contract addresses documented
- [ ] Backend configuration updated

### Integration Testing
- [ ] Backend can connect to contracts
- [ ] Event listening works
- [ ] Token minting works
- [ ] Deal creation works
- [ ] Complete flow tested

## 📋 Deployment Output Example

After running deploy script, you'll see:

```
Starting deployment...

Deploying contracts with account: 0xF3C7...B892
Account balance: 0.5 ETH

Admin address: 0xF3C7...B892
Operator address: 0xF3C7...B892

Deploying eRWF token...
eRWF token deployed to: 0x5FbDB...180aa3

Deploying Escrow contract...
Escrow contract deployed to: 0xe7f17...b3F0512

Setting up roles...
✓ OPERATOR_ROLE granted
✓ ESCROW_ROLE granted to Escrow contract

✅ Deployment complete!

Deployment Summary:
==================
Network: amoy
eRWF Token: 0x5FbDB...180aa3
Escrow Contract: 0xe7f17...b3F0512

Deployment info saved to: deployments/amoy-1720703456789.json
```

## 🔗 Important Links

### Network Resources
- **Faucet**: https://faucet.polygon.technology/
- **RPC**: https://rpc-amoy.polygon.technology
- **Explorer**: https://amoy.polygonscan.com/
- **Chainlist**: https://chainlist.org/?search=amoy

### Documentation
- [Quick Deploy Guide](./QUICK_DEPLOY.md) - 5-minute setup
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Complete documentation
- [Manual Verification](./MANUAL_VERIFICATION.md) - Contract verification
- [Contracts Documentation](./CONTRACTS.md) - Technical reference

## 🔐 Security Notes

### For Testnet
- Use separate wallet for testnet deployments
- Don't use production private keys
- Test MATIC has no real value

### For Production (Future)
- Use hardware wallet or secure key management
- Implement multi-sig for admin operations
- Professional security audit required
- Set up monitoring and alerting
- Consider proxy pattern for upgradability

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ Both contracts deployed to Amoy
2. ✅ Contracts verified on PolygonScan
3. ✅ All roles properly assigned
4. ✅ Test transactions work
5. ✅ Backend can interact with contracts
6. ✅ Events are being emitted correctly

## 📊 Contract Configuration

### eRWF Token
- **Name**: Simulated Rwanda Franc
- **Symbol**: eRWF
- **Decimals**: 18
- **Roles**: OPERATOR_ROLE, ESCROW_ROLE, DEFAULT_ADMIN_ROLE

### Escrow Contract
- **Fund Lock Window**: 24 hours
- **Dispute Window**: 3 hours
- **Roles**: ADMIN_ROLE, DEFAULT_ADMIN_ROLE
- **Functions**: Permissionless keepers enabled

## 🐛 Troubleshooting

### Common Issues

**"insufficient funds"**
```bash
# Get more test MATIC
# Visit: https://faucet.polygon.technology/
```

**"nonce too low/high"**
```bash
# Wait a minute and retry, or reset Hardhat
npx hardhat clean
```

**"network connection failed"**
```bash
# Check RPC URL in .env
# Try alternative RPC: https://polygon-amoy.drpc.org
```

**"contract not verified"**
```bash
# Follow manual verification guide
# See: MANUAL_VERIFICATION.md
```

## 📞 Support

### Technical Issues
- Check troubleshooting section in DEPLOYMENT_GUIDE.md
- Review CONTRACTS.md for technical details
- Run tests locally to verify code: `npx hardhat test`

### Network Issues
- Polygon Discord: https://discord.gg/polygon
- Polygon Faucet Support: Use the support chat on faucet page

## 🎓 Next Steps After Deployment

1. **Document Addresses**
   - Save contract addresses securely
   - Update project documentation
   - Share with team members

2. **Update Backend**
   - Add contract addresses to backend `.env`
   - Configure event listeners
   - Test integration

3. **Setup Admin Portal**
   - Configure admin portal with addresses
   - Test dispute resolution interface
   - Verify audit trail display

4. **Integration Testing**
   - Test complete deal flow
   - Verify triangular broadcasts
   - Test dispute scenarios

5. **Monitoring Setup**
   - Set up transaction monitoring
   - Configure error alerting
   - Track contract interactions

---

**Last Updated**: July 11, 2026  
**Network**: Polygon Amoy Testnet  
**Chain ID**: 80002  
**Status**: ✅ Ready for Deployment
