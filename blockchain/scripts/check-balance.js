const hre = require("hardhat");

async function main() {
  console.log("\nChecking Deployer Balance...\n");

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Network:", hre.network.name);
  console.log("Deployer Address:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance));

  const minBalance = hre.ethers.parseEther("0.1");

  if (balance < minBalance) {
    console.log("\nWARNING: Balance is low!");
    console.log("Recommended minimum: 0.1 native tokens");
    if (hre.network.name === "amoy") {
      console.log("\nGet test MATIC from:");
      console.log("- https://faucet.polygon.technology/");
      console.log("- https://www.alchemy.com/faucets/polygon-amoy");
    }
  } else {
    console.log("\nBalance sufficient for deployment");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
