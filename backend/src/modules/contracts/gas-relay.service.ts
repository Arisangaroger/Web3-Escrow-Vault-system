import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class GasRelayService {
  private readonly logger = new LoggerService(GasRelayService.name);
  private readonly provider: ethers.Provider;
  private readonly treasuryWallet: ethers.Wallet;
  private readonly gasThreshold: string;
  private readonly gasTopUpAmount: string;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const treasuryKey = this.configService.get<string>('TREASURY_PRIVATE_KEY');
    this.gasThreshold = this.configService.get<string>('GAS_THRESHOLD') || '0.01';
    this.gasTopUpAmount = this.configService.get<string>('GAS_TOP_UP_AMOUNT') || '0.05';

    if (!rpcUrl || !treasuryKey) {
      throw new Error('RPC_URL and TREASURY_PRIVATE_KEY must be set');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.treasuryWallet = new ethers.Wallet(treasuryKey, this.provider);

    this.logger.info('Treasury wallet initialized', {
      address: this.treasuryWallet.address,
    });
  }

  /**
   * Ensure a wallet has enough gas to execute a transaction
   */
  async ensureGasFunded(walletAddress: string): Promise<void> {
    const balance = await this.provider.getBalance(walletAddress);
    const threshold = ethers.parseEther(this.gasThreshold);

    if (balance < threshold) {
      const topUpAmount = ethers.parseEther(this.gasTopUpAmount);

      this.logger.info('Gas top-up initiated', {
        wallet: walletAddress,
        currentBalance: ethers.formatEther(balance),
        topUpAmount: this.gasTopUpAmount,
      });

      const tx = await this.treasuryWallet.sendTransaction({
        to: walletAddress,
        value: topUpAmount,
      });

      await tx.wait();
      this.logger.logTransaction('gasTopUp', tx.hash, {
        wallet: walletAddress,
        amount: this.gasTopUpAmount,
      });
    }
  }

  /**
   * Get treasury wallet balance
   */
  async getTreasuryBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.treasuryWallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Check if treasury needs refilling
   */
  async checkTreasuryHealth(): Promise<void> {
    const balance = await this.provider.getBalance(this.treasuryWallet.address);
    const minBalance = ethers.parseEther('0.5'); // 0.5 ETH minimum
    const balanceFormatted = ethers.formatEther(balance);

    this.logger.logBalance(
      this.treasuryWallet.address,
      balanceFormatted,
      '0.5',
    );
  }

  /**
   * Get provider for contract interactions
   */
  getProvider(): ethers.Provider {
    return this.provider;
  }

  /**
   * Get treasury wallet (for admin operations)
   */
  getTreasuryWallet(): ethers.Wallet {
    return this.treasuryWallet;
  }
}
