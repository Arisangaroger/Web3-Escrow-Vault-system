const { ethers } = require("hardhat");

/**
 * Deploy eRWF + Escrow with ESCROW_ROLE granted (meta-tx / pullFrom model).
 * @param {object} opts
 * @param {import("ethers").Signer} opts.admin
 * @param {import("ethers").Signer} opts.operator
 * @param {import("ethers").Signer} opts.relay
 */
async function deployEscrowSystem({ admin, operator, relay }) {
  const ERWF = await ethers.getContractFactory("eRWF");
  const token = await ERWF.deploy(operator.address);
  await token.waitForDeployment();

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(
    await token.getAddress(),
    admin.address,
    relay.address,
  );
  await escrow.waitForDeployment();

  await (
    await token.connect(operator).grantRole(await token.ESCROW_ROLE(), await escrow.getAddress())
  ).wait();

  return {
    token,
    escrow,
    escrowAddress: await escrow.getAddress(),
    chainId: (await ethers.provider.getNetwork()).chainId,
  };
}

module.exports = { deployEscrowSystem };
