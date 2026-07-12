/**
 * Local smoke test: deploy + verify in a single Hardhat process
 * (required because the ephemeral hardhat network resets between script runs).
 */
const hre = require("hardhat");

async function main() {
  console.log("Local smoke test (deploy + checks in one process)\n");

  const [deployer, testUser] = await hre.ethers.getSigners();
  const operatorAddress = process.env.OPERATOR_ADDRESS || deployer.address;
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;

  const ERWF = await hre.ethers.getContractFactory("eRWF");
  const token = await ERWF.deploy(operatorAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(tokenAddress, adminAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log("eRWF:", tokenAddress);
  console.log("Escrow:", escrowAddress);

  console.log("\nToken:", await token.name(), await token.symbol());
  console.log("Decimals:", await token.decimals());

  const OPERATOR_ROLE = await token.OPERATOR_ROLE();
  const ADMIN_ROLE = await escrow.ADMIN_ROLE();
  console.log("Operator role:", await token.hasRole(OPERATOR_ROLE, operatorAddress));
  console.log("Escrow admin role:", await escrow.hasRole(ADMIN_ROLE, adminAddress));

  const amount = hre.ethers.parseEther("100");
  await (await token.mint(testUser.address, amount)).wait();
  console.log(
    "Minted to test user:",
    hre.ethers.formatEther(await token.balanceOf(testUser.address)),
    "eRWF"
  );

  console.log("Next deal id:", (await escrow.nextDealId()).toString());
  console.log("\nLocal smoke test passed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
