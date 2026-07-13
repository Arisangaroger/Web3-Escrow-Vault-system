# Admin Arbitration Portal - Documentation

**Phase 4 Implementation**  
**Status:** ✅ COMPLETE  
**Date:** July 13, 2026

---

## Overview

The Admin Arbitration Portal is a web-based dashboard that enables cooperative managers and market authorities to review and resolve disputed escrow deals. When a dispute is raised via the USSD interface, it appears in this portal with full context, allowing admins to investigate and issue binding resolutions that immediately move funds on the blockchain.

---

## Architecture

### Technology Stack

**Frontend:**
- React 18 (with Vite build tool)
- React Router for navigation
- Axios for API communication
- Native CSS for styling

**Backend:**
- NestJS module extension (AdminModule)
- JWT authentication with HTTP-only cookies
- Integrated with existing WalletsService and ContractsService

**Authentication:**
- Custodial admin wallet pattern (consistent with user wallets)
- JWT tokens with 8-hour expiration
- Cookie-based session management

---

## Features

### 1. Admin Authentication
- Email + password login
- JWT token-based sessions
- Automatic session validation on protected routes
- Secure logout with cookie clearing

### 2. Dispute Queue View
- Lists all active disputes (status = "Disputed")
- Sorted by oldest-first to prevent neglect
- Shows: Deal ID, amount, parties, reason, time since disputed
- Empty state when no disputes exist

### 3. Dispute Detail View
- **Deal Summary Card:** Amount, status, parties, timestamps
- **Timeline Component:** Chronological list of all actions with timestamps and actors
- **Resolution Panel:** Three outcome options with confirmation flow

### 4. Resolution Execution
Three resolution outcomes matching Phase 1 smart contract:

| Outcome | Description | Fund Distribution |
|---------|-------------|-------------------|
| **Driver Fraud** | Driver lied about delivery | 100% refund to buyer (receiver) |
| **Faulty Goods** | Goods were defective | 100% refund to buyer (receiver) |
| **False Buyer Claim** | Buyer making false claim | 100% payment to farmer (sender) |

### 5. Resolution History
- View all past resolved disputes
- Shows outcome, admin who resolved, timestamp
- Searchable/filterable table

### 6. Audit Logging
- Every resolution action logged to `deal_action_log`
- Includes admin email, outcome, transaction hash, timestamp
- Provides accountability and transparency

---

## API Endpoints

### Authentication
```
POST /admin/login
  Body: { email, password }
  Response: { success, data: { admin } }
  Sets HTTP-only cookie: admin_token

GET /admin/me
  Auth: Required (JWT token)
  Response: { success, data: { adminId, name, email, walletAddress } }

POST /admin/logout
  Clears admin_token cookie
  Response: { success, data: { message } }
```

### Disputes
```
GET /admin/disputes
  Auth: Required
  Response: { success, data: [disputes] }
  Returns all deals with status = "Disputed"

GET /admin/disputes/:dealId
  Auth: Required
  Response: { success, data: { deal, timeline, notifications } }
  Full deal details with action history

POST /admin/disputes/:dealId/resolve
  Auth: Required
  Body: { outcome: "DRIVER_FRAUD" | "FAULTY_GOODS" | "FALSE_BUYER_CLAIM" }
  Response: { success, data: { txHash } }
  Executes on-chain resolution

GET /admin/disputes/history
  Auth: Required
  Response: { success, data: [resolvedDisputes] }
  Past disputes with outcomes
```

---

## Database Schema

## Meta-Transaction Pattern

### User Actions vs Admin Actions

The system uses **different transaction patterns** for users and admins:

#### User Actions (EIP-712 Meta-Transactions)
- **Who:** Farmers, drivers, buyers
- **Actions:** createDeal, lockFunds, markShipped, markDelivered, revoke
- **Pattern:**
  1. User signs with custodial wallet (off-chain)
  2. Backend generates EIP-712 signature
  3. **Relay wallet** submits transaction to blockchain
  4. Smart contract verifies signature to identify real actor
  5. **Relay wallet pays gas**

#### Admin Actions (Direct Role-Based)
- **Who:** Cooperative managers, market authority
- **Actions:** resolveDispute
- **Pattern:**
  1. Admin authenticates via JWT (email + password)
  2. Backend uses **admin wallet directly** (not relay wallet)
  3. Smart contract checks msg.sender has ADMIN_ROLE
  4. **Admin wallet pays gas**

### Why the Difference?

1. **Smart Contract Design:**
   - User functions use `_verifySigner()` with signature parameter
   - Admin function uses `onlyRole(ADMIN_ROLE)` modifier (no signature)
   - Admin resolution requires direct role check on msg.sender

2. **Frequency & Gas Costs:**
   - User actions: Frequent (every deal step) → Relay pattern saves user gas
   - Admin actions: Rare (only disputes) → Direct submission is simpler

3. **Security Model:**
   - Users: Signature verification + nonce tracking
   - Admin: Role-based access control (OpenZeppelin standard)
   - Both are secure, just different authorization mechanisms

### Admin Wallet Configuration

```env
# Relay/treasury wallet — pays user meta-tx gas AND signs resolveDispute.
# On deploy, this address (or ADMIN_ADDRESS) receives Escrow ADMIN_ROLE.
TREASURY_PRIVATE_KEY="0xRELAY_WALLET_KEY"
```

**Prototype setup:** use the same key that deployed Escrow (or was set as `ADMIN_ADDRESS` at deploy). No separate `ADMIN_PRIVATE_KEY` is required.

**Critical:** `TREASURY_PRIVATE_KEY`'s address must hold `ADMIN_ROLE` on Escrow:

```bash
# If you used a non-deployer admin address, grant role once:
npx hardhat run scripts/grant-admin-role.js --network amoy
```

**See:** `ADMIN_META_TRANSACTION_EXPLANATION.md` for background; current code resolves disputes via the relay wallet.

---

## Database Schema

### Admins Table
```sql
CREATE TABLE admins (
  admin_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL, -- expected ADMIN_ROLE / relay address
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP
);
```

**Fields:**
- `admin_id`: Primary key
- `name`: Display name (e.g., "Musanze Cooperative Manager")
- `email`: Login identifier (unique)
- `password_hash`: Argon2 hashed password
- `wallet_address`: Must have `ADMIN_ROLE` on Escrow contract
- `created_at`: Account creation timestamp
- `last_login_at`: Last successful login

---

## Setup & Deployment

### Prerequisites
1. Backend running with database configured
2. Admin account created in database with wallet granted ADMIN_ROLE on-chain
3. Environment variables configured

### Environment Variables

**Backend (.env):**
```env
JWT_SECRET="your-jwt-secret-change-in-production"
JWT_EXPIRES_IN="8h"
```

**Frontend (.env):**
```env
VITE_API_URL="http://localhost:3000"
```

### Installation

**1. Database Migration:**
```bash
cd backend
npx prisma migrate dev --name add_admins_table
npx prisma generate
```

**2. Create Admin Account:**
```sql
-- Generate password hash first using Argon2
INSERT INTO admins (name, email, password_hash, wallet_address)
VALUES (
  'Market Authority Admin',
  'admin@escrow.local',
  '$argon2id$v=19$m=65536,t=3,p=4$...',  -- Hash of 'admin123'
  '0x...'  -- Admin wallet address with ADMIN_ROLE
);
```

**3. Install Dependencies:**
```bash
cd admin-portal
npm install
```

**4. Start Development Server:**
```bash
npm run dev
```

Portal will be available at: `http://localhost:5000`

---

## Usage Flow

### Typical Workflow

1. **Login:**
   - Navigate to `http://localhost:5000`
   - Enter admin credentials
   - JWT token stored in HTTP-only cookie

2. **Review Disputes:**
   - Dashboard shows all active disputes
   - Click "Review" on any dispute

3. **Investigate:**
   - Review deal summary (amount, parties)
   - Examine timeline of actions
   - Look for red flags (e.g., "Delivered" marked suspiciously early)

4. **Resolve:**
   - Select appropriate outcome button
   - Confirmation modal appears
   - Confirm action
   - Wait for blockchain transaction
   - Success notification

5. **Post-Resolution:**
   - Deal removed from active queue
   - SMS notifications sent to all 3 parties (automatic)
   - Resolution logged to audit trail
   - Deal appears in History view

---

## Security Considerations

### Authentication
- Passwords hashed with Argon2id (same as user PINs)
- JWT tokens with 8-hour expiration
- HTTP-only cookies prevent XSS attacks
- Rate limiting (IP) plus **account lockout** after 5 failed passwords (15 min)
- Idle session expiry: JWT refreshed on each request; logout after **30 min inactivity** (8h absolute max)
- On-chain `resolveDispute` is signed by the **relay/treasury wallet** (deployer ADMIN_ROLE — not a separate admin key)

### Authorization
- All admin routes protected by AdminAuthGuard
- Token validated on every request
- Admin wallet managed custodially (same as users)

### Audit Trail
- Every resolution action logged with:
  - Admin identifier (email)
  - Deal ID
  - Outcome chosen
  - Transaction hash
  - Timestamp
- Immutable blockchain record provides additional verification

### Confirmation Flow
- Modal confirmation required before resolution
- Warning message about irreversibility
- Prevents accidental fund movement

---

## Timeline Interpretation Guide

### What to Look For

**Normal Pattern:**
```
08:00 — Farmer marked "Created"
08:05 — Farmer marked "Locked" (funds deposited)
08:10 — Farmer marked "Shipped"
14:30 — Driver marked "Delivered" (realistic travel time)
14:45 — Buyer raised Dispute: "Faulty Goods"
```

**Red Flag - Driver Fraud:**
```
08:00 — Farmer marked "Created"
08:05 — Farmer marked "Locked"
08:10 — Farmer marked "Shipped"
08:12 — Driver marked "Delivered" ⚠️ (2 minutes later - impossible)
08:15 — Buyer raised Dispute: "Goods not received"
```
→ Resolution: **Driver Fraud**

**Red Flag - False Claim:**
```
08:00 — Farmer marked "Created"
08:05 — Farmer marked "Locked"
08:10 — Farmer marked "Shipped"
14:30 — Driver marked "Delivered" (realistic timing)
[3 days pass]
Day 4 — Buyer raised Dispute: "Goods not received"
```
→ Resolution: **False Buyer Claim** (buyer waited too long)

---

## Integration with Phase 2 & 3

### Phase 2 (Backend)
- Admin module extends existing NestJS backend
- Reuses WalletsService for admin wallet
- Reuses ContractsService for on-chain resolution
- Reuses NotificationsService for SMS (automatic)
- Reuses PrismaService for database access

### Phase 3 (USSD)
- Disputes created via USSD appear in admin portal
- Resolution triggers SMS back to USSD users
- Same notification infrastructure

### Phase 1 (Blockchain)
- Admin wallet must have `ADMIN_ROLE` on Escrow contract
- Calls `resolveDispute(dealId, amountToSender, amountToReceiver)`
- Funds move immediately upon transaction confirmation

---

## Testing

### Manual Testing Checklist

**Authentication:**
- [ ] Login with correct credentials succeeds
- [ ] Login with incorrect credentials fails
- [ ] Session persists after page refresh
- [ ] Logout clears session

**Dispute Queue:**
- [ ] Shows all disputed deals
- [ ] Empty state when no disputes
- [ ] Correct sorting (oldest first)
- [ ] Navigation to detail works

**Dispute Detail:**
- [ ] Deal summary shows correct info
- [ ] Timeline in chronological order
- [ ] All actions visible with timestamps
- [ ] Party info displayed correctly

**Resolution:**
- [ ] Each outcome button works
- [ ] Confirmation modal appears
- [ ] Cancel returns without action
- [ ] Confirm executes resolution
- [ ] Success state shows transaction hash
- [ ] Deal removed from queue

**History:**
- [ ] Resolved disputes appear
- [ ] Outcome correctly displayed
- [ ] Admin attribution shown
- [ ] Timestamps accurate

### End-to-End Test

**Full System Integration:**
1. Start backend: `cd backend && npm run start:dev`
2. Start USSD service: `cd ussd-service && npm start`
3. Start admin portal: `cd admin-portal && npm run dev`
4. Use USSD simulator to create a dispute:
   - Create deal
   - Lock funds
   - Mark shipped
   - Mark delivered
   - Raise dispute
5. Login to admin portal
6. Verify dispute appears in queue
7. Review timeline
8. Resolve dispute
9. Verify all 3 parties receive SMS notification
10. Verify deal removed from queue
11. Verify deal in history

---

## File Structure

```
admin-portal/
├── src/
│   ├── main.jsx                    # React entry point
│   ├── App.jsx                     # Routing setup
│   ├── api/
│   │   └── client.js               # API wrapper (Axios)
│   ├── context/
│   │   └── AuthContext.jsx         # Global auth state
│   ├── pages/
│   │   ├── Login.jsx               # Login form
│   │   ├── DisputeQueue.jsx        # Main dashboard
│   │   ├── DisputeDetail.jsx       # Detail + timeline
│   │   └── History.jsx             # Resolved disputes
│   ├── components/
│   │   ├── Timeline.jsx            # Action timeline
│   │   ├── ResolutionPanel.jsx     # Resolution buttons
│   │   ├── DealSummaryCard.jsx     # Deal header
│   │   └── ConfirmModal.jsx        # Confirmation dialog
│   └── styles/
│       └── index.css               # Global styles
├── index.html
├── vite.config.js
└── package.json

backend/src/modules/admin/
├── admin.module.ts                 # NestJS module
├── admin.controller.ts             # API routes
├── admin.service.ts                # Business logic
└── dto/
    ├── login.dto.ts                # Login validation
    └── resolve-dispute.dto.ts      # Resolution validation

backend/src/middleware/
└── admin-auth.guard.ts             # Route protection
```

---

## Production Deployment

### Security Hardening

**Before Production:**
1. Change default admin password
2. Generate strong JWT_SECRET (256-bit random)
3. Enable HTTPS (set `secure: true` for cookies)
4. Add rate limiting to login endpoint
5. Configure CORS properly
6. Enable security headers (Helmet.js)
7. Set NODE_ENV=production
8. Review admin wallet key storage

**Recommended:**
- Use environment-specific admin accounts
- Rotate JWT_SECRET periodically
- Monitor admin action logs
- Set up alerting for suspicious activity
- Regular security audits

### Scaling Considerations

**Current Design (Single Admin):**
- Suitable for cooperative with 1-2 managers
- Simple authentication model
- Direct custodial wallet

**Future Enhancements:**
- Multi-admin support with role separation
- Photo/evidence upload during resolution
- Two-way messaging with parties
- Analytics dashboard (dispute frequency, resolution times)
- Mobile app version

---

## Troubleshooting

### Common Issues

**"Failed to load disputes" Error:**
- Check backend is running: `curl http://localhost:3000/health`
- Check admin token cookie exists in browser DevTools
- Verify JWT_SECRET matches between backend and cookie

**Login Fails:**
- Verify admin exists in database: `SELECT * FROM admins WHERE email = '...'`
- Verify password hash is correct (use Argon2 tool)
- Check backend logs for auth errors

**Resolution Button Does Nothing:**
- Open browser console for errors
- Check network tab for API response
- Verify admin wallet has ADMIN_ROLE on contract
- Check backend has sufficient gas for transaction

**Timeline Not Showing:**
- Verify `deal_action_log` table has entries
- Check API response in network tab
- Verify timeline data structure matches component

---

## Support & Maintenance

### Logs

**Backend:**
```bash
cd backend
npm run start:dev  # Watch mode with logs
```

**Frontend:**
```bash
cd admin-portal
npm run dev  # Vite dev server with HMR
```

### Database Queries

**View all admins:**
```sql
SELECT admin_id, name, email, wallet_address, last_login_at FROM admins;
```

**View admin actions:**
```sql
SELECT * FROM deal_action_log
WHERE action LIKE 'AdminResolution_%'
ORDER BY timestamp DESC;
```

**View disputed deals:**
```sql
SELECT deal_id, amount, status, dispute_reason_code, created_at
FROM deals
WHERE status = 'Disputed'
ORDER BY created_at ASC;
```

---

## Success Criteria

Phase 4 is complete when:
- ✅ Admin can log in with credentials
- ✅ Admin sees list of disputed deals
- ✅ Admin can view full timeline of a dispute
- ✅ Admin can select resolution outcome
- ✅ Confirmation modal appears before action
- ✅ Blockchain transaction executes on confirm
- ✅ All 3 parties receive SMS notification
- ✅ Deal removed from dispute queue
- ✅ Deal appears in history view
- ✅ Action logged to audit trail

---

## Related Documentation

- `phase4_admin_arbitration_portal_plan.md` - Full specification
- `PHASE4_IMPLEMENTATION_PLAN.md` - Implementation roadmap
- `backend/ARCHITECTURE.md` - System architecture
- `backend/API.md` - API documentation
- `AUTHENTICATION_UPDATE_SUMMARY.md` - PIN authentication details

---

**Phase 4 Status:** ✅ COMPLETE  
**Next Phase:** Phase 5 - Polish, Testing & Demo Preparation
