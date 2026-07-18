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
    const chainId = Number(this.configService.get<string | number>('CHAIN_ID')) || 80002;

    if (!rpcUrl || !treasuryKey) {
      throw new Error('RPC_URL and TREASURY_PRIVATE_KEY must be set');
    }

    this.provider = this.createProvider(rpcUrl, chainId);
    this.treasuryWallet = new ethers.Wallet(treasuryKey, this.provider);

    this.logger.info('Treasury wallet initialized', {
      address: this.treasuryWallet.address,
      rpcEndpoints: rpcUrl.split(',').map((u) => u.trim()).filter(Boolean).length,
    });
  }

  /**
   * Comma-separated RPC_URL builds a FallbackProvider so free-tier timeouts
   * (dRPC) do not surface as opaque ethers "missing revert data".
   * quorum:1 — Amoy public RPCs disagree on tip; default majority quorum turns
   * eth_getLogs into noisy "quorum not met" even when one node has the logs.
   */
  private createProvider(rpcUrl: string, chainId: number): ethers.Provider {
    const urls = rpcUrl
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    const network = ethers.Network.from(chainId);

    // Poll receipts more aggressively than the 4s default so tx.wait() detects
    // Amoy confirmations quickly instead of dragging the admin UI for minutes.
    const pollingInterval = 1500;

    if (urls.length === 1) {
      const single = new ethers.JsonRpcProvider(urls[0], network, {
        staticNetwork: true,
      });
      single.pollingInterval = pollingInterval;
      return single;
    }

    const configs = urls.map((url, index) => {
      const provider = new ethers.JsonRpcProvider(url, network, {
        staticNetwork: true,
      });
      provider.pollingInterval = pollingInterval;
      return {
        provider,
        priority: index + 1,
        stallTimeout: 2500,
        weight: 1,
      };
    });

    const fallback = new ethers.FallbackProvider(configs, network, { quorum: 1 });
    // FallbackProvider.pollingInterval is read-only; child JsonRpcProviders
    // already use 1.5s polling for receipt detection.
    return fallback;
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
