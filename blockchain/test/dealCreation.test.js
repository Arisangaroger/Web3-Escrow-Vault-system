const { expect } = require("chai");
const { ethers } = require("hardhat");
const { signAction } = require("./helpers/signatures");
const { deployEscrowSystem } = require("./helpers/deploy");

describe("Escrow - Deal Creation", function () {
  let token, escrow;
  let admin, operator, sender, driver, receiver, other, relay;
  let chainId, escrowAddress;

  beforeEach(async function () {
    [admin, operator, sender, driver, receiver, other, relay] = await ethers.getSigners();

    ({ token, escrow, escrowAddress, chainId } = await deployEscrowSystem({
      admin,
      operator,
      relay,
    }));
  });

  describe("Successful Creation", function () {
    it("Should create deal with valid inputs", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature)
      ).to.emit(escrow, "DealCreated");

      const deal = await escrow.getDeal(0);
      expect(deal.sender).to.equal(sender.address);
      expect(deal.driver).to.equal(driver.address);
      expect(deal.receiver).to.equal(receiver.address);
      expect(deal.amount).to.equal(amount);
      expect(deal.status).to.equal(0); // Status.Created
    });

    it("Should increment deal IDs", async function () {
      const amount = ethers.parseEther("1000");
      
      let nonce = await escrow.getNonce(sender.address);
      let signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      nonce = await escrow.getNonce(sender.address);
      signature = await signAction(sender, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(sender.address, driver.address, other.address, amount, signature);

      expect(await escrow.nextDealId()).to.equal(2);
    });

    it("Should set correct timestamps", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      const tx = await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const deal = await escrow.getDeal(0);
      expect(deal.createdAt).to.equal(block.timestamp);
      expect(deal.fundLockDeadline).to.equal(BigInt(block.timestamp) + BigInt(24 * 60 * 60));
    });
  });

  describe("Validation", function () {
    it("Should reject zero driver address", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, ethers.ZeroAddress, receiver.address, amount, signature)
      ).to.be.revertedWith("Invalid driver address");
    });

    it("Should reject zero receiver address", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, ethers.ZeroAddress, amount, signature)
      ).to.be.revertedWith("Invalid receiver address");
    });

    it("Should reject zero amount", async function () {
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, 0, signature)
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should reject sender as driver", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, sender.address, receiver.address, amount, signature)
      ).to.be.revertedWith("Sender cannot be driver");
    });

    it("Should reject sender as receiver", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, sender.address, amount, signature)
      ).to.be.revertedWith("Sender cannot be receiver");
    });

    it("Should reject driver as receiver", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, driver.address, amount, signature)
      ).to.be.revertedWith("Driver cannot be receiver");
    });

    it("Should reject invalid signature", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      // Wrong signer (using 'other' instead of 'sender')
      const signature = await signAction(other, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should reject replay attacks (reused nonce)", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      // First call succeeds
      await escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature);
      
      // Second call with same signature should fail (nonce already used)
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature)
      ).to.be.reverted; // Signature won't match because nonce incremented
    });
  });

  describe("Events", function () {
    it("Should emit DealCreated event with correct parameters", async function () {
      const amount = ethers.parseEther("1000");
      const nonce = await escrow.getNonce(sender.address);
      const signature = await signAction(sender, escrowAddress, chainId, "createDeal", 0, nonce);
      
      await expect(
        escrow.connect(relay).createDeal(sender.address, driver.address, receiver.address, amount, signature)
      )
        .to.emit(escrow, "DealCreated")
        .withArgs(0, sender.address, driver.address, receiver.address, amount, (value) => value > 0);
    });
  });
});
