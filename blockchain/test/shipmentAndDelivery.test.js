const { expect } = require("chai");
const { ethers } = require("hardhat");
const { signAction } = require("./helpers/signatures");
const { deployEscrowSystem } = require("./helpers/deploy");

describe("Escrow - Shipment and Delivery", function () {
  let token, escrow;
  let admin, operator, sender, driver, receiver, relay;
  let chainId, escrowAddress;
  const amount = ethers.parseEther("1000");

  beforeEach(async function () {
    [admin, operator, sender, driver, receiver, relay] = await ethers.getSigners();

    ({ token, escrow, escrowAddress, chainId } = await deployEscrowSystem({
      admin,
      operator,
      relay,
    }));

    // Create and lock deal
    await token.connect(operator).mint(receiver.address, amount);
    
    let nonce = await escrow.getNonce(sender.address);
    let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
    await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
    
    nonce = await escrow.getNonce(receiver.address);
    signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
    await escrow.connect(relay).lockFunds(0, signature);
  });

  describe("Mark Shipped", function () {
    it("Should allow sender to mark shipped", async function () {
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
      
      await expect(escrow.connect(relay).markShipped(0, signature))
        .to.emit(escrow, "MarkedShipped")
        .withArgs(0, sender.address, (value) => value > 0);

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(2); // Status.Shipped
    });

    it("Should reject mark shipped from non-sender", async function () {
      const nonce = await escrow.getNonce(driver.address);
      const signature = await signAction(driver, escrowAddress, chainId, "markShipped", 0, nonce);
      
      await expect(
        escrow.connect(relay).markShipped(0, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject mark shipped if not in FundsLocked status", async function () {
      // Create a new deal but don't lock funds
      await token.connect(operator).mint(receiver.address, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "markShipped", 1, nonce);
      
      await expect(
        escrow.connect(relay).markShipped(1, signature)
      ).to.be.revertedWith("Funds must be locked first");
    });

    it("Should reject marking shipped twice", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
      await escrow.connect(relay).markShipped(0, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
      
      await expect(
        escrow.connect(relay).markShipped(0, signature)
      ).to.be.revertedWith("Funds must be locked first");
    });
  });

  describe("Mark Delivered", function () {
    beforeEach(async function () {
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
      await escrow.connect(relay).markShipped(0, signature);
    });

    it("Should allow driver to mark delivered", async function () {
      const nonce = await escrow.getNonce(driver.address);
      const signature = await signAction(driver, escrowAddress, chainId, "markDelivered", 0, nonce);
      
      const tx = await escrow.connect(relay).markDelivered(0, signature);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedPayoutTime = BigInt(block.timestamp) + BigInt(3 * 60 * 60);

      await expect(tx)
        .to.emit(escrow, "MarkedDelivered")
        .withArgs(0, driver.address, block.timestamp, expectedPayoutTime);

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(3); // Status.Delivered
      expect(deal.payoutReadyTime).to.equal(expectedPayoutTime);
    });

    it("Should reject mark delivered from non-driver", async function () {
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "markDelivered", 0, nonce);
      
      await expect(
        escrow.connect(relay).markDelivered(0, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject mark delivered if not in Shipped status", async function () {
      // Create new deal, lock but don't ship
      await token.connect(operator).mint(receiver.address, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);
      
      nonce = await escrow.getNonce(driver.address);
      signature = await signAction(driver, escrowAddress, chainId, "markDelivered", 1, nonce);
      
      await expect(
        escrow.connect(relay).markDelivered(1, signature)
      ).to.be.revertedWith("Goods must be shipped first");
    });

    it("Should set correct 3-hour timer", async function () {
      const nonce = await escrow.getNonce(driver.address);
      const signature = await signAction(driver, escrowAddress, chainId, "markDelivered", 0, nonce);
      
      const tx = await escrow.connect(relay).markDelivered(0, signature);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      const deal = await escrow.getDeal(0);
      const expectedTime = BigInt(block.timestamp) + BigInt(3 * 60 * 60);
      expect(deal.payoutReadyTime).to.equal(expectedTime);
    });
  });

  describe("Workflow Integration", function () {
    it("Should follow happy path: Created -> FundsLocked -> Shipped -> Delivered", async function () {
      let deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(1); // FundsLocked (from beforeEach)

      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
      await escrow.connect(relay).markShipped(0, signature);
      
      deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(2); // Shipped

      nonce = await escrow.getNonce(driver.address);
      signature = await signAction(driver, escrowAddress, chainId, "markDelivered", 0, nonce);
      await escrow.connect(relay).markDelivered(0, signature);
      
      deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(3); // Delivered
    });
  });
});
