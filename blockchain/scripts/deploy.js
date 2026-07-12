const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "\n"
  );

  // Operator mints/burns eRWF; admin controls Escrow arbitration
  const operatorAddress = process.env.OPERATOR_ADDRESS || deployer.address;
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;

  console.log("Operator address:", operatorAddress);
  console.log("Admin address:", adminAddress);
  console.log();

  // Deploy eRWF Token (operator gets OPERATOR_ROLE + DEFAULT_ADMIN_ROLE)
  console.log("Deploying eRWF token...");
  const ERWF = await hre.ethers.getContractFactory("eRWF");
  const token = await ERWF.deploy(operatorAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("eRWF token deployed to:", tokenAddress);
  console.log();

  // Deploy Escrow Contract
  console.log("Deploying Escrow contract...");
  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(tokenAddress, adminAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow contract deployed to:", escrowAddress);
  console.log();

  console.log("Deployment complete!\n");

  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      eRWF: {
        address: tokenAddress,
        // Constructor arg is operator (also receives DEFAULT_ADMIN_ROLE)
        operator: operatorAddress,
        admin: operatorAddress,
      },
      Escrow: {
        address: escrowAddress,
        admin: adminAddress,
        token: tokenAddress,
      },
    },
    roles: {
      OPERATOR_ROLE: await token.OPERATOR_ROLE(),
      ADMIN_ROLE: await escrow.ADMIN_ROLE(),
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Always overwrite a stable "latest" pointer for this network
  const latestPath = path.join(deploymentsDir, `${hre.network.name}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  const filename = `${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("Deployment Summary:");
  console.log("==================");
  console.log("Network:", hre.network.name);
  console.log("eRWF Token:", tokenAddress);
  console.log("Escrow Contract:", escrowAddress);
  console.log("\nDeployment info saved to:");
  console.log(" -", filepath);
  console.log(" -", latestPath);
  console.log("\nNext steps:");
  console.log("1. npx hardhat run scripts/verify-contracts.js --network", hre.network.name);
  console.log("2. npx hardhat run scripts/test-deployment.js --network", hre.network.name);
  console.log("3. Update backend configuration with contract addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
