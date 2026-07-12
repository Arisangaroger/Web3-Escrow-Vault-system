const hre = require("hardhat");

async function main() {
  console.log("\nNetwork Information\n");

  const network = await hre.ethers.provider.getNetwork();
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const feeData = await hre.ethers.provider.getFeeData();

  console.log("Network Name:", hre.network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Current Block:", blockNumber);

  if (feeData.gasPrice != null) {
    console.log("Gas Price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");
  }

  const chainId = Number(network.chainId);
  if (chainId === 80002) {
    console.log("\nConnected to Polygon Amoy Testnet");
    console.log("Block Explorer: https://amoy.polygonscan.com/");
  } else if (chainId === 1337 || chainId === 31337) {
    console.log("\nConnected to Local Hardhat Network");
  } else if (chainId === 43113) {
    console.log("\nConnected to Avalanche Fuji Testnet");
  } else if (chainId === 11155111) {
    console.log("\nConnected to Ethereum Sepolia Testnet");
  } else {
    console.log("\nUnexpected network");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
