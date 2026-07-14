/**
 * Reset demo environment (Polygon Amoy).
 *
 * Clears demo rows from Postgres only. On-chain history on Amoy cannot be
 * wiped; after reset, run `npm run seed:demo` to mint/create fresh deals on
 * the same Escrow + eRWF addresses already in backend/.env.
 *
 * Usage:
 *   npm run reset:demo
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PHONES = [
  '+250788100001',
  '+250788200002',
  '+250788300003',
  '+250788100004',
  '+250788200005',
];

async function clearDemoDb() {
  console.log('🧹 Clearing demo data from DB (Amoy chain left unchanged)...\n');

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
    console.log(`Deleting action logs for ${dealIds.length} demo deal(s)...`);
    await prisma.dealActionLog.deleteMany({ where: { dealId: { in: dealIds } } });
    console.log('Deleting notification logs for demo deals...');
    await prisma.notificationLog.deleteMany({ where: { dealId: { in: dealIds } } });
    console.log('Deleting demo deals...');
    await prisma.deal.deleteMany({ where: { dealId: { in: dealIds } } });
  } else {
    console.log('No demo deals found.');
  }

  await prisma.notificationLog.deleteMany({
    where: { recipientPhone: { in: DEMO_PHONES } },
  });
  await prisma.user.deleteMany({
    where: { phoneNumber: { in: DEMO_PHONES } },
  });

  console.log('✅ Demo DB reset complete.');
  console.log('💡 Next: npm run seed:demo  (new deals on existing Amoy contracts)');
}

async function main() {
  await clearDemoDb();
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
