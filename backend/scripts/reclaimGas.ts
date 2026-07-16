/**
 * Sweep Amoy MATIC from custodial demo/user wallets back to the treasury/relay.
 *
 * Only wallets still in Postgres (with ENCRYPTION_KEY) can be recovered.
 * Addresses funded then deleted from the DB cannot be refunded — keys are gone.
 *
 * Usage: npm run reclaim:gas
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ethers } from 'ethers';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/db/prisma.service';
import { WalletsService } from '../src/modules/wallets/wallets.service';
import { GasRelayService } from '../src/modules/contracts/gas-relay.service';

async function main() {
  process.env.DISABLE_EVENT_LISTENER = '1';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const wallets = app.get(WalletsService);
  const gasRelay = app.get(GasRelayService);
  const provider = gasRelay.getProvider();
  const treasury = gasRelay.getTreasuryWallet().address;

  const users = await prisma.user.findMany({
    select: { phoneNumber: true, walletAddress: true },
  });

  console.log(`Treasury: ${treasury}`);
  console.log(`Scanning ${users.length} custodial wallet(s)...\n`);

  let recovered = 0n;
  let swept = 0;

  for (const user of users) {
    const bal = await provider.getBalance(user.walletAddress);
    if (bal === 0n) {
      console.log(`  ${user.phoneNumber} ${user.walletAddress}: 0 MATIC`);
      continue;
    }

    const wallet = (await wallets.getWallet(user.phoneNumber)).connect(provider);
    const feeData = await provider.getFeeData();
    const gasLimit = 21_000n;
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? ethers.parseUnits('30', 'gwei');
    const gasCost = gasLimit * gasPrice * 120n / 100n; // 20% buffer

    if (bal <= gasCost) {
      console.log(
        `  ${user.phoneNumber} ${user.walletAddress}: ${ethers.formatEther(bal)} MATIC (too low to sweep after gas)`,
      );
      continue;
    }

    const value = bal - gasCost;
    try {
      const tx = await wallet.sendTransaction({
        to: treasury,
        value,
        gasLimit,
      });
      await tx.wait();
      console.log(
        `  ✅ ${user.phoneNumber} → treasury ${ethers.formatEther(value)} MATIC tx=${tx.hash}`,
      );
      recovered += value;
      swept++;
    } catch (err: any) {
      console.log(`  ❌ ${user.phoneNumber} sweep failed: ${err.message}`);
    }
  }

  console.log(`\nDone. Swept ${swept} wallet(s), recovered ~${ethers.formatEther(recovered)} MATIC.`);
  console.log(
    `Note: MATIC sent to addresses no longer in the DB cannot be recovered without their private keys.`,
  );

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
