import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { GasRelayService } from '../contracts/gas-relay.service';

@Controller('internal')
export class StatusController {
  constructor(
    private prisma: PrismaService,
    private gasRelayService: GasRelayService,
  ) {}

  /**
   * Internal status page for monitoring
   * GET /internal/status
   */
  @Get('status')
  async getStatus() {
    try {
      // Get deal counts by status
      const dealCounts = await this.prisma.deal.groupBy({
        by: ['status'],
        _count: true,
      });

      const statusSummary = dealCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>);

      // Get active disputes count
      const disputeCount = await this.prisma.deal.count({
        where: { status: 'Disputed' },
      });

      // Get treasury balance
      const treasuryWallet = this.gasRelayService.getTreasuryWallet();
      const treasuryBalance = await this.gasRelayService.getTreasuryBalance();

      // Get last keeper run (approximate from most recent auto-action)
      const lastAutoAction = await this.prisma.dealActionLog.findFirst({
        where: {
          OR: [
            { action: { contains: 'AutoCancelled' } },
            { action: { contains: 'Released' } },
          ],
        },
        orderBy: { timestamp: 'desc' },
      });

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        deals: {
          byStatus: statusSummary,
          totalActive:
            (statusSummary['Created'] || 0) +
            (statusSummary['FundsLocked'] || 0) +
            (statusSummary['Shipped'] || 0) +
            (statusSummary['Delivered'] || 0),
          disputes: disputeCount,
        },
        treasury: {
          address: treasuryWallet.address,
          balance: treasuryBalance,
          warning: parseFloat(treasuryBalance) < 0.5,
        },
        keeper: {
          lastAutoAction: lastAutoAction?.timestamp || null,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
