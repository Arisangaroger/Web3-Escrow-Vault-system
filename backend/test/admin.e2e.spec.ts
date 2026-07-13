import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/db/prisma.service';
import * as argon2 from 'argon2';

describe('Admin Portal E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test admin
    const passwordHash = await argon2.hash('testpassword123');
    await prisma.admin.create({
      data: {
        name: 'Test Admin',
        email: 'test@admin.com',
        passwordHash,
        walletAddress: '0xTestWalletAddress',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.admin.deleteMany({
      where: { email: 'test@admin.com' },
    });
    await app.close();
  });

  describe('Admin Authentication', () => {
    it('POST /admin/login - should login successfully', () => {
      return request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'test@admin.com',
          password: 'testpassword123',
        })
        .expect(200)
        .then((response) => {
          expect(response.body.success).toBe(true);
          expect(response.body.data.admin).toHaveProperty('email');
          expect(response.headers['set-cookie']).toBeDefined();
          
          // Extract token for subsequent requests
          const cookies = response.headers['set-cookie'];
          adminToken = cookies.find((c: string) => c.startsWith('admin_token='));
        });
    });

    it('POST /admin/login - should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'test@admin.com',
          password: 'wrongpassword',
        })
        .expect(200)
        .then((response) => {
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBeDefined();
        });
    });

    it('POST /admin/login - should validate email format', () => {
      return request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'invalid-email',
          password: 'testpassword123',
        })
        .expect(400);
    });

    it('POST /admin/login - should lock account after 5 failed attempts', async () => {
      let lastBody: any;

      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/admin/login')
          .send({
            email: 'test@admin.com',
            password: 'wrongpassword',
          });
        lastBody = response.body;
      }

      expect(lastBody.success).toBe(false);
      expect(lastBody.error).toMatch(/locked/i);

      // Even correct password should fail while locked
      const lockedLogin = await request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'test@admin.com',
          password: 'testpassword123',
        });

      expect(lockedLogin.body.success).toBe(false);
      expect(lockedLogin.body.error).toMatch(/locked/i);

      // Clear lock for subsequent tests
      await prisma.admin.update({
        where: { email: 'test@admin.com' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });
  });

  describe('Admin Authorization', () => {
    it('GET /admin/me - should require authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/me')
        .expect(401);
    });

    it('GET /admin/disputes - should require authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/disputes')
        .expect(401);
    });
  });

  describe('Dispute Management', () => {
    let testDealId: number;

    beforeAll(async () => {
      // Create test users
      const sender = await prisma.user.upsert({
        where: { phoneNumber: '+250788111111' },
        create: {
          phoneNumber: '+250788111111',
          walletAddress: '0xSender',
          encryptedPrivateKey: 'encrypted',
          pinHash: await argon2.hash('1234'),
        },
        update: {},
      });

      const driver = await prisma.user.upsert({
        where: { phoneNumber: '+250788222222' },
        create: {
          phoneNumber: '+250788222222',
          walletAddress: '0xDriver',
          encryptedPrivateKey: 'encrypted',
          pinHash: await argon2.hash('1234'),
        },
        update: {},
      });

      const receiver = await prisma.user.upsert({
        where: { phoneNumber: '+250788333333' },
        create: {
          phoneNumber: '+250788333333',
          walletAddress: '0xReceiver',
          encryptedPrivateKey: 'encrypted',
          pinHash: await argon2.hash('1234'),
        },
        update: {},
      });

      // Create test disputed deal
      const deal = await prisma.deal.create({
        data: {
          senderPhone: sender.phoneNumber,
          driverPhone: driver.phoneNumber,
          receiverPhone: receiver.phoneNumber,
          amount: 500000,
          status: 'Disputed',
          disputeReasonCode: 1,
          createdAt: new Date(),
          fundLockDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      testDealId = deal.dealId;
    });

    afterAll(async () => {
      // Cleanup
      await prisma.deal.deleteMany({
        where: { dealId: testDealId },
      });
      await prisma.user.deleteMany({
        where: {
          phoneNumber: {
            in: ['+250788111111', '+250788222222', '+250788333333'],
          },
        },
      });
    });

    it('GET /admin/disputes - should return disputed deals', async () => {
      // First login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'test@admin.com',
          password: 'testpassword123',
        });

      const cookies = loginResponse.headers['set-cookie'];

      return request(app.getHttpServer())
        .get('/admin/disputes')
        .set('Cookie', cookies)
        .expect(200)
        .then((response) => {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.data)).toBe(true);
          expect(response.body.data.length).toBeGreaterThan(0);
          
          const dispute = response.body.data.find(
            (d: any) => d.dealId === testDealId
          );
          expect(dispute).toBeDefined();
          expect(dispute.status).toBe('Disputed');
        });
    });

    it('GET /admin/disputes/:dealId - should return dispute detail', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'test@admin.com',
          password: 'testpassword123',
        });

      const cookies = loginResponse.headers['set-cookie'];

      return request(app.getHttpServer())
        .get(`/admin/disputes/${testDealId}`)
        .set('Cookie', cookies)
        .expect(200)
        .then((response) => {
          expect(response.body.success).toBe(true);
          expect(response.body.data.dealId).toBe(testDealId);
          expect(response.body.data.timeline).toBeDefined();
          expect(Array.isArray(response.body.data.timeline)).toBe(true);
        });
    });

    it('GET /admin/disputes/history - should return resolved disputes', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'test@admin.com',
          password: 'testpassword123',
        });

      const cookies = loginResponse.headers['set-cookie'];

      return request(app.getHttpServer())
        .get('/admin/disputes/history')
        .set('Cookie', cookies)
        .expect(200)
        .then((response) => {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.data)).toBe(true);
        });
    });
  });
});
