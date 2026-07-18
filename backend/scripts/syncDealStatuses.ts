/**
 * One-shot: align Prisma deal.status with on-chain Escrow.getDeal status.
 * Usage: npx ts-node -r dotenv/config scripts/syncDealStatuses.ts
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { PrismaClient, DealStatus } from '@prisma/client';
import * as EscrowArtifact from '../src/modules/contracts/abis/Escrow.json';

const STATUS_BY_INDEX: DealStatus[] = [
  DealStatus.Created,
  DealStatus.FundsLocked,
  DealStatus.Shipped,
  DealStatus.Delivered,
  DealStatus.Disputed,
  DealStatus.Released,
  DealStatus.Cancelled,
  DealStatus.Resolved,
];

function createProvider(rpcUrl: string, chainId: number): ethers.Provider {
  const urls = rpcUrl.split(',').map((u) => u.trim()).filter(Boolean);
  const network = ethers.Network.from(chainId);
  if (urls.length === 1) {
    return new ethers.JsonRpcProvider(urls[0], network, { staticNetwork: true });
  }
  return new ethers.FallbackProvider(
    urls.map((url, index) => ({
      provider: new ethers.JsonRpcProvider(url, network, { staticNetwork: true }),
      priority: index + 1,
      stallTimeout: 2500,
      weight: 1,
    })),
    network,
    { quorum: 1 },
  );
}

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const escrowAddress = (process.env.ESCROW_CONTRACT_ADDRESS || '').trim();
  const chainId = Number(process.env.CHAIN_ID) || 80002;
  if (!rpcUrl || !escrowAddress) {
    throw new Error('RPC_URL and ESCROW_CONTRACT_ADDRESS required');
  }

  const provider = createProvider(rpcUrl, chainId);
  const abi = (EscrowArtifact as any).abi ?? EscrowArtifact;
  const escrow = new ethers.Contract(escrowAddress, abi, provider);
  const prisma = new PrismaClient();

  try {
    const next = Number(await escrow.nextDealId());
    console.log(`nextDealId=${next}`);

    for (let dealId = 0; dealId < next; dealId++) {
      const onChain = await escrow.getDeal(dealId);
      const status = STATUS_BY_INDEX[Number(onChain.status)];
      if (!status) continue;

      const existing = await prisma.deal.findUnique({ where: { dealId } });
      if (!existing) {
        console.log(`#${dealId} ${status} (no DB row)`);
        continue;
      }
      if (existing.status !== status) {
        await prisma.deal.update({ where: { dealId }, data: { status } });
        console.log(`#${dealId} ${existing.status} -> ${status}`);
      } else {
        console.log(`#${dealId} ${status} (ok)`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
