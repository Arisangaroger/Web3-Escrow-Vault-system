# Escrow Backend - Phase 2 Implementation

Backend bridge for blockchain-based escrow system with custodial wallet management, accessible via USSD on feature phones.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Smart contracts deployed (Phase 1)
- RPC endpoint (Polygon Amoy testnet or local Hardhat node)

### Installation

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev --name init
npx prisma generate

# Copy contract ABIs
mkdir -p src/modules/contracts/abis
cp ../blockchain/artifacts/contracts/Escrow.sol/Escrow.json src/modules/contracts/abis/
cp ../blockchain/artifacts/contracts/eRWF.sol/eRWF.json src/modules/contracts/abis/

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start backend
npm run start:dev
```

### Configuration (.env)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/escrow_db"

# Blockchain
RPC_URL="https://rpc-amoy.polygon.technology"
CHAIN_ID=80002
ESCROW_CONTRACT_ADDRESS="0x..." # From Phase 1 deployment
ERWF_CONTRACT_ADDRESS="0x..."   # From Phase 1 deployment

# Treasury wallet (pays gas for users)
TREASURY_PRIVATE_KEY="0x..."
GAS_THRESHOLD="0.01"
GAS_TOP_UP_AMOUNT="0.05"

# Security
ENCRYPTION_KEY="your-256-bit-key"  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PIN_PEPPER="your-secret-pepper"

# Server
PORT=3000
NODE_ENV=development
```

## Architecture

```
REST API → Business Logic → Blockchain
    ↓           ↓               ↓
  DTOs    Wallets/Auth    Contracts
    ↓           ↓               ↓
Database ← Event Listener ← Events
```

**Key Services:**
- **WalletsService** - Custodial key management
- **AuthService** - PIN authentication with lockout
- **ContractsService** - Blockchain interaction
- **DealsService** - Business logic coordination
- **EventListenerService** - Blockchain → DB sync
- **KeeperService** - Automated jobs (auto-cancel, auto-release)
- **NotificationsService** - SMS simulation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design.

## API Reference

See [API.md](./API.md) for full endpoint documentation.

**Key Endpoints:**
```
POST   /users/:phone/pin        - Set PIN
POST   /deals                   - Create deal
POST   /deals/:id/lock          - Lock funds
POST   /deals/:id/ship          - Mark shipped
POST   /deals/:id/deliver       - Mark delivered
POST   /deals/:id/revoke        - Dispute deal
GET    /users/:phone/deals      - Get active deals
GET    /deals/:id               - Get deal details
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Test (Happy Path)

```bash
# Terminal 1: Start backend
npm run start:dev

# Terminal 2: Run test script
./test-scripts/happy-path.sh
```

### Manual Testing with curl

```bash
# 1. Create users and set PINs
curl -X POST http://localhost:3000/users/+250788111111/pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"1111"}'

curl -X POST http://localhost:3000/users/+250788222222/pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"2222"}'

curl -X POST http://localhost:3000/users/+250788333333/pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"3333"}'

# 2. Mint tokens to receiver (testing only)
curl -X POST http://localhost:3000/test/mint \
  -H "Content-Type: application/json" \
  -d '{"phone":"+250788333333","amount":"5000"}'

# 3. Create deal
curl -X POST http://localhost:3000/deals \
  -H "Content-Type: application/json" \
  -d '{
    "senderPhone":"+250788111111",
    "driverPhone":"+250788222222",
    "receiverPhone":"+250788333333",
    "amount":"1000",
    "pin":"1111"
  }'

# 4. Lock funds (receiver)
curl -X POST http://localhost:3000/deals/0/lock \
  -H "Content-Type: application/json" \
  -d '{"phone":"+250788333333","pin":"3333"}'

# 5. Mark shipped (sender)
curl -X POST http://localhost:3000/deals/0/ship \
  -H "Content-Type: application/json" \
  -d '{"phone":"+250788111111","pin":"1111"}'

# 6. Mark delivered (driver)
curl -X POST http://localhost:3000/deals/0/deliver \
  -H "Content-Type: application/json" \
  -d '{"phone":"+250788222222","pin":"2222"}'

# 7. Check deal status
curl http://localhost:3000/deals/0

# 8. Get active deals for a user
curl http://localhost:3000/users/+250788111111/deals
```

## Database Management

```bash
# Create new migration
npx prisma migrate dev --name description

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio

# Generate Prisma Client (after schema changes)
npx prisma generate
```

## Monitoring

### Logs
```bash
# Watch all logs
npm run start:dev

# Key log patterns:
✅ Deal X created      # Business event
⛽ Funding wallet...   # Gas management
🧹 Sweeping expired... # Keeper jobs
❌ Failed to...        # Errors
⚠️  Treasury low       # Operational alert
```

### Database Queries

```sql
-- Active deals
SELECT * FROM deals WHERE status NOT IN ('Released', 'Cancelled', 'Resolved');

-- Recent notifications
SELECT * FROM notifications_log ORDER BY sent_at DESC LIMIT 10;

-- Deal audit trail
SELECT * FROM deal_action_log WHERE deal_id = 0 ORDER BY timestamp;

-- PIN lockouts
SELECT phone_number, pin_attempts, lockout_until 
FROM users 
WHERE lockout_until IS NOT NULL;
```

## Development

### Project Structure

```
src/
├── main.ts                    # Application entry
├── app.module.ts              # Root module
├── db/                        # Database
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── wallets/                   # Custodial wallet management
│   ├── wallets.service.ts
│   └── wallets.module.ts
├── auth/                      # PIN authentication
│   ├── auth.service.ts
│   └── auth.module.ts
├── contracts/                 # Blockchain interaction
│   ├── contracts.service.ts
│   ├── signature.service.ts
│   ├── gas-relay.service.ts
│   ├── contracts.module.ts
│   └── abis/                  # Contract ABIs
├── services/                  # Business logic
│   ├── deals.service.ts
│   ├── event-listener.service.ts
│   └── deals.module.ts
├── notifications/             # SMS simulation
│   ├── notifications.service.ts
│   └── notifications.module.ts
├── keeper/                    # Scheduled jobs
│   ├── keeper.service.ts
│   └── keeper.module.ts
└── api/                       # HTTP endpoints
    ├── api.controller.ts
    ├── api.module.ts
    └── dto/                   # Request validation
```

### Adding a New Endpoint

1. Create DTO in `src/modules/api/dto/`
2. Add method to appropriate service
3. Add route to `ApiController`
4. Update `API.md` documentation

### Debugging

```bash
# Debug mode
npm run start:debug

# Then attach debugger on port 9229

# View SQL queries
# Add to .env:
DATABASE_URL="postgresql://...?schema=public&statement_timeout=0&lock_timeout=0&idle_in_transaction_session_timeout=0"
```

## Security

### Best Practices Implemented
✅ Private keys encrypted at rest  
✅ PINs hashed with Argon2id + pepper  
✅ 5-attempt lockout with 15-minute timeout  
✅ EIP-712 structured signatures  
✅ On-chain nonce prevents replay attacks  
✅ Input validation on all endpoints  
✅ No secrets in logs or API responses  

### Known Gaps (Phase 2 Prototype)
⚠️ No wallet recovery mechanism  
⚠️ No self-service PIN reset  
⚠️ Master encryption key in environment (should use KMS)  
⚠️ No rate limiting (Phase 3)  
⚠️ No admin authentication on dispute resolution (Phase 3)  

## Troubleshooting

### Database Connection Error
```
Error: P1001: Can't reach database server
```
**Solution:** Check PostgreSQL is running and DATABASE_URL is correct

### Contract ABI Not Found
```
Error: Cannot find module './abis/Escrow.json'
```
**Solution:** Copy ABIs from blockchain project (see Installation step 3)

### Transaction Reverted
```
Error: execution reverted: "Only receiver can lock funds"
```
**Solution:** Check you're using the correct phone number for the action

### Treasury Balance Low
```
⚠️  Treasury balance low: 0.03 ETH
```
**Solution:** Send ETH/MATIC to treasury wallet address

### Nonce Too Low
```
Error: nonce has already been used
```
**Solution:** Backend tracks nonces automatically. If persists, restart backend.

### Event Listener Not Syncing
```
Last synced block stuck at X
```
**Solution:** Check RPC endpoint is responsive. Event listener auto-resumes.

## Performance

### Metrics
- **API Response Time:** < 200ms (cached queries)
- **Transaction Confirmation:** 2-5 seconds (blockchain finality)
- **Event Sync Delay:** < 30 seconds (polling interval)
- **Keeper Job Frequency:** Every 5 minutes

### Optimization Tips
1. Use database indexes for phone number queries
2. Cache frequently accessed deals in memory
3. Use connection pooling for PostgreSQL
4. Configure backup RPC endpoints for failover

## Deployment

### Production Checklist
- [ ] Use KMS for encryption key management
- [ ] Enable SSL/TLS for database connection
- [ ] Set up database backups (daily)
- [ ] Configure structured logging (JSON format)
- [ ] Set up monitoring and alerting
- [ ] Use backup RPC endpoints
- [ ] Implement rate limiting
- [ ] Add admin authentication
- [ ] Replace simulated SMS with real gateway
- [ ] Set up failover for Keeper/EventListener services

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "start:prod"]
```

```bash
# Build and run
docker build -t escrow-backend .
docker run -p 3000:3000 --env-file .env escrow-backend
```

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL="postgresql://..."  # With SSL mode
RPC_URL="https://polygon-rpc.com"  # Production RPC
LOG_LEVEL=info
ENABLE_CORS=false
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

## Support

### Documentation
- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
- [Implementation Status](./IMPLEMENTATION_STATUS.md)

### Common Issues
- Check logs for `❌` error indicators
- Verify .env configuration
- Ensure blockchain contracts are deployed
- Confirm PostgreSQL is accessible
- Check treasury wallet has sufficient balance

### Phase Progress
✅ Phase 1: Smart Contracts (Complete)  
✅ Phase 2: Backend Bridge (Complete)  
⏳ Phase 3: USSD Integration (Next)  
⏳ Phase 4: Admin Portal (Future)  

---

**Built with NestJS + Ethers.js + PostgreSQL**

For detailed design decisions, see `phase2_backend_bridge_plan.md`
