import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DealStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { LoggerService } from '../../common/logger.service';

const STATUS_BY_INDEX: DealStatus[] = [
  DealStatus.Created,
  DealStatus.FundsLocked,
  DealStatus.Shipped,
  DealStatus.Delivered,
  DealStatus.Disputed,
  DealStatus.Released,
  DealStatus.Cancelled,
  DealStatus.Resolved,
];

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new LoggerService(EventListenerService.name);
  private isListening = false;

  constructor(
    private prisma: PrismaService,
    private contractsService: ContractsService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.startListening();
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;
    this.logger.info('Event listener started');
    await this.syncEvents();
  }

  @Cron('*/30 * * * * *')
  async syncEvents(): Promise<void> {
    try {
      let syncState = await this.prisma.syncState.findFirst();
      if (!syncState) {
        syncState = await this.prisma.syncState.create({
          data: { lastSyncedBlock: 0 },
        });
      }

      const fromBlock = syncState.lastSyncedBlock + 1;
      const contract = this.contractsService.getEscrowContract();
      const provider = contract.runner.provider;
      if (!provider) return;

      const currentBlock = await provider.getBlockNumber();
      if (fromBlock > currentBlock) return;

      this.logger.debug(`Syncing events from block ${fromBlock} to ${currentBlock}`);

      const events = await contract.queryFilter('*', fromBlock, currentBlock);
      for (const event of events) {
        if ('eventName' in event) {
          await this.handleEvent(event as ethers.EventLog);
        }
      }

      await this.prisma.syncState.update({
        where: { id: syncState.id },
        data: { lastSyncedBlock: currentBlock },
      });

      if (events.length > 0) {
        this.logger.info('Event sync completed', {
          eventsProcessed: events.length,
          fromBlock,
          toBlock: currentBlock,
        });
      }
    } catch (error) {
      this.logger.error(`Event sync error: ${error.message}`);
    }
  }

  /**
   * Reconcile DB deal statuses against on-chain state (missed events safety net)
   */
  @Cron('0 */10 * * * *')
  async reconcileDeals(): Promise<void> {
    try {
      const openDeals = await this.prisma.deal.findMany({
        where: {
          status: {
            in: [
              DealStatus.Created,
              DealStatus.FundsLocked,
              DealStatus.Shipped,
              DealStatus.Delivered,
              DealStatus.Disputed,
            ],
          },
        },
        take: 100,
        orderBy: { dealId: 'desc' },
      });

      let fixed = 0;
      for (const deal of openDeals) {
        try {
          const onChain = await this.contractsService.getDealFromChain(deal.dealId);
          const onChainStatus = STATUS_BY_INDEX[Number(onChain.status)];
          if (!onChainStatus || onChainStatus === deal.status) continue;

          const data: any = {
            status: onChainStatus,
            lastSyncedBlock: deal.lastSyncedBlock,
          };

          if (onChain.payoutReadyTime && Number(onChain.payoutReadyTime) > 0) {
            data.payoutReadyTime = new Date(Number(onChain.payoutReadyTime) * 1000);
          }
          if (onChain.disputeReasonCode != null) {
            data.disputeReasonCode = Number(onChain.disputeReasonCode);
          }

          await this.prisma.deal.update({
            where: { dealId: deal.dealId },
            data,
          });
          fixed++;
          this.logger.warn('Deal reconciled', {
            dealId: deal.dealId,
            dbStatus: deal.status,
            chainStatus: onChainStatus,
          });
        } catch (error) {
          this.logger.error(`Reconcile deal ${deal.dealId} failed: ${error.message}`);
        }
      }

      if (fixed > 0) {
        this.logger.info('Reconciliation completed', { dealsFixed: fixed });
      }
    } catch (error) {
      this.logger.error(`Reconciliation error: ${error.message}`);
    }
  }

  private async handleEvent(event: ethers.EventLog): Promise<void> {
    try {
      switch (event.eventName) {
        case 'DealCreated':
          await this.handleDealCreated(event);
          break;
        case 'FundsLocked':
          await this.handleFundsLocked(event);
          break;
        case 'MarkedShipped':
          await this.handleMarkedShipped(event);
          break;
        case 'MarkedDelivered':
          await this.handleMarkedDelivered(event);
          break;
        case 'DealRevoked':
          await this.handleDealRevoked(event);
          break;
        case 'FundsReleased':
          await this.handleFundsReleased(event);
          break;
        case 'DisputeResolved':
          await this.handleDisputeResolved(event);
          break;
        case 'DealAutoCancelled':
          await this.handleDealAutoCancelled(event);
          break;
        case 'DealCancelled':
          await this.handleDealCancelled(event);
          break;
        default:
          this.logger.debug(`Unhandled event: ${event.eventName}`);
      }
    } catch (error) {
      this.logger.error(`Error handling ${event.eventName}: ${error.message}`);
    }
  }

  private async handleDealCreated(event: ethers.EventLog): Promise<void> {
    const [dealId, sender, driver, receiver, amount, timestamp] = event.args;
    const id = Number(dealId);

    const existing = await this.prisma.deal.findUnique({ where: { dealId: id } });
    if (existing) {
      await this.prisma.deal.update({
        where: { dealId: id },
        data: {
          status: DealStatus.Created,
          txHashCreated: event.transactionHash,
          lastSyncedBlock: event.blockNumber,
        },
      });
    } else {
      // Never store wallet addresses as phone FKs — resolve users by wallet
      const [senderUser, driverUser, receiverUser] = await Promise.all([
        this.prisma.user.findUnique({ where: { walletAddress: sender } }),
        this.prisma.user.findUnique({ where: { walletAddress: driver } }),
        this.prisma.user.findUnique({ where: { walletAddress: receiver } }),
      ]);

      if (!senderUser || !driverUser || !receiverUser) {
        this.logger.warn('DealCreated missing users', {
          dealId: id,
          sender,
          driver,
          receiver,
        });
      } else {
        await this.prisma.deal.create({
          data: {
            dealId: id,
            senderPhone: senderUser.phoneNumber,
            driverPhone: driverUser.phoneNumber,
            receiverPhone: receiverUser.phoneNumber,
            amount: ethers.formatEther(amount),
            status: DealStatus.Created,
            fundLockDeadline: new Date(Number(timestamp) * 1000 + 24 * 60 * 60 * 1000),
            txHashCreated: event.transactionHash,
            lastSyncedBlock: event.blockNumber,
          },
        });
      }
    }

    await this.logAction(id, sender, 'DealCreated', event.transactionHash);
    await this.notificationsService.notifyDealCreated(id);
  }

  private async handleFundsLocked(event: ethers.EventLog): Promise<void> {
    const [dealId, receiver] = event.args;
    const id = Number(dealId);
    await this.updateDealStatus(id, { status: DealStatus.FundsLocked }, event.blockNumber);
    await this.logAction(id, receiver, 'FundsLocked', event.transactionHash);
    await this.notificationsService.notifyFundsLocked(id);
  }

  private async handleMarkedShipped(event: ethers.EventLog): Promise<void> {
    const [dealId, sender] = event.args;
    const id = Number(dealId);
    await this.updateDealStatus(id, { status: DealStatus.Shipped }, event.blockNumber);
    await this.logAction(id, sender, 'Shipped', event.transactionHash);
    await this.notificationsService.notifyShipped(id);
  }

  private async handleMarkedDelivered(event: ethers.EventLog): Promise<void> {
    const [dealId, driver, , payoutReadyTime] = event.args;
    const id = Number(dealId);
    await this.updateDealStatus(
      id,
      {
        status: DealStatus.Delivered,
        payoutReadyTime: new Date(Number(payoutReadyTime) * 1000),
      },
      event.blockNumber,
    );
    await this.logAction(id, driver, 'Delivered', event.transactionHash);
    await this.notificationsService.notifyDelivered(id);
  }

  private async handleDealRevoked(event: ethers.EventLog): Promise<void> {
    const [dealId, revokedBy, reasonCode] = event.args;
    const id = Number(dealId);
    await this.updateDealStatus(
      id,
      {
        status: DealStatus.Disputed,
        disputeReasonCode: Number(reasonCode),
      },
      event.blockNumber,
    );

    const phone = await this.resolvePhone(revokedBy);
    await this.logAction(id, revokedBy, 'Disputed', event.transactionHash);
    await this.notificationsService.notifyRevoked(id, phone || revokedBy);
  }

  private async handleFundsReleased(event: ethers.EventLog): Promise<void> {
    const [dealId, sender] = event.args;
    const id = Number(dealId);
    await this.updateDealStatus(id, { status: DealStatus.Released }, event.blockNumber);
    await this.logAction(id, sender, 'Released', event.transactionHash);
    await this.notificationsService.notifyReleased(id);
  }

  private async handleDisputeResolved(event: ethers.EventLog): Promise<void> {
    const [dealId, admin, amountToSender, amountToReceiver] = event.args;
    const id = Number(dealId);
    await this.updateDealStatus(id, { status: DealStatus.Resolved }, event.blockNumber);
    await this.logAction(id, admin, 'Resolved', event.transactionHash);
    await this.notificationsService.notifyDisputeResolved(
      id,
      ethers.formatEther(amountToSender),
      ethers.formatEther(amountToReceiver),
    );
  }

  private async handleDealAutoCancelled(event: ethers.EventLog): Promise<void> {
    const [dealId] = event.args;
    const id = Number(dealId);
    const deal = await this.prisma.deal.findUnique({ where: { dealId: id } });
    await this.updateDealStatus(id, { status: DealStatus.Cancelled }, event.blockNumber);
    if (deal) {
      await this.logActionByPhone(id, deal.senderPhone, 'AutoCancelled', event.transactionHash);
    }
    await this.notificationsService.notifyAutoCancelled(id);
  }

  private async handleDealCancelled(event: ethers.EventLog): Promise<void> {
    const [dealId] = event.args;
    const id = Number(dealId);
    const deal = await this.prisma.deal.findUnique({ where: { dealId: id } });
    await this.updateDealStatus(id, { status: DealStatus.Cancelled }, event.blockNumber);
    if (deal) {
      await this.logActionByPhone(id, deal.senderPhone, 'Cancelled', event.transactionHash);
    }
  }

  private async updateDealStatus(
    dealId: number,
    data: Record<string, unknown>,
    blockNumber: number,
  ): Promise<void> {
    const result = await this.prisma.deal.updateMany({
      where: { dealId },
      data: { ...data, lastSyncedBlock: blockNumber },
    });
    if (result.count === 0) {
      this.logger.warn('Deal not found for status update', { dealId });
    }
  }

  private async resolvePhone(walletAddress: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
      select: { phoneNumber: true },
    });
    return user?.phoneNumber ?? null;
  }

  private async logAction(
    dealId: number,
    walletOrUnknown: string,
    action: string,
    txHash: string,
  ): Promise<void> {
    const phone = await this.resolvePhone(walletOrUnknown);
    if (!phone) {
      this.logger.debug(`Skip action log ${action} for deal ${dealId}: unknown wallet`);
      return;
    }
    await this.logActionByPhone(dealId, phone, action, txHash);
  }

  private async logActionByPhone(
    dealId: number,
    actorPhone: string,
    action: string,
    txHash: string,
  ): Promise<void> {
    const deal = await this.prisma.deal.findUnique({ where: { dealId } });
    const user = await this.prisma.user.findUnique({ where: { phoneNumber: actorPhone } });
    if (!deal || !user) return;

    await this.prisma.dealActionLog.create({
      data: {
        dealId,
        actorPhone,
        action,
        txHash,
      },
    });
  }
}
