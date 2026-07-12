import { ethers } from 'ethers';
import { SignatureService } from '../src/modules/contracts/signature.service';

/**
 * Mirrors blockchain Escrow.sol recovery path to prove backend signatures verify.
 */
function recoverSigner(
  signature: string,
  contractAddress: string,
  chainId: number,
  functionName: string,
  dealId: number,
  nonce: number,
): string {
  const domain = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        ethers.keccak256(
          ethers.toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
          ),
        ),
        ethers.keccak256(ethers.toUtf8Bytes('EscrowContract')),
        ethers.keccak256(ethers.toUtf8Bytes('1')),
        chainId,
        contractAddress,
      ],
    ),
  );

  const structHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'uint256', 'uint256'],
      [
        ethers.keccak256(
          ethers.toUtf8Bytes('Action(string functionName,uint256 dealId,uint256 nonce)'),
        ),
        ethers.keccak256(ethers.toUtf8Bytes(functionName)),
        dealId,
        nonce,
      ],
    ),
  );

  const digest = ethers.keccak256(
    ethers.concat([ethers.toUtf8Bytes('\x19\x01'), domain, structHash]),
  );

  return ethers.recoverAddress(digest, signature);
}

describe('SignatureService (EIP-712)', () => {
  const service = new SignatureService();
  const wallet = ethers.Wallet.createRandom();
  const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 80002;

  it('recovers the signing wallet for createDeal', async () => {
    const signature = await service.signAction(
      wallet,
      contractAddress,
      chainId,
      'createDeal',
      0,
      0,
    );

    const recovered = recoverSigner(signature, contractAddress, chainId, 'createDeal', 0, 0);
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it('does not match personal-sign (signMessage) recovery', async () => {
    const signature = await service.signAction(
      wallet,
      contractAddress,
      chainId,
      'lockFunds',
      1,
      2,
    );

    // Build digest the same way, then wrongly recover as if it were eth_sign
    const domain = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes(
              'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
            ),
          ),
          ethers.keccak256(ethers.toUtf8Bytes('EscrowContract')),
          ethers.keccak256(ethers.toUtf8Bytes('1')),
          chainId,
          contractAddress,
        ],
      ),
    );
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'uint256', 'uint256'],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes('Action(string functionName,uint256 dealId,uint256 nonce)'),
          ),
          ethers.keccak256(ethers.toUtf8Bytes('lockFunds')),
          1,
          2,
        ],
      ),
    );
    const digest = ethers.keccak256(
      ethers.concat([ethers.toUtf8Bytes('\x19\x01'), domain, structHash]),
    );
    const ethSigned = ethers.hashMessage(ethers.getBytes(digest));
    const wrong = ethers.recoverAddress(ethSigned, signature);

    expect(wrong.toLowerCase()).not.toBe(wallet.address.toLowerCase());
  });
});
