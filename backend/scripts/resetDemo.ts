/**
 * Reset demo environment (Polygon Amoy).
 *
 * Clears demo deals / logs / notifications from Postgres.
 * Keeps demo User rows (custodial wallets) so Amoy MATIC previously
 * topped up onto those addresses is reusable on the next seed:demo.
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
  console.log('🧹 Clearing demo deals/logs from DB (users/wallets kept)...\n');

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

  const kept = await prisma.user.count({
    where: { phoneNumber: { in: DEMO_PHONES } },
  });
  console.log(
    `✅ Demo DB reset complete (kept ${kept} user wallet(s) — MATIC on those addresses stays usable).`,
  );
  console.log('💡 Next: npm run seed:demo');
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
