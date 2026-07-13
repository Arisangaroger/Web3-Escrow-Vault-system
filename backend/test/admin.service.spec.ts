import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AdminService } from '../src/modules/admin/admin.service';
import { PrismaService } from '../src/modules/db/prisma.service';
import { WalletsService } from '../src/modules/wallets/wallets.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { ResolutionOutcome } from '../src/modules/admin/dto/resolve-dispute.dto';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
    admin: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    dealActionLog: {
      create: jest.fn(),
    },
  };

  const mockWalletsService = {};

  const mockContractsService = {
    resolveDisputeOnChain: jest.fn(),
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_IDLE_TIMEOUT_MS = String(30 * 60 * 1000);
    process.env.ADMIN_SESSION_MAX_MS = String(8 * 60 * 60 * 1000);
    process.env.ADMIN_MAX_FAILED_ATTEMPTS = '5';
    process.env.ADMIN_LOCKOUT_MS = String(15 * 60 * 1000);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WalletsService,
          useValue: mockWalletsService,
        },
        {
          provide: ContractsService,
          useValue: mockContractsService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with correct credentials', async () => {
      const mockAdmin = {
        adminId: 1,
        name: 'Test Admin',
        email: 'admin@test.com',
        passwordHash: await argon2.hash('password123'),
        walletAddress: '0x123',
        createdAt: new Date(),
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.admin.update.mockResolvedValue({
        ...mockAdmin,
        lastLoginAt: new Date(),
      });

      const result = await service.login('admin@test.com', 'password123');

      expect(result).toHaveProperty('token');
      expect(result.admin.email).toBe('admin@test.com');
      expect(mockPrismaService.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    it('should reject login with incorrect password and increment attempts', async () => {
      const mockAdmin = {
        adminId: 1,
        email: 'admin@test.com',
        passwordHash: await argon2.hash('password123'),
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.admin.update.mockResolvedValue({
        ...mockAdmin,
        failedLoginAttempts: 1,
      });

      await expect(
        service.login('admin@test.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });

    it('should lock account after max failed attempts', async () => {
      const mockAdmin = {
        adminId: 1,
        email: 'admin@test.com',
        passwordHash: await argon2.hash('password123'),
        failedLoginAttempts: 4,
        lockedUntil: null,
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.admin.update.mockResolvedValue({});

      await expect(
        service.login('admin@test.com', 'wrongpassword'),
      ).rejects.toThrow(/locked/i);

      expect(mockPrismaService.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject login while account is locked', async () => {
      const mockAdmin = {
        adminId: 1,
        email: 'admin@test.com',
        passwordHash: await argon2.hash('password123'),
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);

      await expect(
        service.login('admin@test.com', 'password123'),
      ).rejects.toThrow(/locked/i);

      expect(mockPrismaService.admin.update).not.toHaveBeenCalled();
    });

    it('should reject login for non-existent admin', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyAndRefreshToken', () => {
    it('should refresh an active session token', async () => {
      const now = Date.now();
      const token = jwt.sign(
        {
          adminId: 1,
          email: 'admin@test.com',
          walletAddress: '0x123',
          lastActivity: now - 60_000,
          sessionStartedAt: now - 120_000,
        },
        'test-secret',
        { expiresIn: '8h' },
      );

      mockPrismaService.admin.findUnique.mockResolvedValue({
        adminId: 1,
        name: 'Test Admin',
        email: 'admin@test.com',
        walletAddress: '0x123',
        lockedUntil: null,
      });

      const result = await service.verifyAndRefreshToken(token);

      expect(result.admin.email).toBe('admin@test.com');
      expect(result.token).toBeDefined();
      const decoded = jwt.verify(result.token, 'test-secret') as any;
      expect(decoded.lastActivity).toBeGreaterThan(now - 60_000);
      expect(decoded.sessionStartedAt).toBe(now - 120_000);
    });

    it('should reject idle sessions', async () => {
      const now = Date.now();
      const token = jwt.sign(
        {
          adminId: 1,
          email: 'admin@test.com',
          walletAddress: '0x123',
          lastActivity: now - 31 * 60 * 1000,
          sessionStartedAt: now - 60 * 60 * 1000,
        },
        'test-secret',
        { expiresIn: '8h' },
      );

      await expect(service.verifyAndRefreshToken(token)).rejects.toThrow(
        /inactivity/i,
      );
    });
  });

  describe('getDisputedDeals', () => {
    it('should return all disputed deals', async () => {
      const mockDeals = [
        {
          dealId: 1,
          amount: 500000n,
          status: 'Disputed',
          senderPhone: '+250788111111',
          driverPhone: '+250788222222',
          receiverPhone: '+250788333333',
          disputeReasonCode: 1,
          createdAt: new Date(),
          sender: { phoneNumber: '+250788111111' },
          driver: { phoneNumber: '+250788222222' },
          receiver: { phoneNumber: '+250788333333' },
        },
      ];

      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.getDisputedDeals();

      expect(result).toHaveLength(1);
      expect(result[0].dealId).toBe(1);
      expect(result[0].disputeReasonText).toBe('Goods not received');
    });
  });

  describe('resolveDispute', () => {
    it('should successfully resolve dispute with DRIVER_FRAUD', async () => {
      const mockAdmin = {
        adminId: 1,
        name: 'Test Admin',
        email: 'admin@test.com',
        walletAddress: '0x123',
      };

      const mockDeal = {
        dealId: 1,
        amount: 500000n,
        status: 'Disputed',
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockContractsService.resolveDisputeOnChain.mockResolvedValue('0xtxhash');
      mockPrismaService.dealActionLog.create.mockResolvedValue({});

      const result = await service.resolveDispute(
        1,
        1,
        ResolutionOutcome.DRIVER_FRAUD,
      );

      expect(result.txHash).toBe('0xtxhash');
      expect(mockContractsService.resolveDisputeOnChain).toHaveBeenCalledWith(
        1,
        '0',
        '500000',
      );
    });

    it('should reject resolution for non-disputed deal', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue({
        adminId: 1,
        email: 'admin@test.com',
      });
      mockPrismaService.deal.findUnique.mockResolvedValue({
        dealId: 1,
        status: 'Released',
      });

      await expect(
        service.resolveDispute(1, 1, ResolutionOutcome.DRIVER_FRAUD),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject resolution for non-existent admin', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveDispute(1, 1, ResolutionOutcome.DRIVER_FRAUD),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
