# Contract ABIs

Copy compiled artifacts from the blockchain project after `npx hardhat compile`:

```bash
# From backend directory
mkdir -p src/modules/contracts/abis
cp ../blockchain/artifacts/contracts/Escrow.sol/Escrow.json src/modules/contracts/abis/
cp ../blockchain/artifacts/contracts/eRWF.sol/eRWF.json src/modules/contracts/abis/
```

Or use: `npm run sync:abis`

These JSON files must stay in sync with the deployed Escrow/eRWF bytecode (especially after meta-tx signature/API changes).
