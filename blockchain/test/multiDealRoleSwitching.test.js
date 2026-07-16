const { expect } = require("chai");
const { ethers } = require("hardhat");
const { signAction } = require("./helpers/signatures");
const { deployEscrowSystem } = require("./helpers/deploy");

describe("Escrow - Multi-Deal Role Switching", function () {
  let token, escrow;
  let admin, operator, alice, bob, charlie, relay;
  let chainId, escrowAddress;
  const amount = ethers.parseEther("1000");

  beforeEach(async function () {
    [admin, operator, alice, bob, charlie, relay] = await ethers.getSigners();

    ({ token, escrow, escrowAddress, chainId } = await deployEscrowSystem({
      admin,
      operator,
      relay,
    }));

    // Mint tokens to all parties (no approve — Escrow pullFrom)
    await token.connect(operator).mint(alice.address, amount * BigInt(3));
    await token.connect(operator).mint(bob.address, amount * BigInt(3));
    await token.connect(operator).mint(charlie.address, amount * BigInt(3));
  });

  describe("Same Address, Different Roles", function () {
    it("Should allow Alice to be sender in Deal A, driver in Deal B, receiver in Deal C", async function () {
      // Deal A: Alice is sender
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);

      // Deal B: Alice is driver (Bob is sender)
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(bob.address, alice.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      // Deal C: Alice is receiver (Charlie is sender)
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "createDeal", 2, nonce);
      await escrow.connect(relay).createDeal(charlie.address, bob.address, alice.address, amount, signature);
      
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "lockFunds", 2, nonce);
      await escrow.connect(relay).lockFunds(2, signature);

      const dealA = await escrow.getDeal(0);
      const dealB = await escrow.getDeal(1);
      const dealC = await escrow.getDeal(2);

      expect(dealA.sender).to.equal(alice.address);
      expect(dealB.driver).to.equal(alice.address);
      expect(dealC.receiver).to.equal(alice.address);
    });

    it("Should enforce role-specific permissions per deal", async function () {
      // Deal 0: Alice is sender, Bob is driver, Charlie is receiver
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);

      // Deal 1: Alice is driver, Bob is sender, Charlie is receiver
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(bob.address, alice.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      // Alice can mark shipped in Deal 0 (she's sender)
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markShipped", 0, nonce);
      await expect(escrow.connect(relay).markShipped(0, signature)).to.not.be.reverted;

      // Alice cannot mark shipped in Deal 1 (she's driver, not sender)
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markShipped", 1, nonce);
      await expect(
        escrow.connect(relay).markShipped(1, signature)
      ).to.be.revertedWith("Invalid signature");

      // Alice can mark delivered in Deal 1 (she's driver)
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "markShipped", 1, nonce);
      await escrow.connect(relay).markShipped(1, signature);
      
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markDelivered", 1, nonce);
      await expect(escrow.connect(relay).markDelivered(1, signature)).to.not.be.reverted;

      // Alice cannot mark delivered in Deal 0 (she's sender, not driver)
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markDelivered", 0, nonce);
      await expect(
        escrow.connect(relay).markDelivered(0, signature)
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("Simultaneous Active Deals", function () {
    it("Should handle multiple active deals per address simultaneously", async function () {
      // Create 3 deals where Alice has different roles
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(bob.address, alice.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "createDeal", 2, nonce);
      await escrow.connect(relay).createDeal(charlie.address, bob.address, alice.address, amount, signature);

      // Lock all deals
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);
      
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "lockFunds", 2, nonce);
      await escrow.connect(relay).lockFunds(2, signature);

      // Progress each deal independently
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markShipped", 0, nonce);
      await escrow.connect(relay).markShipped(0, signature);
      
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "markShipped", 1, nonce);
      await escrow.connect(relay).markShipped(1, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "markShipped", 2, nonce);
      await escrow.connect(relay).markShipped(2, signature);

      const deal0 = await escrow.getDeal(0);
      const deal1 = await escrow.getDeal(1);
      const deal2 = await escrow.getDeal(2);

      expect(deal0.status).to.equal(2); // Shipped
      expect(deal1.status).to.equal(2); // Shipped
      expect(deal2.status).to.equal(2); // Shipped
    });

    it("Should isolate deal states - completing one doesn't affect others", async function () {
      // Create 2 deals
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);

      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      // Complete Deal 0 fully
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markShipped", 0, nonce);
      await escrow.connect(relay).markShipped(0, signature);
      
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "markDelivered", 0, nonce);
      await escrow.connect(relay).markDelivered(0, signature);

      // Check Deal 0 is Delivered
      const deal0 = await escrow.getDeal(0);
      expect(deal0.status).to.equal(3); // Delivered

      // Check Deal 1 is still FundsLocked
      const deal1 = await escrow.getDeal(1);
      expect(deal1.status).to.equal(1); // FundsLocked
    });
  });

  describe("Complex Role Interactions", function () {
    it("Should allow same two parties to have multiple deals with swapped roles", async function () {
      // Deal 0: Alice sends to Bob
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, charlie.address, bob.address, amount, signature);
      
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);

      // Deal 1: Bob sends to Alice
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(bob.address, charlie.address, alice.address, amount, signature);
      
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      const deal0 = await escrow.getDeal(0);
      const deal1 = await escrow.getDeal(1);

      expect(deal0.sender).to.equal(alice.address);
      expect(deal0.receiver).to.equal(bob.address);
      expect(deal1.sender).to.equal(bob.address);
      expect(deal1.receiver).to.equal(alice.address);
    });

    it("Should handle revoke from different roles in different deals", async function () {
      // Deal 0: Alice is sender
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);

      // Deal 1: Alice is receiver
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(bob.address, charlie.address, alice.address, amount, signature);
      
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      // Alice revokes Deal 0 as sender
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "revoke", 0, nonce);
      await expect(escrow.connect(relay).revoke(0, 1, alice.address, signature)).to.not.be.reverted;

      // Alice revokes Deal 1 as receiver
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "revoke", 1, nonce);
      await expect(escrow.connect(relay).revoke(1, 2, alice.address, signature)).to.not.be.reverted;

      const deal0 = await escrow.getDeal(0);
      const deal1 = await escrow.getDeal(1);

      expect(deal0.status).to.equal(4); // Disputed
      expect(deal1.status).to.equal(4); // Disputed
    });
  });

  describe("Deal Isolation", function () {
    it("Should prevent cross-deal permission leakage", async function () {
      // Deal 0: Alice sender, Bob driver, Charlie receiver
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "lockFunds", 0, nonce);
      await escrow.connect(relay).lockFunds(0, signature);

      // Deal 1: Different setup
      nonce = await escrow.getNonce(charlie.address);
      signature = await signAction(charlie, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(charlie.address, alice.address, bob.address, amount, signature);
      
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "lockFunds", 1, nonce);
      await escrow.connect(relay).lockFunds(1, signature);

      // Bob cannot mark Deal 1 as shipped (he's receiver, not sender)
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "markShipped", 1, nonce);
      await expect(
        escrow.connect(relay).markShipped(1, signature)
      ).to.be.revertedWith("Invalid signature");

      // But Bob can mark Deal 0 as delivered (he's driver in Deal 0)
      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "markShipped", 0, nonce);
      await escrow.connect(relay).markShipped(0, signature);
      
      nonce = await escrow.getNonce(bob.address);
      signature = await signAction(bob, escrowAddress, chainId, "markDelivered", 0, nonce);
      await expect(escrow.connect(relay).markDelivered(0, signature)).to.not.be.reverted;
    });

    it("Should track separate timestamps for each deal", async function () {
      // Create deals at different times with time manipulation
      let nonce = await escrow.getNonce(alice.address);
      let signature = await signAction(alice, escrowAddress, chainId, "createDeal", 0, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      const deal0 = await escrow.getDeal(0);

      nonce = await escrow.getNonce(alice.address);
      signature = await signAction(alice, escrowAddress, chainId, "createDeal", 1, nonce);
      await escrow.connect(relay).createDeal(alice.address, bob.address, charlie.address, amount, signature);
      const deal1 = await escrow.getDeal(1);

      // Timestamps should be at least equal (could be same block)
      expect(deal1.createdAt >= deal0.createdAt).to.be.true;
    });
  });
});
