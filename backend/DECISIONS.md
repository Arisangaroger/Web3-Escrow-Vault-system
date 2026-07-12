# Backend Decisions Log

## Stack
- NestJS (instead of Express) for modular DI matching Phase 2 service boundaries
- Prisma + PostgreSQL for relational phone/wallet/deal integrity
- ethers.js v6 for RPC + EIP-712

## Meta-transactions (aligned with Phase 1 Escrow)
- Users sign intent with custodial keys via `signTypedData` (EIP-712 `EscrowContract` / `Action`)
- Relay/treasury wallet submits txs and pays gas
- `createDeal` includes explicit `sender`; `revoke` / `cancelBeforeLock` include explicit `caller`
- Nonces are per user (`getNonce(user)`), never relay/`tx.origin`
- ERC20 `approve` still requires the receiver wallet (gas top-up from treasury)

## Explicitly deferred
- KMS for master encryption key
- Real SMS gateway
- PIN reset / device-loss recovery
- BullMQ + Redis for keeper durability
