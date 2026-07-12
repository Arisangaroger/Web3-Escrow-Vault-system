const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("eRWF Token", function () {
  let eRWF, token;
  let admin, operator, user1, user2, user3;

  beforeEach(async function () {
    [admin, operator, user1, user2, user3] = await ethers.getSigners();

    eRWF = await ethers.getContractFactory("eRWF");
    token = await eRWF.deploy(operator.address); // Operator gets OPERATOR_ROLE in constructor
  });

  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      expect(await token.name()).to.equal("Simulated Rwanda Franc");
      expect(await token.symbol()).to.equal("eRWF");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should grant operator role to deployer", async function () {
      const OPERATOR_ROLE = await token.OPERATOR_ROLE();
      expect(await token.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
    });

    it("Should grant admin role for role management", async function () {
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, operator.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should allow operator to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(operator).mint(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should reject mint from non-operator", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        token.connect(user1).mint(user2.address, amount)
      ).to.be.reverted;
    });

    it("Should reject mint to zero address", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        token.connect(operator).mint(ethers.ZeroAddress, amount)
      ).to.be.revertedWith("eRWF: mint to zero address");
    });

    it("Should reject mint with zero amount", async function () {
      await expect(
        token.connect(operator).mint(user1.address, 0)
      ).to.be.revertedWith("eRWF: mint amount must be positive");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(operator).mint(user1.address, amount);
    });

    it("Should allow operator to burn tokens", async function () {
      const burnAmount = ethers.parseEther("500");
      await token.connect(operator).burn(user1.address, burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(
        ethers.parseEther("500")
      );
    });

    it("Should reject burn from non-operator", async function () {
      const burnAmount = ethers.parseEther("500");
      await expect(
        token.connect(user1).burn(user1.address, burnAmount)
      ).to.be.reverted;
    });

    it("Should reject burn from zero address", async function () {
      await expect(
        token.connect(operator).burn(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWith("eRWF: burn from zero address");
    });

    it("Should reject burn with zero amount", async function () {
      await expect(
        token.connect(operator).burn(user1.address, 0)
      ).to.be.revertedWith("eRWF: burn amount must be positive");
    });
  });

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(operator).mint(user1.address, amount);
    });

    it("Should allow direct transfer between users", async function () {
      const transferAmount = ethers.parseEther("100");
      await token.connect(user1).transfer(user2.address, transferAmount);
      
      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });

    it("Should allow transferFrom with approval", async function () {
      await token.connect(user1).approve(user2.address, ethers.parseEther("100"));
      
      await token.connect(user2).transferFrom(
        user1.address,
        user3.address,
        ethers.parseEther("100")
      );

      expect(await token.balanceOf(user3.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should reject transferFrom without approval", async function () {
      await expect(
        token.connect(user2).transferFrom(user1.address, user3.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should allow users to use eRWF for any purpose", async function () {
      // Simulate multiple transfers (paying for goods, services, etc.)
      await token.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      await token.connect(user1).transfer(user3.address, ethers.parseEther("200"));
      
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("700"));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
      expect(await token.balanceOf(user3.address)).to.equal(ethers.parseEther("200"));
    });
  });

  describe("Approval", function () {
    it("Should allow users to approve any address", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(operator).mint(user1.address, amount);
      
      await token.connect(user1).approve(user2.address, amount);
      expect(await token.allowance(user1.address, user2.address)).to.equal(amount);
    });
  });
});
