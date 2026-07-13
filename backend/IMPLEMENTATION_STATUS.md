# Backend Implementation Status

**Last updated:** aligned with blockchain meta-tx API (`createDeal(sender,...)`, `revoke`/`cancelBeforeLock` with caller, EIP-712 `signTypedData`).

## Done (Phase 2 core)

| Area | Status | Notes |
|------|--------|-------|
| NestJS + Prisma schema | Done | Modules under `src/modules/` |
| Custodial wallets | Done | Encrypted keystores via `ENCRYPTION_KEY` |
| PIN auth (argon2id + lockout) | Done | Unit tested |
| Contract wrappers | Done | Matches current Escrow ABI arg shapes |
| EIP-712 signatures | Done | `signTypedData` (fixed; was `signMessage`) |
| ABIs | Done | `src/modules/contracts/abis/{Escrow,eRWF}.json` — run `npm run sync:abis` after contract changes |
| Gas relay / meta-tx | Done | Relay pays Escrow gas; users funded for ERC20 approve |
| Deals service + REST API | Done | Full lifecycle endpoints |
| Event sync | Done | Polls logs; writes `deal_action_log`; safe DealCreated (no wallet-as-phone) |
| Reconciliation | Done | Cron every 10m compares open deals to chain |
| Keeper | Done | Auto-cancel + auto-release |
| Notifications | Done | DB + console simulation |
| Env fail-fast | Done | Required env validated; Escrow `nextDealId` smoke check |
| Prisma migration | Done | `prisma/migrations/20260712120000_init` |
| Unit tests | Done | Signature recovery + PIN lockout |

## Deploy / run checklist

```bash
cd backend
cp .env.example .env   # fill RPC, addresses, keys, DATABASE_URL
npm install
npx prisma migrate deploy
npx prisma generate
npm run sync:abis      # if contracts recompiled
npm test
npm run start:dev
```

**Admin arbitration:** `resolveDispute` is signed by `TREASURY_PRIVATE_KEY` (relay). That address must hold Escrow `ADMIN_ROLE` (local deploy defaults deployer → admin).

## Known production gaps (deferred)

- KMS for wallet encryption master key
- Real SMS gateway (notifications are simulated)
- Self-service PIN reset / device loss recovery
- BullMQ/Redis for keeper retries
- Full e2e Postman lifecycle against testnet (manual)
