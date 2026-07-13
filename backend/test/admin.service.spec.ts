import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AdminService } from '../src/modules/admin/admin.service';
import { PrismaService } from '../src/modules/db/prisma.service';
import { WalletsService } from '../src/modules/wallets/wallets.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { ResolutionOutcome } from '../src/modules/admin/dto/resolve-dispute.dto';
import * as argon2 from 'argon2';

describe('AdminService', () => {
  let service: AdminService;
  let prismaService: PrismaService;
  let contractsService: ContractsService;

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
    prismaService = module.get<PrismaService>(PrismaService);
    contractsService = module.get<ContractsService>(ContractsService);

    // Clear all mocks before each test
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
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.admin.update.mockResolvedValue({
        ...mockAdmin,
        lastLoginAt: new Date(),
      });

      const result = await service.login('admin@test.com', 'password123');

      expect(result).toHaveProperty('token');
      expect(result.admin.email).toBe('admin@test.com');
      expect(mockPrismaService.admin.update).toHaveBeenCalled();
    });

    it('should reject login with incorrect password', async () => {
      const mockAdmin = {
        adminId: 1,
        email: 'admin@test.com',
        passwordHash: await argon2.hash('password123'),
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);

      await expect(
        service.login('admin@test.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login for non-existent admin', async () => {
      mockPrismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
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
      mockContractsService.resolveDisputeOnChain.mockResolvedValue(
        '0xtxhash',
      );
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
      const mockAdmin = {
        adminId: 1,
        email: 'admin@test.com',
      };

      const mockDeal = {
        dealId: 1,
        status: 'Released', // Not disputed
      };

      mockPrismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

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
