import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { LoggerService } from '../../common/logger.service';

/**
 * Relay / treasury wallet — only account that submits party meta-txs and pays gas.
 * User identity comes from EIP-712 signatures verified on Escrow (_verifySigner).
 */
@Injectable()
export class GasRelayService {
  private readonly logger = new LoggerService(GasRelayService.name);
  private readonly provider: ethers.Provider;
  private readonly treasuryWallet: ethers.Wallet;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const treasuryKey = this.configService.get<string>('TREASURY_PRIVATE_KEY');

    if (!rpcUrl || !treasuryKey) {
      throw new Error('RPC_URL and TREASURY_PRIVATE_KEY must be set');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.treasuryWallet = new ethers.Wallet(treasuryKey, this.provider);

    this.logger.info('Treasury wallet initialized', {
      address: this.treasuryWallet.address,
    });
  }

  async getTreasuryBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.treasuryWallet.address);
    return ethers.formatEther(balance);
  }

  async checkTreasuryHealth(): Promise<void> {
    const balance = await this.provider.getBalance(this.treasuryWallet.address);
    this.logger.logBalance(
      this.treasuryWallet.address,
      ethers.formatEther(balance),
      '0.05',
    );
  }

  getProvider(): ethers.Provider {
    return this.provider;
  }

  getTreasuryWallet(): ethers.Wallet {
    return this.treasuryWallet;
  }
}
