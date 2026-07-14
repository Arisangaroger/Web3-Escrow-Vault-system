import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuthService } from '../auth/auth.service';
import { ContractsService } from '../contracts/contracts.service';
import { DealStatus } from '@prisma/client';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class DealsService {
  private readonly logger = new LoggerService(DealsService.name);

  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private authService: AuthService,
    private contractsService: ContractsService,
  ) {}

  /**
   * Create a new deal
   */
  async createDeal(
    senderPhone: string,
    driverPhone: string,
    receiverPhone: string,
    amount: string,
    pin: string,
  ): Promise<{ dealId: number; txHash: string }> {
    // Validate PIN
    await this.authService.verifyPin(senderPhone, pin);

    // Get or create wallets for all parties
    const { wallet: senderWallet, address: senderAddress } = 
      await this.walletsService.getOrCreateWallet(senderPhone);
    const { address: driverAddress } = 
      await this.walletsService.getOrCreateWallet(driverPhone);
    const { address: receiverAddress } = 
      await this.walletsService.getOrCreateWallet(receiverPhone);

    // Validate addresses are different
    if (senderAddress === driverAddress || 
        senderAddress === receiverAddress || 
        driverAddress === receiverAddress) {
      throw new BadRequestException('All parties must have different addresses');
    }

    // Create deal on blockchain
    const { txHash, dealId } = await this.contractsService.createDealOnChain(
      senderWallet,
      driverAddress,
      receiverAddress,
      amount,
    );

    // Store in database (will be updated by event listener)
    const fundLockDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await this.prisma.deal.create({
      data: {
        dealId,
        senderPhone,
        driverPhone,
        receiverPhone,
        amount,
        status: DealStatus.Created,
        fundLockDeadline,
        txHashCreated: txHash,
      },
    });

    this.logger.log(`✅ Deal ${dealId} created by ${senderPhone}`);

    return { dealId, txHash };
  }

  /**
   * Lock funds into escrow
   */
  async lockFunds(
    receiverPhone: string,
    dealId: number,
    pin: string,
  ): Promise<string> {
    await this.authService.verifyPin(receiverPhone, pin);

    // Verify receiver is correct
    const deal = await this.prisma.deal.findUnique({ where: { dealId } });
    if (!deal) throw new BadRequestException('Deal not found');
    if (deal.receiverPhone !== receiverPhone) {
      throw new BadRequestException('Only receiver can lock funds');
    }
    if (deal.status !== DealStatus.Created) {
      throw new BadRequestException('Deal not in Created status');
    }

    const receiverWallet = await this.walletsService.getWallet(receiverPhone);
    const txHash = await this.contractsService.lockFundsOnChain(receiverWallet, dealId);

    this.logger.log(`✅ Funds locked for deal ${dealId} by ${receiverPhone}`);
    return txHash;
  }

  /**
   * Mark goods as shipped
   */
  async markShipped(
    senderPhone: string,
    dealId: number,
    pin: string,
  ): Promise<string> {
    await this.authService.verifyPin(senderPhone, pin);

    const deal = await this.prisma.deal.findUnique({ where: { dealId } });
    if (!deal) throw new BadRequestException('Deal not found');
    if (deal.senderPhone !== senderPhone) {
      throw new BadRequestException('Only sender can mark shipped');
    }

    const senderWallet = await this.walletsService.getWallet(senderPhone);
    const txHash = await this.contractsService.markShippedOnChain(senderWallet, dealId);

    this.logger.log(`✅ Deal ${dealId} marked shipped by ${senderPhone}`);
    return txHash;
  }

  /**
   * Mark goods as delivered
   */
  async markDelivered(
    driverPhone: string,
    dealId: number,
    pin: string,
  ): Promise<string> {
    await this.authService.verifyPin(driverPhone, pin);

    const deal = await this.prisma.deal.findUnique({ where: { dealId } });
    if (!deal) throw new BadRequestException('Deal not found');
    if (deal.driverPhone !== driverPhone) {
      throw new BadRequestException('Only driver can mark delivered');
    }

    const driverWallet = await this.walletsService.getWallet(driverPhone);
    const txHash = await this.contractsService.markDeliveredOnChain(driverWallet, dealId);

    this.logger.log(`✅ Deal ${dealId} marked delivered by ${driverPhone}`);
    return txHash;
  }

  /**
   * Revoke a deal (dispute)
   */
  async revoke(
    phone: string,
    dealId: number,
    reasonCode: number,
    pin: string,
  ): Promise<string> {
    await this.authService.verifyPin(phone, pin);

    const deal = await this.prisma.deal.findUnique({ where: { dealId } });
    if (!deal) throw new BadRequestException('Deal not found');
    if (deal.senderPhone !== phone && deal.receiverPhone !== phone) {
      throw new BadRequestException('Only sender or receiver can revoke');
    }

    const wallet = await this.walletsService.getWallet(phone);
    const txHash = await this.contractsService.revokeOnChain(wallet, dealId, reasonCode);

    this.logger.log(`✅ Deal ${dealId} revoked by ${phone}`);
    return txHash;
  }

  /**
   * Cancel deal before funds locked
   */
  async cancelBeforeLock(
    phone: string,
    dealId: number,
    pin: string,
  ): Promise<string> {
    await this.authService.verifyPin(phone, pin);

    const deal = await this.prisma.deal.findUnique({ where: { dealId } });
    if (!deal) throw new BadRequestException('Deal not found');
    if (deal.senderPhone !== phone && deal.receiverPhone !== phone) {
      throw new BadRequestException('Only sender or receiver can cancel');
    }

    const wallet = await this.walletsService.getWallet(phone);
    const txHash = await this.contractsService.cancelBeforeLockOnChain(wallet, dealId);

    this.logger.log(`✅ Deal ${dealId} cancelled by ${phone}`);
    return txHash;
  }

  /**
   * Get active deals for a phone number (role-segmented)
   */
  async getActiveDealsForPhone(phoneNumber: string): Promise<any> {
    const deals = await this.prisma.deal.findMany({
      where: {
        OR: [
          { senderPhone: phoneNumber },
          { driverPhone: phoneNumber },
          { receiverPhone: phoneNumber },
        ],
        status: {
          notIn: [DealStatus.Released, DealStatus.Cancelled, DealStatus.Resolved],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Segment by role
    return {
      asSeller: deals.filter(d => d.senderPhone === phoneNumber).map(this.formatDealSummary),
      asDriver: deals.filter(d => d.driverPhone === phoneNumber).map(this.formatDealSummary),
      asBuyer: deals.filter(d => d.receiverPhone === phoneNumber).map(this.formatDealSummary),
    };
  }

  /**
   * Get full deal details
   */
  async getDealDetails(dealId: number): Promise<any> {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
      include: {
        actionLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });

    if (!deal) throw new BadRequestException('Deal not found');

    return deal;
  }

  /**
   * Format deal for summary display
   */
  private formatDealSummary(deal: any): any {
    return {
      dealId: deal.dealId,
      amount: deal.amount.toString(),
      status: deal.status,
      createdAt: deal.createdAt,
      counterparties: {
        sender: deal.senderPhone,
        driver: deal.driverPhone,
        receiver: deal.receiverPhone,
      },
    };
  }
}
