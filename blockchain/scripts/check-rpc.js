const hre = require('hardhat');
async function main() {
  const n = await hre.ethers.provider.getNetwork();
  console.log('RPC OK chainId=', n.chainId.toString(), 'block=', await hre.ethers.provider.getBlockNumber());
}
main().catch((e) => { console.error(e); process.exit(1); });
