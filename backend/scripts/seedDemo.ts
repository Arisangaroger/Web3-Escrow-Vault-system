import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

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
];

async function main() {
  console.log('🌱 Seeding demo data...\n');

  const pepper = process.env.PIN_PEPPER || 'demo-pepper-change-in-production';

  // 1. Create demo users with wallets
  console.log('Creating demo users...');
  for (const user of DEMO_USERS) {
    const wallet = ethers.Wallet.createRandom();
    const encryptedKey = await wallet.encrypt('password');
    const pinHash = await argon2.hash(user.pin + pepper, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.upsert({
      where: { phoneNumber: user.phone },
      create: {
        phoneNumber: user.phone,
        walletAddress: wallet.address,
        encryptedPrivateKey: encryptedKey,
        pinHash,
      },
      update: {
        pinHash,
      },
    });

    console.log(`  ✅ ${user.name} (${user.phone}) - PIN: ${user.pin}`);
  }

  // 2. Create demo deals in various states
  console.log('\nCreating demo deals...');

  const now = new Date();
  const hour = 60 * 60 * 1000;

  // Deal 1: Created (awaiting fund lock)
  const deal1 = await prisma.deal.create({
    data: {
      senderPhone: DEMO_USERS[0].phone,
      driverPhone: DEMO_USERS[2].phone,
      receiverPhone: DEMO_USERS[1].phone,
      amount: 300000,
      status: 'Created',
      createdAt: new Date(now.getTime() - 2 * hour),
      fundLockDeadline: new Date(now.getTime() + 22 * hour), // 22 hours left
    },
  });
  console.log(`  ✅ Deal #${deal1.dealId}: Created (awaiting fund lock)`);

  // Deal 2: FundsLocked (ready to ship)
  const deal2 = await prisma.deal.create({
    data: {
      senderPhone: DEMO_USERS[3].phone,
      driverPhone: DEMO_USERS[2].phone,
      receiverPhone: DEMO_USERS[4].phone,
      amount: 500000,
      status: 'FundsLocked',
      createdAt: new Date(now.getTime() - 4 * hour),
      fundLockDeadline: new Date(now.getTime() + 20 * hour),
    },
  });
  console.log(`  ✅ Deal #${deal2.dealId}: FundsLocked (ready to ship)`);

  // Deal 3: Shipped (in transit)
  const deal3 = await prisma.deal.create({
    data: {
      senderPhone: DEMO_USERS[0].phone,
      driverPhone: DEMO_USERS[2].phone,
      receiverPhone: DEMO_USERS[4].phone,
      amount: 450000,
      status: 'Shipped',
      createdAt: new Date(now.getTime() - 6 * hour),
      fundLockDeadline: new Date(now.getTime() + 18 * hour),
    },
  });
  console.log(`  ✅ Deal #${deal3.dealId}: Shipped (in transit)`);

  // Deal 4: Delivered (near auto-release)
  const deal4 = await prisma.deal.create({
    data: {
      senderPhone: DEMO_USERS[3].phone,
      driverPhone: DEMO_USERS[2].phone,
      receiverPhone: DEMO_USERS[1].phone,
      amount: 600000,
      status: 'Delivered',
      createdAt: new Date(now.getTime() - 9 * hour),
      fundLockDeadline: new Date(now.getTime() + 15 * hour),
      payoutReadyTime: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes from now
    },
  });
  console.log(`  ✅ Deal #${deal4.dealId}: Delivered (auto-releases in 5 min)`);

  // Deal 5: Disputed (ready for admin)
  const deal5 = await prisma.deal.create({
    data: {
      senderPhone: DEMO_USERS[0].phone,
      driverPhone: DEMO_USERS[2].phone,
      receiverPhone: DEMO_USERS[1].phone,
      amount: 400000,
      status: 'Disputed',
      disputeReasonCode: 1,
      createdAt: new Date(now.getTime() - 12 * hour),
      fundLockDeadline: new Date(now.getTime() + 12 * hour),
    },
  });
  console.log(`  ✅ Deal #${deal5.dealId}: Disputed (ready for admin resolution)`);

  // 3. Create action logs for realistic timeline
  console.log('\nCreating action logs...');
  await prisma.dealActionLog.createMany({
    data: [
      {
        dealId: deal2.dealId,
        actorPhone: DEMO_USERS[4].phone,
        action: 'FundsLocked',
        timestamp: new Date(now.getTime() - 3.5 * hour),
      },
      {
        dealId: deal3.dealId,
        actorPhone: DEMO_USERS[4].phone,
        action: 'FundsLocked',
        timestamp: new Date(now.getTime() - 5.5 * hour),
      },
      {
        dealId: deal3.dealId,
        actorPhone: DEMO_USERS[0].phone,
        action: 'MarkedShipped',
        timestamp: new Date(now.getTime() - 5 * hour),
      },
      {
        dealId: deal4.dealId,
        actorPhone: DEMO_USERS[1].phone,
        action: 'FundsLocked',
        timestamp: new Date(now.getTime() - 8.5 * hour),
      },
      {
        dealId: deal4.dealId,
        actorPhone: DEMO_USERS[3].phone,
        action: 'MarkedShipped',
        timestamp: new Date(now.getTime() - 8 * hour),
      },
      {
        dealId: deal4.dealId,
        actorPhone: DEMO_USERS[2].phone,
        action: 'MarkedDelivered',
        timestamp: new Date(now.getTime() - 3 * hour),
      },
      {
        dealId: deal5.dealId,
        actorPhone: DEMO_USERS[1].phone,
        action: 'FundsLocked',
        timestamp: new Date(now.getTime() - 11.5 * hour),
      },
      {
        dealId: deal5.dealId,
        actorPhone: DEMO_USERS[0].phone,
        action: 'MarkedShipped',
        timestamp: new Date(now.getTime() - 11 * hour),
      },
      {
        dealId: deal5.dealId,
        actorPhone: DEMO_USERS[2].phone,
        action: 'MarkedDelivered',
        timestamp: new Date(now.getTime() - 10.9 * hour), // Suspiciously fast!
      },
      {
        dealId: deal5.dealId,
        actorPhone: DEMO_USERS[1].phone,
        action: 'Revoked',
        timestamp: new Date(now.getTime() - 10.5 * hour),
      },
    ],
  });
  console.log('  ✅ Action logs created');

  console.log('\n✅ Demo data seeded successfully!');
  console.log('\n📋 Demo Credentials (save these for testing):');
  console.log('─'.repeat(60));
  DEMO_USERS.forEach((user) => {
    console.log(`${user.name.padEnd(25)} ${user.phone.padEnd(20)} PIN: ${user.pin}`);
  });
  console.log('─'.repeat(60));
  console.log('\n💡 Tip: Save these credentials to DEMO_CREDENTIALS.md');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
