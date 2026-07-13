import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { ContractsService } from '../contracts/contracts.service';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { ResolutionOutcome } from './dto/resolve-dispute.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';
  private readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';

  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private contractsService: ContractsService,
  ) {}

  /**
   * Admin login with email and password
   */
  async login(email: string, password: string): Promise<{ token: string; admin: any }> {
    // Find admin by email
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await argon2.verify(admin.passwordHash, password);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.admin.update({
      where: { adminId: admin.adminId },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        adminId: admin.adminId,
        email: admin.email,
        walletAddress: admin.walletAddress,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn },
    );

    return {
      token,
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        email: admin.email,
        walletAddress: admin.walletAddress,
      },
    };
  }

  /**
   * Verify JWT token and return admin info
   */
  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      const admin = await this.prisma.admin.findUnique({
        where: { adminId: decoded.adminId },
      });

      if (!admin) {
        throw new UnauthorizedException('Admin not found');
      }

      return {
        adminId: admin.adminId,
        name: admin.name,
        email: admin.email,
        walletAddress: admin.walletAddress,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get all disputed deals
   */
  async getDisputedDeals() {
    const deals = await this.prisma.deal.findMany({
      where: { status: 'Disputed' },
      include: {
        sender: true,
        driver: true,
        receiver: true,
      },
      orderBy: { createdAt: 'asc' }, // Oldest first
    });

    return deals.map((deal) => ({
      dealId: deal.dealId,
      amount: deal.amount.toString(),
      senderPhone: deal.senderPhone,
      driverPhone: deal.driverPhone,
      receiverPhone: deal.receiverPhone,
      disputeReasonCode: deal.disputeReasonCode,
      disputeReasonText: this.getDisputeReasonText(deal.disputeReasonCode),
      createdAt: deal.createdAt,
      status: deal.status,
    }));
  }

  /**
   * Get detailed information about a disputed deal
   */
  async getDisputeDetail(dealId: number) {
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
      include: {
        sender: true,
        driver: true,
        receiver: true,
        actionLogs: {
          orderBy: { timestamp: 'asc' },
          include: { actor: true },
        },
        notifications: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!deal) {
      throw new BadRequestException('Deal not found');
    }

    if (deal.status !== 'Disputed') {
      throw new BadRequestException('Deal is not in disputed status');
    }

    return {
      dealId: deal.dealId,
      amount: deal.amount.toString(),
      status: deal.status,
      senderPhone: deal.senderPhone,
      driverPhone: deal.driverPhone,
      receiverPhone: deal.receiverPhone,
      disputeReasonCode: deal.disputeReasonCode,
      disputeReasonText: this.getDisputeReasonText(deal.disputeReasonCode),
      createdAt: deal.createdAt,
      fundLockDeadline: deal.fundLockDeadline,
      payoutReadyTime: deal.payoutReadyTime,
      timeline: deal.actionLogs.map((log) => ({
        action: log.action,
        actorPhone: log.actorPhone,
        actorName: log.actor.phoneNumber, // Could enhance with names if stored
        timestamp: log.timestamp,
        txHash: log.txHash,
      })),
      notifications: deal.notifications.map((notif) => ({
        recipientPhone: notif.recipientPhone,
        message: notif.message,
        sentAt: notif.sentAt,
      })),
    };
  }

  /**
   * Resolve a dispute with admin decision
   * Uses relay wallet pattern: admin signs, relay submits
   */
  async resolveDispute(
    adminId: number,
    dealId: number,
    outcome: ResolutionOutcome,
  ): Promise<{ txHash: string }> {
    // Get admin info
    const admin = await this.prisma.admin.findUnique({
      where: { adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    // Get deal info
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) {
      throw new BadRequestException('Deal not found');
    }

    if (deal.status !== 'Disputed') {
      throw new BadRequestException('Deal is not in disputed status');
    }

    // Calculate resolution amounts based on outcome
    const amount = deal.amount.toString();
    let amountToSender = '0';
    let amountToReceiver = '0';

    switch (outcome) {
      case ResolutionOutcome.DRIVER_FRAUD:
      case ResolutionOutcome.FAULTY_GOODS:
        // Refund buyer (receiver)
        amountToReceiver = amount;
        amountToSender = '0';
        break;

      case ResolutionOutcome.FALSE_BUYER_CLAIM:
        // Pay farmer (sender)
        amountToSender = amount;
        amountToReceiver = '0';
        break;
    }

    this.logger.log(
      `Resolving dispute ${dealId}: ${outcome} - Sender: ${amountToSender}, Receiver: ${amountToReceiver}`,
    );

    // Execute resolution on-chain using relay wallet pattern
    // Note: resolveDispute doesn't use meta-transactions (no signature param)
    // It uses direct role-based access control (onlyRole(ADMIN_ROLE))
    // The relay wallet submits the transaction, but it must have ADMIN_ROLE
    const txHash = await this.contractsService.resolveDisputeOnChain(
      dealId,
      amountToSender,
      amountToReceiver,
    );

    // Log admin action for audit trail
    await this.prisma.dealActionLog.create({
      data: {
        dealId,
        actorPhone: admin.email, // Use email as identifier for admin
        action: `AdminResolution_${outcome}`,
        timestamp: new Date(),
        txHash,
      },
    });

    this.logger.log(`Dispute ${dealId} resolved by admin ${admin.name}: ${txHash}`);

    return { txHash };
  }

  /**
   * Get resolved disputes history
   */
  async getResolvedDisputes() {
    const deals = await this.prisma.deal.findMany({
      where: {
        status: { in: ['Released', 'Resolved'] },
        disputeReasonCode: { not: null }, // Only deals that were disputed
      },
      include: {
        sender: true,
        driver: true,
        receiver: true,
        actionLogs: {
          where: {
            action: {
              startsWith: 'AdminResolution_',
            },
          },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return deals.map((deal) => ({
      dealId: deal.dealId,
      amount: deal.amount.toString(),
      senderPhone: deal.senderPhone,
      driverPhone: deal.driverPhone,
      receiverPhone: deal.receiverPhone,
      disputeReasonCode: deal.disputeReasonCode,
      disputeReasonText: this.getDisputeReasonText(deal.disputeReasonCode),
      resolvedBy: deal.actionLogs[0]?.actorPhone || 'Unknown',
      resolutionOutcome: deal.actionLogs[0]?.action.replace('AdminResolution_', '') || 'Unknown',
      resolvedAt: deal.actionLogs[0]?.timestamp,
      status: deal.status,
    }));
  }

  /**
   * Helper: Map dispute reason code to text
   */
  private getDisputeReasonText(code: number | null): string {
    const reasons = {
      1: 'Goods not received',
      2: 'Wrong items delivered',
      3: 'Damaged goods',
      4: 'Quantity mismatch',
      5: 'Other',
    };
    return reasons[code] || 'Unknown';
  }
}
