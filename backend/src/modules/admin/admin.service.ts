import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { ContractsService } from '../contracts/contracts.service';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { ResolutionOutcome } from './dto/resolve-dispute.dto';
import { LoggerService } from '../../common/logger.service';

export type AdminSessionPayload = {
  adminId: number;
  email: string;
  walletAddress: string;
  lastActivity: number;
  sessionStartedAt: number;
};

@Injectable()
export class AdminService {
  private readonly logger = new LoggerService(AdminService.name);
  private readonly jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';
  /** Absolute session ceiling (hard max). */
  private readonly jwtExpiresIn: jwt.SignOptions['expiresIn'] =
    (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '8h';
  private readonly absoluteSessionMs = Number(process.env.ADMIN_SESSION_MAX_MS) || 8 * 60 * 60 * 1000;
  /** Idle timeout — refreshed on each authenticated request. */
  private readonly idleTimeoutMs =
    Number(process.env.ADMIN_IDLE_TIMEOUT_MS) || 30 * 60 * 1000;
  private readonly maxFailedAttempts = Number(process.env.ADMIN_MAX_FAILED_ATTEMPTS) || 5;
  private readonly lockoutMs = Number(process.env.ADMIN_LOCKOUT_MS) || 15 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private contractsService: ContractsService,
  ) {}

  getCookieMaxAgeMs(): number {
    return this.absoluteSessionMs;
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: this.absoluteSessionMs,
    };
  }

  /**
   * Admin login with email and password.
   * Account is locked after N consecutive failures for LOCKOUT_MS.
   */
  async login(email: string, password: string): Promise<{ token: string; admin: any }> {
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil(
        (admin.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account locked due to too many failed logins. Try again in ${minutesLeft} minute(s).`,
      );
    }

    const isValidPassword = await argon2.verify(admin.passwordHash, password);

    if (!isValidPassword) {
      const attempts = admin.failedLoginAttempts + 1;
      const lockData =
        attempts >= this.maxFailedAttempts
          ? {
              failedLoginAttempts: attempts,
              lockedUntil: new Date(Date.now() + this.lockoutMs),
            }
          : { failedLoginAttempts: attempts, lockedUntil: null };

      await this.prisma.admin.update({
        where: { adminId: admin.adminId },
        data: lockData,
      });

      if (attempts >= this.maxFailedAttempts) {
        const minutes = Math.ceil(this.lockoutMs / 60000);
        throw new UnauthorizedException(
          `Account locked due to too many failed logins. Try again in ${minutes} minute(s).`,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful login — clear lockout counters
    await this.prisma.admin.update({
      where: { adminId: admin.adminId },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const now = Date.now();
    const token = this.signSession({
      adminId: admin.adminId,
      email: admin.email,
      walletAddress: admin.walletAddress,
      lastActivity: now,
      sessionStartedAt: now,
    });

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
   * Verify JWT, enforce idle + absolute session limits, and issue a refreshed token.
   */
  async verifyAndRefreshToken(
    token: string,
  ): Promise<{ admin: any; token: string }> {
    let decoded: AdminSessionPayload;

    try {
      decoded = jwt.verify(token, this.jwtSecret) as AdminSessionPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const now = Date.now();

    if (
      !decoded.lastActivity ||
      now - decoded.lastActivity > this.idleTimeoutMs
    ) {
      throw new UnauthorizedException(
        'Session expired due to inactivity. Please log in again.',
      );
    }

    if (
      !decoded.sessionStartedAt ||
      now - decoded.sessionStartedAt > this.absoluteSessionMs
    ) {
      throw new UnauthorizedException(
        'Session expired. Please log in again.',
      );
    }

    const admin = await this.prisma.admin.findUnique({
      where: { adminId: decoded.adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    if (admin.lockedUntil && admin.lockedUntil.getTime() > now) {
      throw new UnauthorizedException('Account is locked');
    }

    const refreshedToken = this.signSession({
      adminId: admin.adminId,
      email: admin.email,
      walletAddress: admin.walletAddress,
      lastActivity: now,
      sessionStartedAt: decoded.sessionStartedAt,
    });

    return {
      token: refreshedToken,
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        email: admin.email,
        walletAddress: admin.walletAddress,
      },
    };
  }

  /**
   * Verify JWT token and return admin info (no refresh — prefer verifyAndRefreshToken).
   */
  async verifyToken(token: string): Promise<any> {
    const { admin } = await this.verifyAndRefreshToken(token);
    return admin;
  }

  private signSession(payload: AdminSessionPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
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
        adminEmail: log.adminEmail,
        actorName: log.actor?.phoneNumber || log.adminEmail || 'system',
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
   * Resolve a dispute — on-chain tx is signed by the relay wallet (ADMIN_ROLE holder).
   */
  async resolveDispute(
    adminId: number,
    dealId: number,
    outcome: ResolutionOutcome,
  ): Promise<{ txHash: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) {
      throw new BadRequestException('Deal not found');
    }

    if (deal.status !== 'Disputed') {
      throw new BadRequestException('Deal is not in disputed status');
    }

    const amount = deal.amount.toString();
    let amountToSender = '0';
    let amountToReceiver = '0';

    switch (outcome) {
      case ResolutionOutcome.DRIVER_FRAUD:
      case ResolutionOutcome.FAULTY_GOODS:
        amountToReceiver = amount;
        amountToSender = '0';
        break;

      case ResolutionOutcome.FALSE_BUYER_CLAIM:
        amountToSender = amount;
        amountToReceiver = '0';
        break;
    }

    this.logger.log(
      `Resolving dispute ${dealId}: ${outcome} - Sender: ${amountToSender}, Receiver: ${amountToReceiver}`,
    );

    // On-chain: onlyRole(ADMIN_ROLE). Relay/treasury wallet (deployer) holds that role.
    const txHash = await this.contractsService.resolveDisputeOnChain(
      dealId,
      amountToSender,
      amountToReceiver,
    );

    // Optimistic local status — do not wait for the chain event listener (~30s).
    // Listener remains idempotent and still drives SMS notifications.
    await this.prisma.deal.update({
      where: { dealId },
      data: { status: 'Resolved' },
    });

    // Audit which portal admin decided (identity ≠ relay signer).
    await this.prisma.dealActionLog.create({
      data: {
        dealId,
        actorPhone: null,
        adminEmail: admin.email,
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
        disputeReasonCode: { not: null },
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
      resolvedBy:
        deal.actionLogs[0]?.adminEmail ||
        deal.actionLogs[0]?.actorPhone ||
        'Unknown',
      resolutionOutcome:
        deal.actionLogs[0]?.action.replace('AdminResolution_', '') || 'Unknown',
      resolvedAt: deal.actionLogs[0]?.timestamp,
      status: deal.status,
    }));
  }

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
