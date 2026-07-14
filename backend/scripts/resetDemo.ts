import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PHONES = [
  '+250788100001',
  '+250788200002',
  '+250788300003',
  '+250788100004',
  '+250788200005',
];

async function main() {
  console.log('🧹 Resetting demo data...\n');

  // Delete in correct order (respect foreign keys)
  console.log('Deleting notifications log...');
  await prisma.notificationsLog.deleteMany({
    where: {
      recipientPhone: { in: DEMO_PHONES },
    },
  });

  console.log('Deleting deal action logs...');
  await prisma.dealActionLog.deleteMany({
    where: {
      actorPhone: { in: DEMO_PHONES },
    },
  });

  console.log('Deleting deals...');
  await prisma.deal.deleteMany({
    where: {
      OR: [
        { senderPhone: { in: DEMO_PHONES } },
        { driverPhone: { in: DEMO_PHONES } },
        { receiverPhone: { in: DEMO_PHONES } },
      ],
    },
  });

  console.log('Deleting demo users...');
  await prisma.user.deleteMany({
    where: {
      phoneNumber: { in: DEMO_PHONES },
    },
  });

  console.log('\n✅ Demo data reset successfully!');
  console.log('\n💡 Run `npm run seed:demo` to recreate demo data');
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
