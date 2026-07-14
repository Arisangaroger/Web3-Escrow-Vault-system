import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { GasRelayService } from '../contracts/gas-relay.service';
import { DealStatus } from '@prisma/client';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class KeeperService {
  private readonly logger = new LoggerService(KeeperService.name);

  constructor(
    private prisma: PrismaService,
    private contractsService: ContractsService,
    private gasRelayService: GasRelayService,
  ) {}

  /**
   * Sweep expired fund locks (auto-cancel Created deals past deadline)
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpiredFundLocks(): Promise<void> {
    const stats = {
      evaluated: 0,
      actioned: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      // Find Created deals past fund lock deadline
      const expiredDeals = await this.prisma.deal.findMany({
        where: {
          status: DealStatus.Created,
          fundLockDeadline: {
            lt: new Date(),
          },
        },
      });

      stats.evaluated = expiredDeals.length;

      for (const deal of expiredDeals) {
        try {
          // Verify on-chain status before acting
          const onChainDeal = await this.contractsService.getDealFromChain(deal.dealId);
          
          // Status enum: 0=Created, 6=Cancelled
          if (Number(onChainDeal.status) === 0) {
            await this.contractsService.autoCancelOnChain(deal.dealId);
            stats.actioned++;
            this.logger.logDeal('Auto-cancelled (fund lock expired)', deal.dealId);
          } else {
            stats.skipped++;
            this.logger.debug('Deal already transitioned', {
              dealId: deal.dealId,
              onChainStatus: Number(onChainDeal.status),
            });
          }
        } catch (error) {
          stats.failed++;
          this.logger.error('Failed to auto-cancel deal', error, { dealId: deal.dealId });
        }
      }

      this.logger.logKeeper('Expired fund locks sweep completed', stats);

      // Check treasury health
      await this.gasRelayService.checkTreasuryHealth();
    } catch (error) {
      this.logger.error('Sweep expired fund locks failed', error);
    }
  }

  /**
   * Sweep expired payouts (auto-release Delivered deals past payout time)
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpiredPayouts(): Promise<void> {
    const stats = {
      evaluated: 0,
      actioned: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      // Find Delivered deals past payout ready time
      const readyDeals = await this.prisma.deal.findMany({
        where: {
          status: DealStatus.Delivered,
          payoutReadyTime: {
            lte: new Date(),
          },
        },
      });

      stats.evaluated = readyDeals.length;

      for (const deal of readyDeals) {
        try {
          // Verify on-chain status before acting
          const onChainDeal = await this.contractsService.getDealFromChain(deal.dealId);
          
          // Status enum: 3=Delivered
          if (Number(onChainDeal.status) === 3) {
            await this.contractsService.releaseFundsOnChain(deal.dealId);
            stats.actioned++;
            this.logger.logDeal('Funds auto-released (dispute window expired)', deal.dealId);
          } else {
            stats.skipped++;
            this.logger.debug('Deal already transitioned', {
              dealId: deal.dealId,
              onChainStatus: Number(onChainDeal.status),
            });
          }
        } catch (error) {
          stats.failed++;
          this.logger.error('Failed to release funds', error, { dealId: deal.dealId });
        }
      }

      this.logger.logKeeper('Expired payouts sweep completed', stats);

      // Check treasury health
      await this.gasRelayService.checkTreasuryHealth();
    } catch (error) {
      this.logger.error('Sweep expired payouts failed', error);
    }
  }

  /**
   * Health check - runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async healthCheck(): Promise<void> {
    try {
      const wallet = this.gasRelayService.getTreasuryWallet();
      const balance = await this.gasRelayService.getTreasuryBalance();
      const threshold = '0.5'; // 0.5 ETH warning threshold

      this.logger.logBalance(wallet.address, balance, threshold);
      
      await this.gasRelayService.checkTreasuryHealth();
    } catch (error) {
      this.logger.error('Health check failed', error);
    }
  }
}
