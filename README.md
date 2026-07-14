# Agricultural Escrow System

**Blockchain-backed escrow for agricultural trade via USSD**

A complete prototype demonstrating how blockchain technology can solve trust gaps in farmer-to-market transactions in Rwanda, using accessible feature phone interfaces.

---

## 📋 Executive Summary

This system enables small-scale farmers in rural Rwanda to safely trade with urban buyers through:

- **USSD interface** - Works on basic feature phones (no smartphone needed)
- **Blockchain escrow** - Funds locked until verified delivery
- **Fraud prevention** - Triangular notification system catches delivery fraud
- **Human arbitration** - Cooperative managers resolve disputes with full audit trail

**Key Innovation:** Combines blockchain security with USSD accessibility, targeting the 70% of Rwandans who don't have smartphones but need reliable trade infrastructure.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Feature Phone│  │ Admin Portal │  │ USSD Simulator   │  │
│  │ (USSD *384*) │  │ (React SPA)  │  │ (Testing)        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
┌─────────┴──────────────────┴──────────────────┴──────────────┐
│                   APPLICATION LAYER                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            NestJS Backend (Phase 2)                      │ │
│  │  • Custodial wallet management (encrypted keys)          │ │
│  │  • PIN authentication (Argon2, lockout protection)       │ │
│  │  • Meta-transaction relay (EIP-712 signatures)           │ │
│  │  • Event listener (blockchain → database sync)           │ │
│  │  • Keeper jobs (auto-cancel, auto-release)               │ │
│  │  • SMS notifications (simulated)                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         USSD Service (Phase 3)                           │ │
│  │  • Express.js stateless menu system                      │ │
│  │  • 15 menu nodes (PIN, create deal, ship, deliver, etc.) │ │
│  │  • 90-second session management                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────┐
│                    DATA & BLOCKCHAIN LAYER                     │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │   PostgreSQL + Prisma│  │  Polygon (Amoy Testnet)       │  │
│  │  • Users & wallets   │  │  • Escrow.sol (deal state)    │  │
│  │  • Deals cache       │  │  • eRWF.sol (stablecoin)      │  │
│  │  • Action logs       │  │  • AccessControl (admin role) │  │
│  │  • Notifications     │  │  • Meta-tx verification       │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (clean clone)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### 1. Clone
```bash
git clone <repository-url>
cd "Escrow Vault"
```

### 2. Blockchain (Polygon Amoy)
```bash
cd blockchain
npm install
cp .env.example .env   # PRIVATE_KEY with Amoy MATIC; optional POLYGONSCAN_API_KEY
# Get test MATIC: https://faucet.polygon.technology/ (Amoy)
npx hardhat run scripts/deploy.js --network amoy
# Copy Escrow + eRWF addresses from the deploy output / deployments artifact
```
Details: [`blockchain/CONTRACTS.md`](blockchain/CONTRACTS.md)

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env
# Set DATABASE_URL, RPC_URL (Amoy), CHAIN_ID=80002,
# ESCROW_CONTRACT_ADDRESS, ERWF_CONTRACT_ADDRESS,
# TREASURY_PRIVATE_KEY (must hold Escrow ADMIN_ROLE + Amoy MATIC),
# ENCRYPTION_KEY, PIN_PEPPER, JWT_SECRET
npx prisma migrate deploy
npm run sync:abis
npm run reset:demo         # clear demo DB rows (Amoy history unchanged)
npm run seed:demo          # mint eRWF + create deals on Amoy
npm run start:dev
```
API reference: [`backend/API.md`](backend/API.md)

### 4. USSD service
```bash
cd ussd-service
npm install
cp .env.example .env
npm start
# Simulator UI: open ussd-service/simulator-ui/index.html
# Default SIMs match seed: 0788100001 / 0788300003 / 0788200002
```
Protocol & menus: [`ussd-service/USSD_PROTOCOL.md`](ussd-service/USSD_PROTOCOL.md), [`ussd-service/MENU_TREE.md`](ussd-service/MENU_TREE.md)

### 5. Admin portal
```bash
cd admin-portal
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3000
npm run dev
```
Docs: [`ADMIN_PORTAL.md`](ADMIN_PORTAL.md)

### 6. Access
- **USSD Simulator:** open `ussd-service/simulator-ui/index.html` (API on :4000)
- **Admin Portal:** http://localhost:5173 (or Vite port printed in terminal)
- **Backend API:** http://localhost:3000
- **Status:** http://localhost:3000/internal/status

Demo users / walkthrough: [`DEMO_CREDENTIALS.md`](DEMO_CREDENTIALS.md)  
Demo rehearsal checklist: [`DEMO_REHEARSAL.md`](DEMO_REHEARSAL.md)  
Glossary: [`GLOSSARY.md`](GLOSSARY.md)  
Known limits: [`LIMITATIONS.md`](LIMITATIONS.md)  
Decisions log: [`DECISIONS.md`](DECISIONS.md)

---

## 📱 Demo Walkthrough

### Step 1: The Problem
- Musanze farmer needs to ship potatoes to Kigali buyer
- Buyer won't pay upfront (trust gap)
- Farmer won't ship without payment (trust gap)
- Traditional escrow services don't reach rural areas

### Step 2: Create Deal (USSD)
1. Farmer dials `*384*96#`
2. Enters PIN (1111)
3. Selects "Create Deal"
4. Enters buyer phone, driver phone, amount
5. System creates deal, notifies all parties

### Step 3: Lock Funds
1. Buyer locks 500,000 RWF into blockchain escrow
2. Farmer receives SMS: "Funds locked, safe to ship"
3. 24-hour deadline prevents indefinite holds

### Step 4: Shipment & Delivery
1. Farmer marks "Shipped" via USSD
2. Driver transports goods
3. Driver marks "Delivered" when buyer receives
4. **Triangular broadcast:** All 3 parties notified simultaneously

### Step 5: Fraud Prevention (The Key Feature)
**Scenario:** Driver lies, marks delivered early
- Buyer immediately sees notification: "If you did NOT receive goods, DISPUTE NOW"
- Buyer has 3-hour window to dispute
- Without buyer dispute, funds auto-release to farmer

### Step 6: Dispute Resolution
1. Cooperative manager logs into Admin Portal
2. Sees timeline: "Delivered marked 2 minutes after shipped" ← red flag
3. Physically verifies situation
4. Clicks resolution: "Driver Fraud - Refund Buyer"
5. Blockchain executes, all parties notified

---

## 📚 Documentation

Phase 5 presentable set (see [`phase5_polish_demo_readiness_plan.md`](phase5_polish_demo_readiness_plan.md)):

| Doc | Purpose |
|-----|---------|
| [`blockchain/CONTRACTS.md`](blockchain/CONTRACTS.md) | Escrow + eRWF, Amoy deploy, tests |
| [`backend/API.md`](backend/API.md) | HTTP API |
| [`ussd-service/USSD_PROTOCOL.md`](ussd-service/USSD_PROTOCOL.md) | CON/END protocol |
| [`ussd-service/MENU_TREE.md`](ussd-service/MENU_TREE.md) | USSD menu map |
| [`ADMIN_PORTAL.md`](ADMIN_PORTAL.md) | Dispute portal |
| [`LIMITATIONS.md`](LIMITATIONS.md) | Scoped deferrals |
| [`DECISIONS.md`](DECISIONS.md) | Design rationale |
| [`GLOSSARY.md`](GLOSSARY.md) | Plain-language terms |
| [`DEMO_CREDENTIALS.md`](DEMO_CREDENTIALS.md) | Demo users, PINs, walkthroughs |
| [`DEMO_REHEARSAL.md`](DEMO_REHEARSAL.md) | Narrative + dry-run log |

---

## 🎯 Key Features

### For Farmers
- ✅ Payment guaranteed before shipping
- ✅ Works on basic feature phones (USSD)
- ✅ No smartphone or app needed
- ✅ 4-digit PIN (familiar, like MoMo)
- ✅ SMS notifications at every step

### For Buyers
- ✅ Money held safely until delivery confirmed
- ✅ 3-hour window to dispute bad deliveries
- ✅ Fraud protection via triangular broadcast
- ✅ Automatic refund if driver fraud proven

### For Drivers
- ✅ Clear delivery confirmation protocol
- ✅ Protected from false buyer claims
- ✅ Admin arbitration if disputed

### For Cooperatives
- ✅ Web dashboard for dispute resolution
- ✅ Full audit trail of all actions
- ✅ Timeline evidence for fair arbitration
- ✅ Build trust and reputation in network

---

## 🔐 Security Features

- **Custodial wallets:** Backend manages keys (encrypted at rest)
- **PIN authentication:** Argon2id hashing, 5-attempt lockout
- **Meta-transactions:** EIP-712 signatures, nonce replay protection
- **Smart contract security:** ReentrancyGuard, AccessControl, role-based permissions
- **Audit trail:** Immutable logs on blockchain + database
- **Admin authentication:** JWT tokens, HTTP-only cookies, rate limiting

---

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test                  # Unit tests
npm run test:e2e         # E2E tests
npm run test:cov         # Coverage report
```

### Run Frontend Tests
```bash
cd admin-portal
npm test                 # Component tests
npm run test:run         # Run once
```

### Manual Testing
```bash
# Reset and seed demo data
cd backend
npm run reset:demo
npm run seed:demo

# Start all services
npm run start:dev        # Backend
cd ../ussd-service && npm start  # USSD
cd ../admin-portal && npm run dev  # Portal
```

---

## 📊 System Status

### Health Monitoring
```bash
# Check system status
curl http://localhost:3000/internal/status

# Response includes:
# - Treasury wallet balance
# - Deal counts by status
# - Active disputes count
# - Last keeper run time
```

### Logs
All services use structured logging (Pino):
- **Backend:** JSON logs with context, severity, IDs
- **Keeper jobs:** Summary stats (evaluated, actioned, failed)
- **Transactions:** TX hash, confirmation status

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Smart Contracts** | Solidity 0.8.20 | Escrow logic, access control |
| **Blockchain** | Polygon (Amoy testnet) | Low-cost, fast transactions |
| **Backend** | NestJS + TypeScript | API, wallet management, keeper jobs |
| **Database** | PostgreSQL + Prisma | Deal cache, user management |
| **USSD** | Express.js | Lightweight menu system |
| **Admin Portal** | React + Vite | Dispute resolution UI |
| **Authentication** | Argon2 + JWT | PIN hashing, admin sessions |
| **Cryptography** | ethers.js | Wallet encryption, EIP-712 signatures |

---

## 🌍 Rwanda Context

### Why This Matters
- **70% feature phone adoption** - USSD reaches everyone, not just smartphone users
- **BNR e-Franc coming** - System designed for forward-compatibility with digital RWF
- **MoMo ecosystem** - Familiar 4-digit PIN pattern, natural on/off-ramp
- **Trust gaps** - Rural farmers systematically excluded from urban markets
- **Cooperative structure** - Existing governance body (cooperative manager) fits admin role

### Design Decisions Specific to Rwanda
1. **USSD over mobile app** - Feature phone accessibility
2. **Kinyarwanda/French/English** - Multi-language support planned
3. **MoMo-style PINs** - Leverage familiar patterns
4. **Cooperative arbitration** - Matches existing social structures
5. **eRWF compatibility** - Forward-looking to BNR digital currency

---

## 📈 Demo Credentials

After running `npm run seed:demo`:

| User | Phone | PIN | Role |
|------|-------|-----|------|
| Musanze Cooperative | +250788100001 | 1111 | Farmer/Sender |
| Kigali Fresh Market | +250788200002 | 2222 | Buyer/Receiver |
| Driver James | +250788300003 | 3333 | Driver |
| Huye Farmer | +250788100004 | 4444 | Farmer/Sender |
| Rubavu Market | +250788200005 | 5555 | Buyer/Receiver |

**Admin Portal:**
- Email: `admin@escrow.local`
- Password: `admin123` (⚠️ change in production!)

---

## 🚧 Limitations

This is a **prototype demonstrating technical feasibility**. See [LIMITATIONS.md](LIMITATIONS.md) for full list.

### Key Constraints
- ❌ Real MoMo integration (simulated)
- ❌ Real SMS gateway (simulated)
- ❌ KYC / regulatory compliance
- ❌ Production security hardening
- ❌ Multi-cooperative scaling
- ❌ Mobile app (USSD only)

### Production Readiness Checklist
See [LIMITATIONS.md](LIMITATIONS.md) for complete roadmap from prototype → pilot → production.

---

## 🤝 Contributing

This is a learning/portfolio project. For production deployment, engage:
- BNR (regulatory)
- Licensed MoMo aggregator
- Security auditors
- Telecom providers (USSD gateway)

---

## 📄 License

[Specify license]

---

## 🙏 Acknowledgments

- Built as demonstration of blockchain + USSD integration
- Inspired by real-world agricultural trade challenges in Rwanda
- Smart contract patterns adapted from OpenZeppelin
- USSD protocol based on Africa's Talking standards

---

## 📞 Support

For technical questions or demo requests:
- Open an issue in this repository
- See documentation in respective phase folders
- Check [LIMITATIONS.md](LIMITATIONS.md) for known issues

---

**Status:** ✅ Prototype Complete (Phase 1-5)  
**Next:** Pilot deployment planning (Phase 6)
