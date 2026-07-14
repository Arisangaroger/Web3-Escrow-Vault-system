/**
 * Demo seed (Polygon Amoy): creates users (ENCRYPTION_KEY wallets + PINs),
 * mints eRWF to buyers, and drives real on-chain deals into
 * Created / FundsLocked / Shipped / Delivered / Disputed.
 *
 * Prerequisites: Amoy Escrow + eRWF deployed; backend/.env filled (CHAIN_ID=80002).
 * Prefer: npm run reset:demo && npm run seed:demo
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DealStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/db/prisma.service';
import { WalletsService } from '../src/modules/wallets/wallets.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { DealsService } from '../src/modules/services/deals.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';

const DEMO_USERS = [
  {
    name: 'Musanze Cooperative',
    phone: '+250788100001',
    pin: '1111',
    role: 'Farmer/Sender',
  },
  {
    name: 'Kigali Fresh Market',
    phone: '+250788200002',
    pin: '2222',
    role: 'Buyer/Receiver',
  },
  {
    name: 'Driver James',
    phone: '+250788300003',
    pin: '3333',
    role: 'Driver',
  },
  {
    name: 'Huye Farmer',
    phone: '+250788100004',
    pin: '4444',
    role: 'Farmer/Sender',
  },
  {
    name: 'Rubavu Market',
    phone: '+250788200005',
    pin: '5555',
    role: 'Buyer/Receiver',
  },
] as const;

const DEMO_PHONES = DEMO_USERS.map((u) => u.phone);
const BUYER_PHONES = ['+250788200002', '+250788200005'];
const MINT_AMOUNT = '10000000'; // eRWF per buyer

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function clearDemoData(prisma: PrismaService) {
  const deals = await prisma.deal.findMany({
    where: {
      OR: [
        { senderPhone: { in: DEMO_PHONES } },
        { driverPhone: { in: DEMO_PHONES } },
        { receiverPhone: { in: DEMO_PHONES } },
      ],
    },
    select: { dealId: true },
  });
  const dealIds = deals.map((d) => d.dealId);

  if (dealIds.length > 0) {
    await prisma.dealActionLog.deleteMany({ where: { dealId: { in: dealIds } } });
    await prisma.notificationLog.deleteMany({ where: { dealId: { in: dealIds } } });
    await prisma.deal.deleteMany({ where: { dealId: { in: dealIds } } });
  }

  await prisma.notificationLog.deleteMany({
    where: { recipientPhone: { in: DEMO_PHONES } },
  });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: DEMO_PHONES } } });
}

async function logAction(
  prisma: PrismaService,
  dealId: number,
  actorPhone: string,
  action: string,
  txHash: string,
) {
  await prisma.dealActionLog.create({
    data: { dealId, actorPhone, action, txHash, timestamp: new Date() },
  });
}

async function setStatus(
  prisma: PrismaService,
  dealId: number,
  status: DealStatus,
  extra: Record<string, unknown> = {},
) {
  await prisma.deal.update({
    where: { dealId },
    data: { status, ...extra },
  });
}

async function main() {
  console.log('🌱 Seeding demo data on Amoy (on-chain + DB)...\n');

  const required = [
    'DATABASE_URL',
    'RPC_URL',
    'CHAIN_ID',
    'ESCROW_CONTRACT_ADDRESS',
    'ERWF_CONTRACT_ADDRESS',
    'TREASURY_PRIVATE_KEY',
    'ENCRYPTION_KEY',
    'PIN_PEPPER',
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(', ')}. Fill backend/.env first.`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const wallets = app.get(WalletsService);
  const auth = app.get(AuthService);
  const deals = app.get(DealsService);
  const contracts = app.get(ContractsService);
  const chainId = contracts.getChainId();

  if (chainId !== 80002) {
    console.warn(
      `  ⚠️  CHAIN_ID=${chainId} (expected 80002 Amoy). Continuing with configured network.\n`,
    );
  }

  try {
    console.log('Clearing previous demo users/deals...');
    await clearDemoData(prisma);
    console.log('  ✅ Cleared\n');

    // 1. Users with custodial wallets encrypted by ENCRYPTION_KEY
    console.log('Creating demo users (ENCRYPTION_KEY wallets + PINs)...');
    for (const user of DEMO_USERS) {
      await wallets.getOrCreateWallet(user.phone);
      await auth.setPin(user.phone, user.pin);
      const address = await wallets.getWalletAddress(user.phone);
      console.log(`  ✅ ${user.name} ${user.phone} PIN ${user.pin} → ${address}`);
    }

    // 2. Mint eRWF to buyers so lockFunds can succeed
    console.log(`\nMinting ${MINT_AMOUNT} eRWF to demo buyers...`);
    for (const phone of BUYER_PHONES) {
      const address = await wallets.getWalletAddress(phone);
      const txHash = await contracts.mintTokens(address, MINT_AMOUNT);
      console.log(`  ✅ Minted to ${phone} (${address}) tx=${txHash}`);
    }

    // 3. On-chain deals + DB rows in five lifecycle states
    console.log('\nCreating on-chain deals...\n');

    // --- Deal A: Created (awaiting fund lock) ---
    const a = await deals.createDeal(
      DEMO_USERS[0].phone,
      DEMO_USERS[2].phone,
      DEMO_USERS[1].phone,
      '300000',
      DEMO_USERS[0].pin,
    );
    await logAction(prisma, a.dealId, DEMO_USERS[0].phone, 'DealCreated', a.txHash);
    console.log(`  ✅ Deal #${a.dealId}: Created (awaiting fund lock)`);

    // --- Deal B: FundsLocked ---
    const b = await deals.createDeal(
      DEMO_USERS[3].phone,
      DEMO_USERS[2].phone,
      DEMO_USERS[4].phone,
      '500000',
      DEMO_USERS[3].pin,
    );
    const bLock = await deals.lockFunds(
      DEMO_USERS[4].phone,
      b.dealId,
      DEMO_USERS[4].pin,
    );
    await setStatus(prisma, b.dealId, DealStatus.FundsLocked);
    await logAction(prisma, b.dealId, DEMO_USERS[4].phone, 'FundsLocked', bLock);
    console.log(`  ✅ Deal #${b.dealId}: FundsLocked (ready to ship)`);

    // --- Deal C: Shipped ---
    const c = await deals.createDeal(
      DEMO_USERS[0].phone,
      DEMO_USERS[2].phone,
      DEMO_USERS[4].phone,
      '450000',
      DEMO_USERS[0].pin,
    );
    const cLock = await deals.lockFunds(
      DEMO_USERS[4].phone,
      c.dealId,
      DEMO_USERS[4].pin,
    );
    await setStatus(prisma, c.dealId, DealStatus.FundsLocked);
    await logAction(prisma, c.dealId, DEMO_USERS[4].phone, 'FundsLocked', cLock);
    const cShip = await deals.markShipped(
      DEMO_USERS[0].phone,
      c.dealId,
      DEMO_USERS[0].pin,
    );
    await setStatus(prisma, c.dealId, DealStatus.Shipped);
    await logAction(prisma, c.dealId, DEMO_USERS[0].phone, 'MarkedShipped', cShip);
    console.log(`  ✅ Deal #${c.dealId}: Shipped (in transit)`);

    // --- Deal D: Delivered (~3h dispute window on Amoy) ---
    const d = await deals.createDeal(
      DEMO_USERS[3].phone,
      DEMO_USERS[2].phone,
      DEMO_USERS[1].phone,
      '600000',
      DEMO_USERS[3].pin,
    );
    const dLock = await deals.lockFunds(
      DEMO_USERS[1].phone,
      d.dealId,
      DEMO_USERS[1].pin,
    );
    await setStatus(prisma, d.dealId, DealStatus.FundsLocked);
    await logAction(prisma, d.dealId, DEMO_USERS[1].phone, 'FundsLocked', dLock);
    const dShip = await deals.markShipped(
      DEMO_USERS[3].phone,
      d.dealId,
      DEMO_USERS[3].pin,
    );
    await setStatus(prisma, d.dealId, DealStatus.Shipped);
    await logAction(prisma, d.dealId, DEMO_USERS[3].phone, 'MarkedShipped', dShip);
    const dDel = await deals.markDelivered(
      DEMO_USERS[2].phone,
      d.dealId,
      DEMO_USERS[2].pin,
    );

    const onChain = await contracts.getDealFromChain(d.dealId);
    const payoutReadyTime = new Date(Number(onChain.payoutReadyTime) * 1000);
    await setStatus(prisma, d.dealId, DealStatus.Delivered, { payoutReadyTime });
    await logAction(prisma, d.dealId, DEMO_USERS[2].phone, 'MarkedDelivered', dDel);
    console.log(
      `  ✅ Deal #${d.dealId}: Delivered (~3h dispute window; payoutReadyTime=${payoutReadyTime.toISOString()})`,
    );

    // --- Deal E: Disputed (admin portal) ---
    const e = await deals.createDeal(
      DEMO_USERS[0].phone,
      DEMO_USERS[2].phone,
      DEMO_USERS[1].phone,
      '400000',
      DEMO_USERS[0].pin,
    );
    const eLock = await deals.lockFunds(
      DEMO_USERS[1].phone,
      e.dealId,
      DEMO_USERS[1].pin,
    );
    await setStatus(prisma, e.dealId, DealStatus.FundsLocked);
    await logAction(prisma, e.dealId, DEMO_USERS[1].phone, 'FundsLocked', eLock);
    const eShip = await deals.markShipped(
      DEMO_USERS[0].phone,
      e.dealId,
      DEMO_USERS[0].pin,
    );
    await setStatus(prisma, e.dealId, DealStatus.Shipped);
    await logAction(prisma, e.dealId, DEMO_USERS[0].phone, 'MarkedShipped', eShip);
    const eDel = await deals.markDelivered(
      DEMO_USERS[2].phone,
      e.dealId,
      DEMO_USERS[2].pin,
    );
    await setStatus(prisma, e.dealId, DealStatus.Delivered);
    await logAction(prisma, e.dealId, DEMO_USERS[2].phone, 'MarkedDelivered', eDel);
    // Brief pause so "early deliver" timeline still makes sense in portal
    await sleep(500);
    const eRevoke = await deals.revoke(
      DEMO_USERS[1].phone,
      e.dealId,
      1,
      DEMO_USERS[1].pin,
    );
    await setStatus(prisma, e.dealId, DealStatus.Disputed, {
      disputeReasonCode: 1,
    });
    await logAction(prisma, e.dealId, DEMO_USERS[1].phone, 'Revoked', eRevoke);
    console.log(`  ✅ Deal #${e.dealId}: Disputed (ready for admin resolution)`);

    console.log('\n✅ Demo seed complete (chain + DB).\n');
    console.log('📋 Credentials');
    console.log('─'.repeat(64));
    DEMO_USERS.forEach((u) => {
      console.log(`${u.name.padEnd(25)} ${u.phone.padEnd(16)} PIN ${u.pin}  [${u.role}]`);
    });
    console.log('─'.repeat(64));
    console.log('\nDeals:');
    console.log(`  #${a.dealId} Created`);
    console.log(`  #${b.dealId} FundsLocked`);
    console.log(`  #${c.dealId} Shipped`);
    console.log(`  #${d.dealId} Delivered`);
    console.log(`  #${e.dealId} Disputed`);
    console.log('\nSee DEMO_CREDENTIALS.md for the walkthrough.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
