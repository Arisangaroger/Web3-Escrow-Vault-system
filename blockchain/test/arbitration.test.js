const { expect } = require("chai");
const { ethers } = require("hardhat");
const { signAction } = require("./helpers/signatures");

describe("Escrow - Arbitration", function () {
  let token, escrow;
  let admin, operator, sender, driver, receiver, relay;
  let chainId, escrowAddress;
  let amount;

  beforeEach(async function () {
    [admin, operator, sender, driver, receiver, relay] = await ethers.getSigners();
    amount = ethers.parseEther("1000");

    // Deploy contracts
    const ERWF = await ethers.getContractFactory("eRWF");
    token = await ERWF.deploy(operator.address);
    await token.waitForDeployment();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(await token.getAddress(), admin.address);
    await escrow.waitForDeployment();
    
    escrowAddress = await escrow.getAddress();
    chainId = (await ethers.provider.getNetwork()).chainId;

    // Create disputed deal
    await token.connect(operator).mint(receiver.address, amount);
    await token.connect(receiver).approve(escrowAddress, amount);
    
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
    
    nonce = await escrow.getNonce(receiver.address);
    signature = await signAction(receiver, escrowAddress, chainId, "revoke", 0, nonce);
    await escrow.connect(relay).revoke(0, 1, receiver.address, signature);
  });

  describe("Access Control", function () {
    it("Should allow admin to resolve dispute", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, amount, 0)
      ).to.emit(escrow, "DisputeResolved");
    });

    it("Should reject resolution from non-admin", async function () {
      await expect(
        escrow.connect(sender).resolveDispute(0, amount, 0)
      ).to.be.reverted;
    });
  });

  describe("Status Check", function () {
    it("Should only resolve if in Disputed status", async function () {
      // Create non-disputed deal
      await token.connect(operator).mint(receiver.address, amount);
      await token.connect(receiver).approve(escrowAddress, amount);
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(receiver.address);
      signature = await signAction(receiver, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      await expect(
        escrow.connect(admin).resolveDispute(1, amount, 0)
      ).to.be.revertedWith("Deal not in Disputed status");
    });
  });

  describe("Resolution Outcomes", function () {
    it("Should handle full refund to buyer (Driver Fraud scenario)", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, 0, amount)
      )
        .to.emit(escrow, "DisputeResolved")
        .withArgs(0, admin.address, 0, amount, (value) => value > 0);

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(7); // Status.Resolved
      expect(await token.balanceOf(receiver.address)).to.equal(amount);
      expect(await token.balanceOf(sender.address)).to.equal(0);
    });

    it("Should handle full payout to seller (False Buyer Claim scenario)", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, amount, 0)
      )
        .to.emit(escrow, "DisputeResolved")
        .withArgs(0, admin.address, amount, 0, (value) => value > 0);

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(7); // Status.Resolved
      expect(await token.balanceOf(sender.address)).to.equal(amount);
      expect(await token.balanceOf(receiver.address)).to.equal(0);
    });

    it("Should handle partial split", async function () {
      const toSender = ethers.parseEther("600");
      const toReceiver = ethers.parseEther("400");

      await escrow.connect(admin).resolveDispute(0, toSender, toReceiver);

      expect(await token.balanceOf(sender.address)).to.equal(toSender);
      expect(await token.balanceOf(receiver.address)).to.equal(toReceiver);
    });

    it("Should handle 50/50 split", async function () {
      const half = amount / BigInt(2);

      await escrow.connect(admin).resolveDispute(0, half, half);

      expect(await token.balanceOf(sender.address)).to.equal(half);
      expect(await token.balanceOf(receiver.address)).to.equal(half);
    });
  });

  describe("Amount Validation", function () {
    it("Should reject if amounts don't sum to deal amount", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, ethers.parseEther("600"), ethers.parseEther("600"))
      ).to.be.revertedWith("Amounts must sum to deal amount");
    });

    it("Should reject if total is less than deal amount", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, ethers.parseEther("400"), ethers.parseEther("400"))
      ).to.be.revertedWith("Amounts must sum to deal amount");
    });

    it("Should reject if both amounts are zero", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, 0, 0)
      ).to.be.revertedWith("Amounts must sum to deal amount");
    });

    it("Should accept sender getting zero (full refund)", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, 0, amount)
      ).to.not.be.reverted;
    });

    it("Should accept receiver getting zero (full payout)", async function () {
      await expect(
        escrow.connect(admin).resolveDispute(0, amount, 0)
      ).to.not.be.reverted;
    });
  });

  describe("Resolution Finality", function () {
    it("Should update deal status to Resolved", async function () {
      await escrow.connect(admin).resolveDispute(0, amount, 0);

      const deal = await escrow.getDeal(0);
      expect(deal.status).to.equal(7); // Status.Resolved
    });

    it("Should reject second resolution attempt", async function () {
      await escrow.connect(admin).resolveDispute(0, amount, 0);

      await expect(
        escrow.connect(admin).resolveDispute(0, 0, amount)
      ).to.be.revertedWith("Deal not in Disputed status");
    });
  });

  describe("Event Emission", function () {
    it("Should emit DisputeResolved with correct parameters", async function () {
      const toSender = ethers.parseEther("700");
      const toReceiver = ethers.parseEther("300");

      await expect(
        escrow.connect(admin).resolveDispute(0, toSender, toReceiver)
      )
        .to.emit(escrow, "DisputeResolved")
        .withArgs(0, admin.address, toSender, toReceiver, (value) => value > 0);
    });
  });
});
