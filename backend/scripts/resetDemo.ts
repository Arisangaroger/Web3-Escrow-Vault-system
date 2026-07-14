/**
 * Reset demo environment.
 *
 * Default: clear demo rows from Postgres.
 * Full reset (--full or RESET_FULL=1): also redeploy Escrow+eRWF on the
 * configured Hardhat/localhost network and patch backend/.env with new addresses.
 * That gives a clean on-chain escrow (new contract) without relying on
 * "DB-only" deals that no longer exist on-chain.
 *
 * Usage:
 *   npm run reset:demo
 *   npm run reset:demo -- --full
 *   RESET_FULL=1 npm run reset:demo
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PHONES = [
  '+250788100001',
  '+250788200002',
  '+250788300003',
  '+250788100004',
  '+250788200005',
];

const FULL =
  process.argv.includes('--full') ||
  process.env.RESET_FULL === '1' ||
  process.env.RESET_FULL === 'true';

async function clearDemoDb() {
  console.log('🧹 Clearing demo data from DB...\n');

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
}

function patchEnvFile(
  envPath: string,
  updates: Record<string, string>,
): void {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content = content.trimEnd() + `\n${line}\n`;
    }
  }
  fs.writeFileSync(envPath, content);
  console.log(`✅ Updated ${envPath}`);
}

function redeployLocalChain(): void {
  const chainId = Number(process.env.CHAIN_ID || 0);
  if (chainId !== 31337 && chainId !== 1337) {
    console.warn(
      `\n⚠️  CHAIN_ID=${chainId} is not a local Hardhat network.`,
    );
    console.warn(
      '   Full reset will still redeploy if you pass a localhost Hardhat URL,',
    );
    console.warn(
      '   but Amoy/mainnet history cannot be wiped — new addresses = new escrow.',
    );
  }

  const blockchainDir = path.resolve(__dirname, '..', '..', 'blockchain');
  const backendEnv = path.resolve(__dirname, '..', '.env');

  console.log('\n⛓  Redeploying Escrow + eRWF (Hardhat localhost)...');
  console.log('   Ensure `npx hardhat node` is running in another terminal.\n');

  const result = spawnSync(
    'npx',
    ['hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost'],
    {
      cwd: blockchainDir,
      encoding: 'utf8',
      shell: true,
      env: process.env,
    },
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(
      'Hardhat deploy failed. Start a local node (`cd blockchain && npx hardhat node`) then retry with --full.',
    );
  }

  const latestPath = path.join(
    blockchainDir,
    'deployments',
    'localhost-latest.json',
  );
  if (!fs.existsSync(latestPath)) {
    throw new Error(`Deployment file missing: ${latestPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  const escrow = deployment.contracts?.Escrow?.address;
  const erwf = deployment.contracts?.eRWF?.address;
  if (!escrow || !erwf) {
    throw new Error('Could not read contract addresses from deployment JSON');
  }

  patchEnvFile(backendEnv, {
    ESCROW_CONTRACT_ADDRESS: escrow,
    ERWF_CONTRACT_ADDRESS: erwf,
    CHAIN_ID: String(deployment.chainId || '31337'),
    RPC_URL: process.env.RPC_URL || 'http://127.0.0.1:8545',
  });

  console.log('\n📦 Syncing ABIs into backend...');
  const sync = spawnSync('npm', ['run', 'sync:abis'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    shell: true,
  });
  if (sync.stdout) process.stdout.write(sync.stdout);
  if (sync.status !== 0) {
    console.warn('ABI sync failed — run `npm run sync:abis` manually if needed.');
  }

  console.log('\n✅ Full chain reset complete (new Escrow + eRWF).');
  console.log('   Restart the backend so it picks up new .env addresses.');
  console.log('   Then: npm run seed:demo');
}

async function main() {
  await clearDemoDb();

  if (FULL) {
    redeployLocalChain();
  } else {
    console.log('\n💡 DB-only reset. For a clean on-chain escrow too:');
    console.log('   npm run reset:demo -- --full');
    console.log('   (requires local Hardhat node running)');
    console.log('💡 Then: npm run seed:demo');
  }
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
