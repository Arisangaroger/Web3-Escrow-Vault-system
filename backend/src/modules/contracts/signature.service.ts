import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

/**
 * EIP-712 signatures for Escrow meta-transactions.
 * Must match blockchain/test/helpers/signatures.js and Escrow.sol DOMAIN_SEPARATOR.
 */
@Injectable()
export class SignatureService {
  async signAction(
    wallet: ethers.Wallet | ethers.HDNodeWallet,
    contractAddress: string,
    chainId: number,
    functionName: string,
    dealId: number,
    nonce: number,
  ): Promise<string> {
    // Use signTypedData (raw EIP-712 digest). Do NOT use signMessage —
    // it adds the personal-message prefix and breaks on-chain ECDSA.recover.
    return wallet.signTypedData(
      {
        name: 'EscrowContract',
        version: '1',
        chainId: Number(chainId),
        verifyingContract: contractAddress,
      },
      {
        Action: [
          { name: 'functionName', type: 'string' },
          { name: 'dealId', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      {
        functionName,
        dealId,
        nonce,
      },
    );
  }
}
