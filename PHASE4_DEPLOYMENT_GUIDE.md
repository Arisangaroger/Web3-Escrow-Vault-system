# Phase 4 - Admin Portal Deployment Guide

Quick reference for setting up and running the admin portal.

---

## Prerequisites

✅ Backend running (Phase 2)  
✅ PostgreSQL database configured  
✅ Blockchain contracts deployed (Phase 1)  
✅ Node.js 18+ installed  
✅ npm or yarn installed

---

## Step 1: Database Setup

### Run Migration

```bash
cd backend
npx prisma migrate dev --name add_admins_table
npx prisma generate
```

**Expected Output:**
```
✓ Migration applied successfully
✓ Prisma Client generated
```

### Verify Table Created

```sql
-- Connect to your PostgreSQL database
\dt admins

-- Should show:
--  Schema | Name   | Type  | Owner
-- --------+--------+-------+-------
--  public | admins | table | user
```

---

## Step 2: Environment Configuration

### Backend (.env)

Add to `backend/.env`:

```env
# Admin Authentication
JWT_SECRET="your-secret-key-minimum-32-characters-long-change-in-production"
JWT_EXPIRES_IN="8h"

# Existing variables (ensure they're set)
DATABASE_URL="postgresql://user:password@localhost:5432/escrow_db"
TREASURY_PRIVATE_KEY="0x..."
ADMIN_PRIVATE_KEY="0x..."  # Admin wallet with ADMIN_ROLE
```

### Frontend (.env)

Create `admin-portal/.env`:

```env
VITE_API_URL="http://localhost:3000"
```

**Production:**
```env
VITE_API_URL="https://your-backend-domain.com"
```

---

## Step 3: Create Admin Account

### Method 1: Using Node.js Script

Create `backend/scripts/create-admin.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function createAdmin() {
  const passwordHash = await argon2.hash('admin123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.admin.create({
    data: {
      name: 'Market Authority Admin',
      email: 'admin@escrow.local',
      passwordHash,
      walletAddress: '0xYOUR_ADMIN_WALLET_ADDRESS_HERE', // IMPORTANT: Change this!
    },
  });

  console.log('✅ Admin created:', admin);
  process.exit(0);
}

createAdmin().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
```

Run:
```bash
cd backend
node scripts/create-admin.js
```

### Method 2: Direct SQL

```sql
-- Generate hash first (see method 1)
INSERT INTO admins (name, email, password_hash, wallet_address, created_at)
VALUES (
  'Market Authority Admin',
  'admin@escrow.local',
  '$argon2id$v=19$m=65536,t=3,p=4$...',  -- Replace with actual hash
  '0xYOUR_ADMIN_WALLET_ADDRESS_HERE',     -- Replace with actual address
  NOW()
);
```

---

## Step 4: Grant On-Chain Admin Role

The admin wallet must have `ADMIN_ROLE` on the Escrow contract.

### Check Current Role

```bash
cd blockchain
npx hardhat console --network amoy

# In console:
const Escrow = await ethers.getContractFactory("Escrow");
const escrow = await Escrow.attach("YOUR_ESCROW_CONTRACT_ADDRESS");
const ADMIN_ROLE = await escrow.ADMIN_ROLE();
const hasRole = await escrow.hasRole(ADMIN_ROLE, "0xYOUR_ADMIN_WALLET_ADDRESS");
console.log("Has admin role:", hasRole);
```

### Grant Role (If Needed)

```bash
# In Hardhat console (as contract owner):
const tx = await escrow.grantRole(ADMIN_ROLE, "0xYOUR_ADMIN_WALLET_ADDRESS");
await tx.wait();
console.log("✅ Admin role granted");
```

**Or via script:**

Create `blockchain/scripts/grant-admin-role.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const escrowAddress = "YOUR_ESCROW_CONTRACT_ADDRESS";
  const adminAddress = "0xYOUR_ADMIN_WALLET_ADDRESS";

  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.attach(escrowAddress);

  const ADMIN_ROLE = await escrow.ADMIN_ROLE();
  const tx = await escrow.grantRole(ADMIN_ROLE, adminAddress);
  await tx.wait();

  console.log("✅ Admin role granted to:", adminAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Run:
```bash
npx hardhat run scripts/grant-admin-role.js --network amoy
```

---

## Step 5: Install Dependencies

### Backend

```bash
cd backend
npm install
# Dependencies already installed if Phase 2 working
```

### Admin Portal

```bash
cd admin-portal
npm install
```

**Expected packages:**
- react
- react-dom
- react-router-dom
- axios
- vite

---

## Step 6: Start Services

### Terminal 1 - Backend

```bash
cd backend
npm run start:dev
```

**Expected output:**
```
[Nest] INFO [NestApplication] Nest application successfully started
[Nest] INFO Listening on http://localhost:3000
```

**Verify:**
```bash
curl http://localhost:3000/health
# Should return: {"success":true,"data":{"status":"healthy","timestamp":"..."}}
```

### Terminal 2 - Admin Portal

```bash
cd admin-portal
npm run dev
```

**Expected output:**
```
  VITE v5.x ready in XXX ms

  ➜  Local:   http://localhost:5000/
  ➜  Network: use --host to expose
```

### Terminal 3 - USSD Service (Optional, for testing)

```bash
cd ussd-service
npm start
```

---

## Step 7: Test Login

1. Open browser: http://localhost:5000
2. You should see the login page
3. Enter credentials:
   - **Email:** `admin@escrow.local`
   - **Password:** `admin123` (or whatever you set)
4. Click "Login"
5. Should redirect to dispute queue

**Troubleshooting:**

**"Invalid credentials" error:**
- Check admin exists: `SELECT * FROM admins WHERE email = 'admin@escrow.local';`
- Verify password hash is correct
- Check backend logs for auth errors

**"Network Error":**
- Verify backend is running: `curl http://localhost:3000/health`
- Check CORS settings in backend (should allow http://localhost:5000)
- Check browser console for errors

**"Token expired" on page refresh:**
- Check JWT_SECRET is set in backend/.env
- Verify cookie is being set (Browser DevTools → Application → Cookies)

---

## Step 8: Create Test Dispute

### Via USSD Simulator

1. Open USSD simulator: http://localhost:4000 (or wherever it's running)
2. Create a deal
3. Lock funds
4. Mark shipped
5. Mark delivered
6. Raise dispute as buyer

### Via Direct API (Quick Test)

```bash
# 1. Create deal
curl -X POST http://localhost:3000/deals \
  -H "Content-Type: application/json" \
  -d '{
    "senderPhone": "+250788111111",
    "driverPhone": "+250788222222",
    "receiverPhone": "+250788333333",
    "amount": "500000",
    "pin": "1234"
  }'

# 2. Get deal ID from response, then...
# 3. Lock funds, mark shipped, mark delivered, revoke (see backend API.md)
```

---

## Step 9: Test Resolution Flow

1. Login to admin portal
2. Should see test dispute in queue
3. Click "Review"
4. Examine timeline
5. Click one of the resolution buttons
6. Confirm in modal
7. Wait for transaction (should show success)
8. Verify:
   - Deal removed from queue
   - SMS notifications logged in backend
   - Deal appears in history

---

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Change default admin password
- [ ] Generate strong JWT_SECRET (256-bit random)
- [ ] Enable HTTPS (set `secure: true` for cookies)
- [ ] Set NODE_ENV=production
- [ ] Configure CORS properly
- [ ] Add rate limiting to /admin/login
- [ ] Set up backup database
- [ ] Monitor admin action logs
- [ ] Rotate JWT_SECRET periodically
- [ ] Use environment secrets manager (not .env files)

### Build Frontend

```bash
cd admin-portal
npm run build
```

Output in `admin-portal/dist/` - serve with:
- Nginx
- Apache
- Vercel
- Netlify
- AWS S3 + CloudFront

### Deploy Backend

Use process manager:

```bash
# PM2 example
cd backend
npm run build
pm2 start dist/main.js --name escrow-backend

# Or Docker
docker build -t escrow-backend .
docker run -p 3000:3000 escrow-backend
```

### Environment Variables

**Backend:**
```env
NODE_ENV=production
DATABASE_URL=<production-postgres-url>
JWT_SECRET=<strong-secret-256-bits>
JWT_EXPIRES_IN=8h
TREASURY_PRIVATE_KEY=<production-relay-wallet>
ADMIN_PRIVATE_KEY=<production-admin-wallet>
ESCROW_CONTRACT_ADDRESS=<mainnet-or-polygon-address>
ERWF_CONTRACT_ADDRESS=<mainnet-or-polygon-address>
RPC_URL=<production-rpc-url>
```

**Frontend:**
```env
VITE_API_URL=https://api.yourdomain.com
```

---

## Monitoring

### Logs to Watch

**Backend (admin-specific):**
```bash
# Follow logs
tail -f backend/logs/app.log | grep Admin

# Look for:
# ✅ Admin logged in: admin@escrow.local
# ⚖️  Dispute resolved: Deal #123, Outcome: DRIVER_FRAUD
# ❌ Admin login failed: admin@escrow.local
```

**Database Queries:**

```sql
-- Recent admin logins
SELECT name, email, last_login_at 
FROM admins 
ORDER BY last_login_at DESC;

-- Admin actions
SELECT * FROM deal_action_log 
WHERE action LIKE 'AdminResolution_%' 
ORDER BY timestamp DESC 
LIMIT 10;

-- Active disputes
SELECT deal_id, amount, dispute_reason_code, created_at 
FROM deals 
WHERE status = 'Disputed' 
ORDER BY created_at ASC;
```

---

## Troubleshooting Common Issues

### "Cannot GET /admin/disputes"

**Cause:** Backend not running or wrong URL

**Fix:**
```bash
# Check backend health
curl http://localhost:3000/health

# Check admin routes registered
curl http://localhost:3000/admin/me
# Should return 401 Unauthorized (good - means route exists)
```

### "Invalid token" after login

**Cause:** JWT_SECRET mismatch or cookie not being sent

**Fix:**
1. Check JWT_SECRET in backend/.env
2. Verify cookie in Browser DevTools (should see `admin_token`)
3. Check axios `withCredentials: true` in client.js
4. Verify backend CORS allows credentials

### Resolution button does nothing

**Cause:** Admin wallet has no gas or no ADMIN_ROLE

**Fix:**
```bash
# Check admin wallet balance
npx hardhat console --network amoy
const balance = await ethers.provider.getBalance("0xADMIN_WALLET");
console.log("Balance:", ethers.formatEther(balance));

# Check admin role
const escrow = await ethers.getContractAt("Escrow", "ADDRESS");
const ADMIN_ROLE = await escrow.ADMIN_ROLE();
const hasRole = await escrow.hasRole(ADMIN_ROLE, "0xADMIN_WALLET");
console.log("Has role:", hasRole);
```

### Timeline not showing actions

**Cause:** deal_action_log entries missing

**Fix:**
```sql
-- Check if actions logged
SELECT * FROM deal_action_log WHERE deal_id = 123;

-- If empty, check event listener is running
-- Backend logs should show: "📡 Syncing blockchain events..."
```

---

## Quick Reference

### Default Credentials (Development)
- **Email:** admin@escrow.local
- **Password:** admin123
- **⚠️ CHANGE IN PRODUCTION!**

### Default Ports
- Backend: 3000
- Admin Portal: 5000
- USSD Service: 4000

### Key Endpoints
- Login: POST /admin/login
- Disputes: GET /admin/disputes
- Resolve: POST /admin/disputes/:id/resolve
- History: GET /admin/disputes/history

### Resolution Outcomes
- `DRIVER_FRAUD` - Refund buyer
- `FAULTY_GOODS` - Refund buyer
- `FALSE_BUYER_CLAIM` - Pay farmer

---

## Support

For issues:
1. Check backend logs
2. Check browser console
3. Verify database state
4. Check blockchain transaction status
5. Review ADMIN_PORTAL.md for detailed documentation

---

**Status:** Ready for deployment  
**Last Updated:** July 13, 2026
