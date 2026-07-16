const hre = require("hardhat");
const { signAction } = require("../test/helpers/signatures");

async function main() {
  console.log("Testing Escrow Flow...\n");

  const [admin, operator, sender, driver, receiver, , relay] = await hre.ethers.getSigners();

  // Deploy contracts
  console.log("1. Deploying contracts...");
  const ERWF = await hre.ethers.getContractFactory("eRWF");
  const token = await ERWF.deploy(operator.address);
  await token.waitForDeployment();
  console.log("   eRWF deployed to:", await token.getAddress());

  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(await token.getAddress(), admin.address, relay.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  await (await token.grantRole(await token.ESCROW_ROLE(), escrowAddress)).wait();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log("   Escrow deployed to:", escrowAddress);

  // Mint tokens to receiver
  console.log("\n2. Minting tokens to receiver...");
  const amount = hre.ethers.parseEther("1000");
  await token.connect(operator).mint(receiver.address, amount);
  console.log(`   Minted ${hre.ethers.formatEther(amount)} eRWF to receiver`);

  // Create deal (relay pays gas; sender signs)
  console.log("\n3. Creating deal...");
  let nonce = await escrow.getNonce(sender.address);
  let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
  const tx1 = await escrow.connect(relay).createDeal(
    sender.address,
    driver.address,
    receiver.address,
    amount,
    signature
  );
  await tx1.wait();
  console.log("   Deal created with ID: 0");

  // Lock funds (signature only — Escrow pullFrom, no approve)
  console.log("\n4. Receiver locking funds...");
  nonce = await escrow.getNonce(receiver.address);
  signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
  const tx2 = await escrow.connect(relay).lockFunds(0, signature);
  await tx2.wait();
  console.log("   Funds locked");

  // Mark shipped
  console.log("\n5. Sender marking shipped...");
  nonce = await escrow.getNonce(sender.address);
  signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
  const tx3 = await escrow.connect(relay).markShipped(0, signature);
  await tx3.wait();
  console.log("   Marked as shipped");

  // Mark delivered
  console.log("\n6. Driver marking delivered...");
  nonce = await escrow.getNonce(driver.address);
  signature = await signAction(driver, escrowAddress, chainId, "markDelivered", 0, nonce);
  const tx4 = await escrow.connect(relay).markDelivered(0, signature);
  await tx4.wait();
  console.log("   Marked as delivered");

  // Get deal details
  const deal = await escrow.getDeal(0);
  console.log("\n7. Deal status:");
  console.log("   Status:", deal.status.toString(), "(3 = Delivered)");
  console.log("   Amount:", hre.ethers.formatEther(deal.amount), "eRWF");
  console.log("   Sender:", deal.sender);
  console.log("   Driver:", deal.driver);
  console.log("   Receiver:", deal.receiver);

  // Wait for dispute window
  console.log("\n8. Simulating 3-hour dispute window...");
  await hre.network.provider.send("evm_increaseTime", [3 * 60 * 60 + 1]);
  await hre.network.provider.send("evm_mine");
  console.log("   3 hours passed");

  // Release funds
  console.log("\n9. Releasing funds to sender...");
  const tx5 = await escrow.connect(sender).releaseFunds(0);
  await tx5.wait();
  console.log("   Funds released");

  // Check balances
  const senderBalance = await token.balanceOf(sender.address);
  console.log("\n10. Final balances:");
  console.log("   Sender:", hre.ethers.formatEther(senderBalance), "eRWF");
  console.log("   Escrow:", hre.ethers.formatEther(await token.balanceOf(escrowAddress)), "eRWF");

  console.log("\n✅ Happy path test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });
