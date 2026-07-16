const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { signAction } = require("./helpers/signatures");
const { deployEscrowSystem } = require("./helpers/deploy");

describe("Escrow - Dispute and Release", function () {
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

    // Create, lock, ship, and deliver deal
    await token.connect(operator).mint(receiver.address, amount);
    
    let nonce = await escrow.getNonce(sender.address);
    let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
    await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
    
    nonce = await escrow.getNonce(receiver.address);
    signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
    await escrow.connect(relay).lockFunds(0, signature);
    
    nonce = await escrow.getNonce(sender.address);
    signature = await signAction(sender, escrowAddress, chainId, "markShipped", 0, nonce);
    await escrow.connect(relay).markShipped(0, signature);
    
    nonce = await escrow.getNonce(driver.address);
    signature = await signAction(driver, escrowAddress, chainId, "markDelivered", 0, nonce);
    await escrow.connect(relay).markDelivered(0, signature);
  });

  describe("Happy Path - Auto Release", function () {
    it("Should release funds after dispute window expires", async function () {
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.payoutReadyTime);

      await expect(escrow.connect(sender).releaseFunds(0))
        .to.emit(escrow, "FundsReleased")
        .withArgs(0, sender.address, amount, (value) => value > 0);

      const updatedDeal = await escrow.getDeal(0);
      expect(updatedDeal.status).to.equal(5); // Status.Released
      expect(await token.balanceOf(sender.address)).to.equal(amount);
    });

    it("Should allow anyone to call releaseFunds (permissionless)", async function () {
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.payoutReadyTime);

      const [,,,,,, nonParticipant] = await ethers.getSigners();
      await expect(escrow.connect(nonParticipant).releaseFunds(0))
        .to.emit(escrow, "FundsReleased");
    });
  });

  describe("Ghosting Buyer Path", function () {
    it("Should release funds even if buyer does nothing", async function () {
      // Simulate buyer ghosting - do nothing, just wait
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.payoutReadyTime);

      // Keeper or anyone else triggers release
      await expect(escrow.releaseFunds(0))
        .to.emit(escrow, "FundsReleased");

      expect(await token.balanceOf(sender.address)).to.equal(amount);
    });
  });

  describe("Release Timing", function () {
    it("Should reject release before window expires", async function () {
      await expect(
        escrow.connect(sender).releaseFunds(0)
      ).to.be.revertedWith("Dispute window not expired");
    });

    it("Should allow release exactly at expiry time", async function () {
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.payoutReadyTime);

      await expect(escrow.releaseFunds(0)).to.not.be.reverted;
    });
  });

  describe("Revoke (Universal Escalation)", function () {
    it("Should allow sender to revoke at any post-lock stage", async function () {
      // Create new deal at FundsLocked stage
      await token.connect(operator).mint(receiver.address, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "revoke", 1, nonce);
      
      await expect(escrow.connect(relay).revoke(1, 1, sender.address, signature))
        .to.emit(escrow, "DealRevoked")
        .withArgs(1, sender.address, 1, (value) => value > 0);

      const deal = await escrow.getDeal(1);
      expect(deal.status).to.equal(4); // Status.Disputed
    });

    it("Should allow receiver to revoke at any post-lock stage", async function () {
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      
      await expect(escrow.connect(relay).revoke(0, 2, receiver.address, signature))
        .to.emit(escrow, "DealRevoked")
        .withArgs(0, receiver.address, 2, (value) => value > 0);
    });

    it("Should accept reason code", async function () {
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      await escrow.connect(relay).revoke(0, 5, receiver.address, signature);
      
      const deal = await escrow.getDeal(0);
      expect(deal.disputeReasonCode).to.equal(5);
      expect(deal.isDisputed).to.be.true;
    });

    it("Should allow revoke from Shipped status", async function () {
      // Create deal at Shipped stage
      await token.connect(operator).mint(receiver.address, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "markShipped", 1, nonce);
      await escrow.connect(relay).markShipped(1, signature);

      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "revoke", 1, nonce);
      
      await expect(escrow.connect(relay).revoke(1, 1, receiver.address, signature)).to.not.be.reverted;
    });

    it("Should allow revoke from Delivered status", async function () {
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      
      await expect(escrow.connect(relay).revoke(0, 1, receiver.address, signature)).to.not.be.reverted;
    });

    it("Should reject revoke from non-parties", async function () {
      const nonce = await escrow.getNonce(driver.address);
      const signature = await signAction(driver, escrowAddress, chainId, "revoke", 0, nonce);
      
      await expect(
        escrow.connect(relay).revoke(0, 1, driver.address, signature)
      ).to.be.revertedWith("Only sender or receiver can revoke");
    });

    it("Should reject revoke from invalid status", async function () {
      // Try to revoke from Created status
      await token.connect(operator).mint(receiver.address, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "revoke", 1, nonce);
      
      await expect(
        escrow.connect(relay).revoke(1, 1, sender.address, signature)
      ).to.be.revertedWith("Invalid status for revoke");
    });
  });

  describe("Dispute Freeze", function () {
    it("Should prevent release after revoke", async function () {
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      await escrow.connect(relay).revoke(0, 1, receiver.address, signature);
      
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.payoutReadyTime);

      await expect(
        escrow.releaseFunds(0)
      ).to.be.revertedWith("Deal not in Delivered status");
    });
  });

  describe("Early Fake Delivered Scenario", function () {
    it("Should allow receiver to dispute even if driver marked delivered early", async function () {
      // This test proves the triangular broadcast mitigation works
      // From contract perspective, delivered is delivered, but receiver can still dispute
      
      // Deal already marked delivered in beforeEach
      // Receiver sees the alert and disputes immediately
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      
      await expect(escrow.connect(relay).revoke(0, 1, receiver.address, signature))
        .to.emit(escrow, "DealRevoked");

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(4); // Disputed, frozen
    });
  });

  describe("Dispute Window Enforcement", function () {
    it("Should allow dispute within window", async function () {
      const deal = await escrow.getDeal(0);
      
      // Still within 3-hour window
      await time.increaseTo(deal.payoutReadyTime - BigInt(60));
      
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      
      await expect(escrow.connect(relay).revoke(0, 1, receiver.address, signature)).to.not.be.reverted;
    });

    it("Should reject release if revoked (even after window)", async function () {
      const nonce = await escrow.getNonce(receiver.address);
      const signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
      await escrow.connect(relay).revoke(0, 1, receiver.address, signature);
      
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.payoutReadyTime + BigInt(3600));

      await expect(
        escrow.releaseFunds(0)
      ).to.be.revertedWith("Deal not in Delivered status");
    });
  });

  describe("Release Status Check", function () {
    it("Should reject release if not in Delivered status", async function () {
      // Create new deal at Shipped stage
      await token.connect(operator).mint(receiver.address, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "markShipped", 1, nonce);
      await escrow.connect(relay).markShipped(1, signature);

      await expect(
        escrow.releaseFunds(1)
      ).to.be.revertedWith("Deal not in Delivered status");
    });
  });
});
