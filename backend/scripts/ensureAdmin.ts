/**
 * Ensure demo admin exists with a real Argon2 password hash.
 * Fixes "Salt is too short" from the placeholder migration hash.
 *
 * Usage: npm run ensure:admin
 * Login: admin@escrow.local / admin123
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL = 'admin@escrow.local';
const PASSWORD = 'admin123';
const NAME = 'Musanze Cooperative Manager';

async function main() {
  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const treasuryHint = process.env.TREASURY_PRIVATE_KEY
    ? '(set wallet_address from TREASURY if desired)'
    : '';

  const walletAddress =
    process.env.ADMIN_WALLET_ADDRESS?.trim() ||
    '0x0000000000000000000000000000000000000000';

  const admin = await prisma.admin.upsert({
    where: { email: EMAIL },
    create: {
      name: NAME,
      email: EMAIL,
      passwordHash,
      walletAddress,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    update: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log(`✅ Admin ready: ${admin.email}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   wallet_address: ${admin.walletAddress} ${treasuryHint}`);
}

main()
  .catch((e) => {
    console.error('❌ ensure:admin failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
