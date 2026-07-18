-- Off-chain only: admin submitted resolveDispute, awaiting Amoy confirmation.
ALTER TYPE "DealStatus" ADD VALUE IF NOT EXISTS 'ResolutionPending';
