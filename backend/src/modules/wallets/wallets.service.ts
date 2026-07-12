import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in environment');
    }
  }

  /**
   * Get or create a custodial wallet for a phone number
   */
  async getOrCreateWallet(phoneNumber: string): Promise<{ address: string; wallet: ethers.Wallet | ethers.HDNodeWallet }> {
    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (user) {
      // Decrypt and return existing wallet
      const wallet = await this.decryptWallet(user.encryptedPrivateKey);
      return { address: user.walletAddress, wallet };
    }

    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = await this.encryptWallet(wallet);

    // Create user record (PIN will be set separately)
    user = await this.prisma.user.create({
      data: {
        phoneNumber,
        walletAddress: wallet.address,
        encryptedPrivateKey,
        pinHash: '', // Must be set before first use
      },
    });

    this.logger.log(`✅ Created new wallet for ${phoneNumber}: ${wallet.address}`);
    return { address: wallet.address, wallet };
  }

  /**
   * Get wallet for existing user (throws if not found)
   */
  async getWallet(phoneNumber: string): Promise<ethers.Wallet | ethers.HDNodeWallet> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new Error(`User not found: ${phoneNumber}`);
    }

    return this.decryptWallet(user.encryptedPrivateKey);
  }

  /**
   * Get wallet address without decrypting private key
   */
  async getWalletAddress(phoneNumber: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new Error(`User not found: ${phoneNumber}`);
    }

    return user.walletAddress;
  }

  /**
   * Encrypt a wallet's private key using ethers.js wallet encryption
   */
  private async encryptWallet(wallet: ethers.Wallet | ethers.HDNodeWallet): Promise<string> {
    return wallet.encrypt(this.encryptionKey);
  }

  /**
   * Decrypt an encrypted wallet JSON keystore
   */
  private async decryptWallet(encryptedJson: string): Promise<ethers.Wallet | ethers.HDNodeWallet> {
    return ethers.Wallet.fromEncryptedJson(encryptedJson, this.encryptionKey);
  }

  /**
   * Check if user has been initialized (wallet + PIN set)
   */
  async isUserInitialized(phoneNumber: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: { pinHash: true },
    });

    return user && user.pinHash !== '';
  }
}
