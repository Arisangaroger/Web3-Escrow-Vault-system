const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function loadLatestDeployment(networkName) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    return null;
  }

  const latestPath = path.join(deploymentsDir, `${networkName}-latest.json`);
  if (fs.existsSync(latestPath)) {
    return {
      file: `${networkName}-latest.json`,
      deployment: JSON.parse(fs.readFileSync(latestPath, "utf8")),
    };
  }

  const files = fs
    .readdirSync(deploymentsDir)
    .filter((f) => f.startsWith(networkName) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  return {
    file: files[0],
    deployment: JSON.parse(fs.readFileSync(path.join(deploymentsDir, files[0]), "utf8")),
  };
}

async function main() {
  console.log("\nTesting Deployed Contracts...\n");

  const loaded = loadLatestDeployment(hre.network.name);
  if (!loaded) {
    console.log("No deployment found for network:", hre.network.name);
    console.log("Deploy first: npx hardhat run scripts/deploy.js --network", hre.network.name);
    return;
  }

  const { file, deployment } = loaded;
  console.log("Testing deployment:", file);
  console.log("Network:", deployment.network, "\n");

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const testUser = signers[1] || deployer;

  const tokenAddress = deployment.contracts.eRWF.address;
  const escrowAddress = deployment.contracts.Escrow.address;

  const token = await hre.ethers.getContractAt("eRWF", tokenAddress);
  const escrow = await hre.ethers.getContractAt("Escrow", escrowAddress);

  const tokenCode = await hre.ethers.provider.getCode(tokenAddress);
  const escrowCode = await hre.ethers.provider.getCode(escrowAddress);
  if (tokenCode === "0x" || escrowCode === "0x") {
    console.log("No contract bytecode at saved addresses.");
    if (hre.network.name === "hardhat") {
      console.log(
        "Hardhat in-process network resets between script runs — deploy and test in one process:"
      );
      console.log("  npx hardhat run scripts/smoke-local.js");
    } else {
      console.log("Re-deploy with: npx hardhat run scripts/deploy.js --network", hre.network.name);
    }
    process.exit(1);
  }

  console.log("Connected to contracts");
  console.log("   eRWF:", tokenAddress);
  console.log("   Escrow:", escrowAddress);

  console.log("\nToken Properties:");
  console.log("   Name:", await token.name());
  console.log("   Symbol:", await token.symbol());
  console.log("   Decimals:", await token.decimals());

  console.log("\nChecking Roles:");
  const OPERATOR_ROLE = await token.OPERATOR_ROLE();
  const ADMIN_ROLE = await escrow.ADMIN_ROLE();

  const hasOperatorRole = await token.hasRole(
    OPERATOR_ROLE,
    deployment.contracts.eRWF.operator
  );
  const hasAdminRole = await escrow.hasRole(
    ADMIN_ROLE,
    deployment.contracts.Escrow.admin
  );

  console.log("   Operator Role:", hasOperatorRole ? "Assigned" : "Missing");
  console.log("   Admin Role:", hasAdminRole ? "Assigned" : "Missing");

  console.log("\nTesting Token Mint:");
  try {
    if (deployment.contracts.eRWF.operator.toLowerCase() === deployer.address.toLowerCase()) {
      const amount = hre.ethers.parseEther("100");
      const tx = await token.mint(testUser.address, amount);
      await tx.wait();

      const balance = await token.balanceOf(testUser.address);
      console.log("   Minted", hre.ethers.formatEther(balance), "eRWF to test user");
    } else {
      console.log("   Skipped (deployer is not operator)");
    }
  } catch (error) {
    console.log("   Mint failed:", error.message);
  }

  console.log("\nEscrow State:");
  const nextDealId = await escrow.nextDealId();
  console.log("   Next Deal ID:", nextDealId.toString());
  console.log("   Token:", await escrow.token());
  console.log("   Fund Lock Window: 24 hours");
  console.log("   Dispute Window: 3 hours");

  console.log("\nDeployment Test Complete!");
  console.log("\nNext Steps:");
  console.log("   1. Verify contracts (run verify-contracts.js)");
  console.log("   2. Update backend configuration with these addresses");

  if (deployment.chainId === "80002") {
    console.log("\nView on Explorer:");
    console.log("   eRWF:", `https://amoy.polygonscan.com/address/${tokenAddress}`);
    console.log("   Escrow:", `https://amoy.polygonscan.com/address/${escrowAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nTest Failed:");
    console.error(error);
    process.exit(1);
  });
