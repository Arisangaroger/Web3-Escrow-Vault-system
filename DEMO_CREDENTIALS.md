# Demo Credentials & Walkthrough

This document provides test credentials and step-by-step demo scripts for the Agricultural Escrow System.

---

## Demo User Credentials

After running `npm run seed:demo` in the `backend` folder:

| User Name | Phone Number | PIN | Role | Notes |
|-----------|-------------|-----|------|-------|
| Musanze Cooperative | +250788100001 | 1111 | Farmer/Sender | Northern Rwanda potato farmer |
| Kigali Fresh Market | +250788200002 | 2222 | Buyer/Receiver | Urban market buyer |
| Driver James | +250788300003 | 3333 | Driver | Logistics provider |
| Huye Farmer | +250788100004 | 4444 | Farmer/Sender | Southern Rwanda coffee farmer |
| Rubavu Market | +250788200005 | 5555 | Buyer/Receiver | Western Rwanda market |

**Admin Portal Credentials:**
- Email: `admin@escrow.local`
- Password: `admin123` ⚠️ **Change in production!**

**Before presenting:** follow [DEMO_REHEARSAL.md](DEMO_REHEARSAL.md) (environment checklist + dry-run log).  
**Non-technical terms:** [GLOSSARY.md](GLOSSARY.md).

---

## Demo Deal States (After Seed)

`npm run seed:demo` now creates **real on-chain Escrow deals** (plus matching DB rows), mints eRWF to buyers, and encrypts wallets with `ENCRYPTION_KEY`.

| Status | Description | Demo Purpose |
|--------|-------------|--------------|
| `Created` | Awaiting fund lock | Creation flow / 24h deadline |
| `FundsLocked` | Ready to ship | Mark Shipped |
| `Shipped` | In transit | Mark Delivered |
| `Delivered` | Dispute window open | Full ~3h window on Amoy (keeper auto-releases after) |
| `Disputed` | Ready for admin | Admin Portal arbitration |

Deal IDs are whatever `nextDealId` issues on your deployed Escrow (not hard-coded #1–#5).

**Simulator tip:** enter the E.164 phones above, or local `0788100001` form — USSD normalizes to `+250…`.

---

## Quick Start Demo Script

### Prerequisites
```bash
# Contracts must already be deployed; backend/.env must include addresses + keys.

# Terminal 1: Backend
cd backend
npm run reset:demo   # clears demo rows from DB (not the chain)
npm run seed:demo    # mints eRWF, creates on-chain deals in all states
npm run start:dev

# Terminal 2: USSD Service
cd ussd-service
npm start

# Terminal 3: Admin Portal
cd admin-portal
npm run dev
```

**Note:** `seed:demo` wipes previous demo users/deals in the DB first, then creates **new** deals on your existing Amoy Escrow. Old Amoy deals remain on-chain but are unused by the app. There is no chain wipe — use `reset:demo` (DB only) between rehearsal runs.

**Access URLs:**
- USSD Simulator: http://localhost:4000
- Admin Portal: http://localhost:5000
- Backend API: http://localhost:3000
- Status Page: http://localhost:3000/internal/status

---

## Demo Walkthrough 1: Happy Path (End-to-End)

**Scenario:** Musanze Cooperative sells potatoes to Kigali Fresh Market

### Step 1: Create Deal (Sender)
1. Open USSD Simulator: http://localhost:4000
2. Enter phone: `+250788100001` (Musanze Cooperative)
3. Click "Send" to dial USSD code
4. Enter PIN: `1111`
5. Select: `1` (Create Deal)
6. Enter buyer phone: `+250788200002`
7. Enter driver phone: `+250788300003`
8. Enter amount: `500000` (500,000 RWF)
9. Confirm: `1` (Yes)
10. See: "END Deal #X created. Awaiting buyer fund lock."

**Verify:**
- Check notifications for all 3 parties
- Open status page: http://localhost:3000/internal/status
- See deal count: Created = 1

### Step 2: Lock Funds (Receiver/Buyer)
1. Open new USSD session
2. Enter phone: `+250788200002` (Kigali Fresh Market)
3. Enter PIN: `2222`
4. Select: `2` (Lock Funds for Deal)
5. Select the deal from list
6. Confirm: `1` (Yes)
7. See: "END Processing... You will receive SMS shortly."

**Verify:**
- Check notifications: All parties notified "Funds locked"
- Farmer can now safely ship

### Step 3: Mark Shipped (Sender)
1. Open USSD session for `+250788100001`
2. PIN: `1111`
3. Select: `3` (Mark Deal as Shipped)
4. Select the deal
5. Confirm: `1` (Yes)
6. See: "END Processing..."

**Verify:**
- Check notifications: "Goods shipped"
- Driver and buyer both notified

### Step 4: Mark Delivered (Driver)
1. Open USSD session for `+250788300003` (Driver James)
2. PIN: `3333`
3. Select: `4` (Mark Deal as Delivered)
4. Select the deal
5. Confirm: `1` (Yes)
6. See: "END Processing..."

**Verify:**
- **KEY FEATURE:** All 3 parties receive SIMULTANEOUS notification
- Buyer notification warns: "If you did NOT receive goods, dispute within 3 hours"
- Status page shows: Delivered = 1

### Step 5: Auto-Release (Wait or Time-Warp)
**Option A:** Wait 3 hours (not practical for demo)  
**Option B:** Use pre-seeded Deal #4 (releases in 5 minutes)

**After 3-hour window:**
- Keeper job detects eligible deal
- Calls `releaseFunds()` on contract
- Funds transfer to farmer
- All parties notified: "Funds released"

---

## Demo Walkthrough 2: Fraud Detection & Dispute

**Scenario:** Driver lies about delivery, buyer disputes

### Setup: Create & Lock Funds
Use Steps 1-2 from Happy Path above, or use pre-seeded Deal #5

### Step 3: Driver Marks Delivered (Fraudulently)
1. USSD session for driver `+250788300003`
2. PIN: `3333`
3. Select: `4` (Mark Delivered)
4. Select the deal
5. **Driver marks delivered even though goods NOT actually delivered**

### Step 4: Triangular Broadcast (The Magic)
**What happens:**
- Driver's phone shows: "END Processing..."
- Farmer's phone shows: "Deal #X marked delivered by driver"
- **Buyer's phone shows:** "Deal #X delivered. If NOT received, DISPUTE NOW!"

### Step 5: Buyer Disputes Immediately
1. Open USSD session for buyer `+250788200002`
2. PIN: `2222`
3. Select: `5` (Dispute Deal)
4. Select the deal
5. Select reason: `2` (Driver fraud - marked delivered too early)
6. Confirm: `1` (Yes)
7. See: "END Dispute filed. Admin will review."

**Verify:**
- Check notifications: All parties notified "Deal disputed"
- Status page: Disputed = 1

### Step 6: Admin Resolution
1. Open Admin Portal: http://localhost:5000
2. Login: `admin@escrow.local` / `admin123`
3. Click disputed deal in queue
4. **Review timeline:**
   - Created: 12 hours ago
   - Funds locked: 11.5 hours ago
   - Shipped: 11 hours ago
   - **Delivered: 10.9 hours ago** ← Red flag! Too fast
   - Disputed: 10.5 hours ago
5. Click "Resolve Dispute"
6. Select: `DRIVER_FRAUD` (Refund buyer fully)
7. Enter note: "Timeline shows delivered marked 6 minutes after shipped. Physical verification confirmed goods not delivered."
8. Click "Submit Resolution"

**Result:**
- 100% funds returned to buyer
- 0% to farmer
- All parties notified of resolution
- Deal status: `Resolved`

---

## Demo Walkthrough 3: Timelock Features

### A. 24-Hour Auto-Cancel (Funds Not Locked)

**Scenario:** Buyer creates deal but never locks funds

1. Create deal (any sender)
2. Do NOT lock funds
3. Wait 24 hours OR use pre-seeded expired deal
4. Keeper job runs (every 5 minutes)
5. Detects deal past deadline
6. Calls `autoCancelIfUnlocked()`
7. Deal cancelled, all parties notified

**Demo Shortcut:**
- Use deal that's 23 hours 59 minutes old
- Wait 1 minute for keeper job

### B. 3-Hour Dispute Window (Auto-Release)

**Scenario:** Goods delivered, no issues, no dispute

1. Complete Steps 1-4 from Happy Path
2. Deal enters `Delivered` state with `payoutReadyTime = now + 3 hours`
3. Wait 3 hours (or use pre-seeded Deal #4 that releases in 5 min)
4. Keeper job runs
5. Detects deal past dispute window
6. Calls `releaseFunds()`
7. Funds transfer to farmer

---

## Demo Walkthrough 4: Multi-Role Flexibility

**Scenario:** Same person is farmer in one deal, driver in another

### Deal A: Musanze Coop as Sender
1. Phone: `+250788100001` (Musanze)
2. Create deal with buyer `+250788200002`, driver `+250788300003`
3. Musanze is **sender** in this deal

### Deal B: Musanze Coop as Driver
1. Phone: `+250788100004` (Huye Farmer) creates deal
2. Buyer: `+250788200005`
3. Driver: `+250788100001` (Musanze)
4. **Same phone number, different role**

**Demonstrates:**
- Role assignment per deal, not per user
- USSD menu shows correct actions based on role
- Timeline accurately tracks who did what

---

## Demo Walkthrough 5: Security Features

### A. PIN Lockout
1. Enter wrong PIN 5 times on any user
2. 6th attempt fails with: "Account locked. Contact admin."
3. Show Admin Portal → Users → Unlock feature

### B. Rate Limiting
1. Try logging into Admin Portal 6 times rapidly with wrong password
2. 6th attempt blocked: "Too many attempts. Try again in 15 minutes."

### C. Session Timeout
1. Open USSD session
2. Leave idle for 90 seconds
3. Next input returns: "END Session expired. Please dial again."

---

## Troubleshooting Guide

### Issue: "User not found" on USSD
**Cause:** Seed script not run or database cleared  
**Fix:**
```bash
cd backend
npm run seed:demo
```

### Issue: "Insufficient balance" when locking funds
**Cause:** User wallet has no eRWF tokens  
**Fix:**
```bash
# Seed script mints eRWF to buyers and creates on-chain deals (requires live RPC + deployed contracts)
# Or manually mint via backend API:
POST http://localhost:3000/users/:phone/balance
{ "amount": "1000" }
```

### Issue: Transactions not confirming
**Cause:** Blockchain RPC issues or treasury wallet out of gas  
**Fix:**
- Check RPC endpoint in backend `.env`
- Check treasury wallet balance: http://localhost:3000/internal/status
- Fund treasury wallet with testnet MATIC if needed

### Issue: Events not syncing to database
**Cause:** Event listener lag or RPC connection issues  
**Fix:**
- Check backend logs for "Event sync completed"
- Verify `lastSyncedBlock` in database
- Manually trigger sync (wait 30 seconds for next poll)

### Issue: Keeper jobs not running
**Cause:** Cron scheduler not enabled or no eligible deals  
**Fix:**
- Check backend logs for "Keeper: sweep completed"
- Verify `@nestjs/schedule` is running
- Check deal states match eligibility criteria

---

## Common Demo Mistakes

### ❌ Using Wrong Phone Format
- USSD accepts: `+250788100001` OR `0788100001`
- Backend stores: `+250788100001` (E.164)
- Don't mix formats mid-demo

### ❌ Forgetting to Fund Buyer Wallet
- Seed script handles this automatically
- If manually creating users, mint eRWF first

### ❌ Not Checking Notifications
- Notifications are key to showing triangular broadcast
- Open notifications tab in simulator for each phone

### ❌ Confusing Deal IDs
- Deal IDs are sequential: #1, #2, #3...
- Seed script creates deals 1-5
- New deals will be #6, #7, etc.

---

## Advanced Demo: Evidence & Timeline

### Show Admin Investigation Process

1. **Review Timeline:**
   - Click disputed deal in Admin Portal
   - Timeline shows all actions with timestamps and actors
   - Look for red flags:
     - Delivered too quickly after shipped
     - Suspiciously fast progression
     - Mismatch in expected logistics time

2. **Check Phone Numbers:**
   - Timeline shows phone numbers (not wallet addresses)
   - Verify each party's role
   - Confirm driver is independent (not buyer's alternate phone)

3. **Resolution Decision Matrix:**
   - `DRIVER_FRAUD`: Delivered marked too early, buyer confirms no delivery
   - `FAULTY_GOODS`: Buyer received but quality issues (partial refund)
   - `FALSE_BUYER_CLAIM`: Timeline shows normal delivery time, buyer may be lying

---

## Demo Best Practices

1. **Reset Between Demos:**
   ```bash
   cd backend
   npm run reset:demo
   npm run seed:demo
   ```

2. **Keep Status Page Open:**
   - http://localhost:3000/internal/status
   - Shows real-time deal counts and treasury balance

3. **Open Multiple Browser Windows:**
   - 3 USSD simulator tabs (one per phone)
   - 1 Admin Portal tab
   - 1 Status page tab

4. **Prepare Talking Points:**
   - Problem: Trust gap in rural agricultural trade
   - Solution: Blockchain escrow + USSD accessibility
   - Key Innovation: Triangular notification prevents fraud
   - Forward-Looking: BNR e-Franc compatibility

5. **Handle Questions:**
   - "Why USSD?" → 70% feature phone adoption in Rwanda
   - "Why blockchain?" → Immutable audit trail, no central authority
   - "What about KYC?" → See LIMITATIONS.md, production path defined
   - "Production ready?" → Prototype demonstrating feasibility

---

## Recording Demo Video

### Recommended Script (5-7 minutes)

**Intro (30s):**
- Problem statement
- Target users (rural farmers)
- Solution overview

**Act 1: Happy Path (2min):**
- Create deal → Lock funds → Ship → Deliver → Release
- Show notifications at each step
- Emphasize speed and accessibility

**Act 2: Fraud Prevention (2min):**
- Driver marks delivered early
- **Triangular broadcast** (highlight this!)
- Buyer disputes immediately
- Admin reviews timeline and resolves

**Act 3: System Features (1.5min):**
- Show status page (deal counts, treasury balance)
- Show timelock features (24hr auto-cancel, 3hr auto-release)
- Show multi-role flexibility

**Conclusion (1min):**
- Recap key innovations
- Forward-compatibility with BNR e-Franc
- Production roadmap (LIMITATIONS.md)

### Screen Recording Tips

- 1920x1080 resolution
- Hide desktop icons
- Close unrelated tabs
- Use Chrome DevTools to simulate mobile if needed
- Practice before recording (use reset script)

---

## Testing Checklist

Before presenting:

- [ ] All services running (backend, USSD, admin portal)
- [ ] Seed script run successfully
- [ ] Demo credentials tested (all PINs work)
- [ ] Notifications visible for all parties
- [ ] Status page accessible
- [ ] Admin portal login works
- [ ] At least one full happy path tested
- [ ] At least one dispute resolution tested
- [ ] Treasury wallet has sufficient testnet MATIC
- [ ] Blockchain RPC responding (check backend logs)

---

**Last Updated:** Phase 5 Implementation  
**For Questions:** Check README.md, LIMITATIONS.md, or backend/API.md

