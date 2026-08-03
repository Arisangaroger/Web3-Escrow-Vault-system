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
import { ethers } from 'ethers';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/db/prisma.service';
import { WalletsService } from '../src/modules/wallets/wallets.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { DealsService } from '../src/modules/services/deals.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { GasRelayService } from '../src/modules/contracts/gas-relay.service';

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
  // Keep User rows so the same custodial wallets (and any Amoy MATIC on them) are reused.
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
  // Avoid event-listener eth_getLogs noise / gas during seeding (writes DB itself)
  process.env.DISABLE_EVENT_LISTENER = '1';

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
  const gasRelay = app.get(GasRelayService);
  const chainId = contracts.getChainId();

  if (chainId !== 80002) {
    console.warn(
      `  ⚠️  CHAIN_ID=${chainId} (expected 80002 Amoy). Continuing with configured network.\n`,
    );
  }

  try {
    const treasuryBal = await gasRelay.getTreasuryBalance();
    const treasuryAddr = gasRelay.getTreasuryWallet().address;
    console.log(`Treasury/relay ${treasuryAddr}: ${treasuryBal} POL (pays Amoy gas only — not sent to users)`);
    // Seed ~15–20 on-chain txs (mint/create/lock/ship/deliver/revoke). Gas is burned as network fees.
    const bal = Number(treasuryBal);
    if (bal < 0.01) {
      throw new Error(
        `Relay has only ${treasuryBal} POL — too low to submit Amoy txs. ` +
          `Fund ${treasuryAddr} (Alchemy/QuickNode Amoy faucet), then retry.`,
      );
    }
    if (bal < 0.04) {
      console.warn(
        `  ⚠️  Only ${treasuryBal} POL — seed may stop mid-way if gas price spikes. Continuing anyway.\n`,
      );
    }

    console.log('Clearing previous demo deals (keeping users/wallets)...');
    await clearDemoData(prisma);
    console.log('  ✅ Cleared\n');

    // 1. Users with custodial wallets encrypted by ENCRYPTION_KEY (reused across seeds)
    console.log('Ensuring demo users (same phone → same wallet)...');
    for (const user of DEMO_USERS) {
      await wallets.getOrCreateWallet(user.phone);
      await auth.setPin(user.phone, user.pin);
      const address = await wallets.getWalletAddress(user.phone);
      console.log(`  ✅ ${user.name} ${user.phone} PIN ${user.pin} → ${address}`);
    }

    // 2. Mint eRWF only (lockFunds uses Escrow pullFrom after signature — no user gas)
    console.log(`\nFunding buyers with eRWF (mint only if needed)...`);
    for (const phone of BUYER_PHONES) {
      const address = await wallets.getWalletAddress(phone);

      let eRwfBal = 0n;
      try {
        eRwfBal = await contracts.getTokenBalance(address);
      } catch {
        // fall through to mint
      }
      const needMint = eRwfBal < ethers.parseEther('1000000');
      if (needMint) {
        const txHash = await contracts.mintTokens(address, MINT_AMOUNT);
        console.log(`  ✅ Minted to ${phone} (${address}) tx=${txHash}`);
      } else {
        console.log(`  ⏭  Skip mint ${phone} (eRWF balance already sufficient)`);
      }
    }

    console.log('\n✅ Demo seed complete (users + tokens).\n');
    console.log('📋 Demo User Credentials');
    console.log('─'.repeat(64));
    DEMO_USERS.forEach((u) => {
      console.log(`${u.name.padEnd(25)} ${u.phone.padEnd(16)} PIN ${u.pin}  [${u.role}]`);
    });
    console.log('─'.repeat(64));
    console.log('\n📱 Use the USSD simulator to create deals manually.');
    console.log('   Start with farmer phones to create deals, then use buyer phones to lock funds.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
