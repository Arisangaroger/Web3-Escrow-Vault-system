import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../db/prisma.service';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class AuthService {
  private readonly logger = new LoggerService(AuthService.name);
  private readonly pinPepper: string;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 15;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.pinPepper = this.configService.get<string>('PIN_PEPPER');
    if (!this.pinPepper) {
      throw new Error('PIN_PEPPER must be set in environment');
    }
  }

  /**
   * Set PIN for a user (first-time setup)
   */
  async setPin(phoneNumber: string, pin: string): Promise<void> {
    this.validatePin(pin);

    const pepperedPin = this.pepperPin(pin);
    const pinHash = await argon2.hash(pepperedPin, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { phoneNumber },
      data: {
        pinHash,
        pinAttempts: 0,
        lockoutUntil: null,
      },
    });

    this.logger.log(`✅ PIN set for ${phoneNumber}`);
  }

  /**
   * Verify PIN with lockout protection
   */
  async verifyPin(phoneNumber: string, pin: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check lockout first
    if (user.lockoutUntil && new Date() < user.lockoutUntil) {
      const remainingMinutes = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 60000
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${remainingMinutes} minute(s)`
      );
    }

    // Clear lockout if expired
    if (user.lockoutUntil && new Date() >= user.lockoutUntil) {
      await this.prisma.user.update({
        where: { phoneNumber },
        data: {
          lockoutUntil: null,
          pinAttempts: 0,
        },
      });
    }

    // Verify PIN
    const pepperedPin = this.pepperPin(pin);
    const isValid = await argon2.verify(user.pinHash, pepperedPin);

    if (!isValid) {
      // Increment failed attempts
      const newAttempts = user.pinAttempts + 1;
      const updateData: any = { pinAttempts: newAttempts };

      // Lock account after 5 failed attempts
      if (newAttempts >= this.MAX_ATTEMPTS) {
        updateData.lockoutUntil = new Date(
          Date.now() + this.LOCKOUT_MINUTES * 60 * 1000
        );
        this.logger.warn(
          `🔒 Account locked for ${phoneNumber} after ${newAttempts} failed attempts`
        );
      }

      await this.prisma.user.update({
        where: { phoneNumber },
        data: updateData,
      });

      throw new UnauthorizedException(
        `Invalid PIN. ${this.MAX_ATTEMPTS - newAttempts} attempt(s) remaining`
      );
    }

    // Success - reset attempts
    await this.prisma.user.update({
      where: { phoneNumber },
      data: {
        pinAttempts: 0,
        lockoutUntil: null,
      },
    });

    return true;
  }

  /**
   * Check if user has PIN set
   */
  async hasPinSet(phoneNumber: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: { pinHash: true },
    });

    return user && user.pinHash !== '';
  }

  /**
   * Add pepper to PIN for additional security
   */
  private pepperPin(pin: string): string {
    return `${pin}${this.pinPepper}`;
  }

  /**
   * Validate PIN format (4 digits)
   */
  private validatePin(pin: string): void {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits');
    }
  }
}
