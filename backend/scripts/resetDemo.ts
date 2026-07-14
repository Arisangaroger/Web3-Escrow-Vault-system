/**
 * Clears demo users / deals / logs from the DB.
 * Does not roll back on-chain Escrow state — redeploy or use a fresh local chain
 * if you need a clean blockchain alongside a clean DB.
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

async function main() {
  console.log('🧹 Resetting demo data (DB only)...\n');

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

  console.log('Deleting leftover notifications for demo phones...');
  await prisma.notificationLog.deleteMany({
    where: { recipientPhone: { in: DEMO_PHONES } },
  });

  console.log('Deleting demo users...');
  await prisma.user.deleteMany({
    where: { phoneNumber: { in: DEMO_PHONES } },
  });

  console.log('\n✅ Demo DB reset complete.');
  console.log('💡 On-chain: start a fresh Hardhat node + redeploy if deal IDs must restart at 0.');
  console.log('💡 Then: npm run seed:demo');
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
