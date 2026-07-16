const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { signAction } = require("./helpers/signatures");
const { deployEscrowSystem } = require("./helpers/deploy");

describe("Escrow - Fund Locking", function () {
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

    await token.connect(operator).mint(receiver.address, amount);
  });

  describe("Successful Lock", function () {
    it("Should lock funds within deadline", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      
      await expect(escrow.connect(relay).lockFunds(0, signature))
        .to.emit(escrow, "FundsLocked")
        .withArgs(0, receiver.address, amount, (value) => value > 0);

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(1); // Status.FundsLocked
      expect(await token.balanceOf(escrowAddress)).to.equal(amount);
      expect(await token.balanceOf(receiver.address)).to.equal(0);
    });

    it("Should allow locking exactly at deadline", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      const deal = await escrow.getDeal(0);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      // Set the lockFunds block timestamp to exactly the deadline
      await time.setNextBlockTimestamp(deal.fundLockDeadline);
      await expect(escrow.connect(relay).lockFunds(0, signature)).to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should reject lock from non-receiver", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      // Sender tries to lock (wrong role)
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "lockFunds", 0, nonce);
      
      await expect(
        escrow.connect(relay).lockFunds(0, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Status Checks", function () {
    it("Should reject lock if not in Created status", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);
      
      // Mint more tokens for second attempt
      await token.connect(operator).mint(receiver.address, amount);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      
      await expect(
        escrow.connect(relay).lockFunds(0, signature)
      ).to.be.revertedWith("Deal not in Created status");
    });
  });

  describe("Deadline Enforcement", function () {
    it("Should reject lock after deadline", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.fundLockDeadline + BigInt(1));
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      
      await expect(
        escrow.connect(relay).lockFunds(0, signature)
      ).to.be.revertedWith("Fund lock deadline passed");
    });
  });

  describe("Auto Cancel", function () {
    it("Should auto-cancel if funds not locked after deadline", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.fundLockDeadline + BigInt(1));
      
      await expect(escrow.connect(sender).autoCancelIfUnlocked(0))
        .to.emit(escrow, "DealAutoCancelled");

      const updatedDeal = await escrow.getDeal(0);
      expect(updatedDeal.status).to.equal(6); // Status.Cancelled
    });

    it("Should reject auto-cancel before deadline", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      await expect(
        escrow.connect(sender).autoCancelIfUnlocked(0)
      ).to.be.revertedWith("Deadline not passed yet");
    });

    it("Should reject auto-cancel if funds already locked", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);
      
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.fundLockDeadline + BigInt(1));
      
      await expect(
        escrow.connect(sender).autoCancelIfUnlocked(0)
      ).to.be.revertedWith("Deal not in Created status");
    });

    it("Should allow anyone to call auto-cancel (permissionless)", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      const deal = await escrow.getDeal(0);
      await time.increaseTo(deal.fundLockDeadline + BigInt(1));
      
      // Non-participant calls auto-cancel
      const [,,,,,, nonParticipant] = await ethers.getSigners();
      await expect(escrow.connect(nonParticipant).autoCancelIfUnlocked(0))
        .to.emit(escrow, "DealAutoCancelled");
    });
  });

  describe("Pre-Lock Cancellation", function () {
    it("Should allow sender to cancel before lock", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "cancelBeforeLock", 0, nonce);
      
      await expect(escrow.connect(relay).cancelBeforeLock(0, sender.address, signature))
        .to.emit(escrow, "DealCancelled");

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(6); // Status.Cancelled
    });

    it("Should allow receiver to cancel before lock", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "cancelBeforeLock", 0, nonce);
      
      await expect(escrow.connect(relay).cancelBeforeLock(0, receiver.address, signature))
        .to.emit(escrow, "DealCancelled");

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(6); // Status.Cancelled
    });

    it("Should reject cancel from non-parties", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      const [,,,,,, nonParticipant] = await ethers.getSigners();
      nonce = await escrow.getNonce(nonParticipant.address);
      signature = await signAction(nonParticipant, escrowAddress, chainId, "cancelBeforeLock", 0, nonce);
      
      await expect(
        escrow.connect(relay).cancelBeforeLock(0, nonParticipant.address, signature)
      ).to.be.revertedWith("Only sender or receiver can cancel");
    });

    it("Should reject cancel after funds locked", async function () {
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "cancelBeforeLock", 0, nonce);
      
      await expect(
        escrow.connect(relay).cancelBeforeLock(0, sender.address, signature)
      ).to.be.revertedWith("Deal not in Created status");
    });
  });
});
