const { ethers } = require("hardhat");

/**
 * Helper module for generating EIP-712 signatures for Escrow contract
 */

/**
 * Get domain separator for EIP-712
 */
function getDomainSeparator(contractAddress, chainId) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        ethers.keccak256(ethers.toUtf8Bytes("EscrowContract")),
        ethers.keccak256(ethers.toUtf8Bytes("1")),
        chainId,
        contractAddress
      ]
    )
  );
}

/**
 * Generate signature for any Escrow function
 * @param {Object} signer - Ethers signer object
 * @param {string} contractAddress - Escrow contract address
 * @param {number} chainId - Chain ID
 * @param {string} functionName - Function name (e.g., "createDeal")
 * @param {number} dealId - Deal ID
 * @param {number} nonce - Current nonce for signer
 * @returns {string} Signature bytes
 */
async function signAction(signer, contractAddress, chainId, functionName, dealId, nonce) {
  // Use EIP-712 typed data signing (raw digest). Do not use signMessage —
  // it adds the personal-message prefix and breaks contract recovery.
  return await signer.signTypedData(
    {
      name: "EscrowContract",
      version: "1",
      chainId,
      verifyingContract: contractAddress
    },
    {
      Action: [
        { name: "functionName", type: "string" },
        { name: "dealId", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    },
    {
      functionName,
      dealId,
      nonce
    }
  );
}

module.exports = {
  getDomainSeparator,
  signAction
};
