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
  console.log("\nContract Verification Helper\n");

  const loaded = loadLatestDeployment(hre.network.name);
  if (!loaded) {
    console.log("No deployments found for network:", hre.network.name);
    console.log("Deploy contracts first.");
    return;
  }

  const { file, deployment } = loaded;
  const tokenAddress = deployment.contracts.eRWF.address;
  const escrowAddress = deployment.contracts.Escrow.address;
  const operatorAddress = deployment.contracts.eRWF.operator;
  const adminAddress = deployment.contracts.Escrow.admin;

  console.log("Latest Deployment:", file);
  console.log("Network:", deployment.network);
  console.log("\nContract Addresses:");
  console.log("===================");
  console.log("eRWF Token:", tokenAddress);
  console.log("Escrow Contract:", escrowAddress);
  console.log("eRWF Operator:", operatorAddress);
  console.log("Escrow Admin:", adminAddress);

  console.log("\nVerification Commands:");
  console.log("========================\n");

  // eRWF constructor(address operator)
  console.log("# Verify eRWF Token:");
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${tokenAddress} ${operatorAddress}`
  );

  // Escrow constructor(address _token, address admin)
  console.log("\n# Verify Escrow Contract:");
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${escrowAddress} ${tokenAddress} ${adminAddress}`
  );

  console.log("\nTip: Copy and run these commands to verify on the block explorer.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
