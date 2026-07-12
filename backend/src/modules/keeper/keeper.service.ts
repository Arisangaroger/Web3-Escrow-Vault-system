import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { GasRelayService } from '../contracts/gas-relay.service';
import { DealStatus } from '@prisma/client';

@Injectable()
export class KeeperService {
  private readonly logger = new Logger(KeeperService.name);

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
    this.logger.log('🧹 Sweeping expired fund locks...');

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

      this.logger.log(`Found ${expiredDeals.length} expired deal(s)`);

      for (const deal of expiredDeals) {
        try {
          // Verify on-chain status before acting
          const onChainDeal = await this.contractsService.getDealFromChain(deal.dealId);
          
          // Status enum: 0=Created, 6=Cancelled
          if (Number(onChainDeal.status) === 0) {
            this.logger.log(`Auto-cancelling deal ${deal.dealId}...`);
            await this.contractsService.autoCancelOnChain(deal.dealId);
            this.logger.log(`✅ Deal ${deal.dealId} auto-cancelled`);
          } else {
            this.logger.debug(
              `Deal ${deal.dealId} already transitioned to status ${onChainDeal.status}`
            );
          }
        } catch (error) {
          this.logger.error(`❌ Failed to auto-cancel deal ${deal.dealId}: ${error.message}`);
          // Continue with next deal
        }
      }

      // Check treasury health
      await this.gasRelayService.checkTreasuryHealth();
    } catch (error) {
      this.logger.error(`❌ Sweep expired fund locks error: ${error.message}`);
    }
  }

  /**
   * Sweep expired payouts (auto-release Delivered deals past payout time)
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpiredPayouts(): Promise<void> {
    this.logger.log('🧹 Sweeping expired payouts...');

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

      this.logger.log(`Found ${readyDeals.length} deal(s) ready for payout`);

      for (const deal of readyDeals) {
        try {
          // Verify on-chain status before acting
          const onChainDeal = await this.contractsService.getDealFromChain(deal.dealId);
          
          // Status enum: 3=Delivered
          if (Number(onChainDeal.status) === 3) {
            this.logger.log(`Releasing funds for deal ${deal.dealId}...`);
            await this.contractsService.releaseFundsOnChain(deal.dealId);
            this.logger.log(`✅ Funds released for deal ${deal.dealId}`);
          } else {
            this.logger.debug(
              `Deal ${deal.dealId} already transitioned to status ${onChainDeal.status}`
            );
          }
        } catch (error) {
          this.logger.error(`❌ Failed to release funds for deal ${deal.dealId}: ${error.message}`);
          // Continue with next deal
        }
      }

      // Check treasury health
      await this.gasRelayService.checkTreasuryHealth();
    } catch (error) {
      this.logger.error(`❌ Sweep expired payouts error: ${error.message}`);
    }
  }

  /**
   * Health check - runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async healthCheck(): Promise<void> {
    try {
      const treasuryBalance = await this.gasRelayService.getTreasuryBalance();
      this.logger.log(`💰 Treasury balance: ${treasuryBalance} ETH`);
      
      await this.gasRelayService.checkTreasuryHealth();
    } catch (error) {
      this.logger.error(`❌ Health check error: ${error.message}`);
    }
  }
}
