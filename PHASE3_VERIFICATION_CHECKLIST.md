# Phase 3 USSD - Quick Verification Checklist

**Use this checklist to quickly verify Phase 3 is working correctly**

---

## ✅ Installation Check

```bash
cd ussd-service
npm install
cp .env.example .env
```

**Expected:** No errors, node_modules created

---

## ✅ Server Startup Check

```bash
npm start
```

**Expected Output:**
```
✅ Registered 14 menu nodes
🚀 USSD Service running on port 4000
📞 USSD Shortcode: *384*96#
⏱️  Session timeout: 30s
🔗 Backend API: http://localhost:3000
```

**Status:** [ ] Pass / [ ] Fail

---

## ✅ File Structure Check

Run this command:
```bash
find src -type f -name "*.js" | wc -l
```

**Expected:** At least 25 files (server, nodes, utils, client, session)

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Menu Nodes Check

All 14 nodes must exist:
```bash
ls -1 src/menus/nodes/
```

**Expected files:**
- [x] ConfirmActionNode.js
- [x] CreateDealAmountNode.js
- [x] CreateDealConfirmNode.js
- [x] CreateDealDriverNode.js
- [x] CreateDealReceiverNode.js
- [x] DealActionsNode.js
- [x] DealListNode.js
- [x] DisputeReasonNode.js
- [x] EnterDisputePinNode.js
- [x] EnterPinNode.js
- [x] MainMenuNode.js
- [x] PinConfirmNode.js
- [x] PinSetupNode.js
- [x] ViewStatusNode.js

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Health Check

With server running:
```bash
curl http://localhost:4000/health
```

**Expected:**
```json
{
  "status": "healthy",
  "sessions": 0,
  "timestamp": "2026-07-13T..."
}
```

**Status:** [ ] Pass / [ ] Fail

---

## ✅ USSD Protocol Test

Test initial dial:
```bash
curl -X POST http://localhost:4000/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123","phoneNumber":"+250788999999","text":""}'
```

**Expected:** Response starts with `CON Welcome` or `CON Set your PIN`

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Simulator UI Check

1. Open `simulator-ui/index.html` in browser
2. Check for 3 phone panels
3. Each panel should have:
   - [ ] Phone number input
   - [ ] Dial button
   - [ ] Screen display
   - [ ] Text input field
   - [ ] Send button
   - [ ] SMS inbox

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Backend Integration Check

Ensure Phase 2 backend is running:
```bash
curl http://localhost:3000/health
```

**Expected:** HTTP 200 with success response

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Full Flow Test (Manual)

### Phone 1 (Sender):
1. [ ] Open simulator UI
2. [ ] Enter phone: +250788111111
3. [ ] Click "Dial"
4. [ ] See PIN setup prompt
5. [ ] Enter PIN: 1111
6. [ ] Confirm PIN: 1111
7. [ ] See Main Menu
8. [ ] Press 4 (Create Deal)
9. [ ] Enter receiver: +250788333333
10. [ ] Enter driver: +250788222222
11. [ ] Enter amount: 1000
12. [ ] Confirm: 1
13. [ ] Enter PIN: 1111
14. [ ] See "Deal created" message

### Phone 3 (Receiver):
1. [ ] Enter phone: +250788333333
2. [ ] Click "Dial"
3. [ ] Setup PIN: 3333
4. [ ] Main Menu → 3 (My Purchases)
5. [ ] Select deal → 1
6. [ ] Lock Funds → 1
7. [ ] Confirm → 1
8. [ ] Enter PIN: 3333
9. [ ] See "Funds locked" message

### Phone 1 (Sender):
1. [ ] Start new session (click "End" then "Dial")
2. [ ] Main Menu → 1 (My Shipments)
3. [ ] Select deal → 1
4. [ ] Mark Shipped → 1
5. [ ] Confirm → 1
6. [ ] Enter PIN: 1111
7. [ ] See "Marked as shipped" message

### Phone 2 (Driver):
1. [ ] Enter phone: +250788222222
2. [ ] Click "Dial"
3. [ ] Setup PIN: 2222
4. [ ] Main Menu → 2 (My Deliveries)
5. [ ] Select deal → 1
6. [ ] Mark Delivered → 1
7. [ ] Confirm → 1
8. [ ] Enter PIN: 2222
9. [ ] See "Marked as delivered" message

### All Phones:
1. [ ] Check SMS inbox on all 3 phones
2. [ ] Each should have received notifications
3. [ ] Messages should mention deal status changes

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Documentation Check

All files must exist:
- [x] README.md
- [x] USSD_PROTOCOL.md
- [x] MENU_TREE.md
- [x] IMPLEMENTATION_STATUS.md
- [x] PHASE3_COMPLETE.md
- [x] .env.example
- [x] package.json

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Error Handling Test

### Test 1: Invalid PIN
1. [ ] Try to create deal with wrong PIN
2. [ ] Should see "Incorrect PIN" message
3. [ ] Should allow retry

### Test 2: Session Timeout
1. [ ] Dial USSD
2. [ ] Wait 35 seconds
3. [ ] Try to input
4. [ ] Should see "Session expired" message

### Test 3: Invalid Phone Number
1. [ ] Create deal flow
2. [ ] Enter invalid phone (e.g., "abc")
3. [ ] Should re-prompt with error

### Test 4: Back Navigation
1. [ ] Navigate into any menu
2. [ ] Press 0
3. [ ] Should go back to previous screen

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Integration Points Check

### Check BackendClient methods exist:
```bash
grep "async " src/client/BackendClient.js
```

**Expected methods:**
- [x] setPin
- [x] createDeal
- [x] lockFunds
- [x] markShipped
- [x] markDelivered
- [x] revokeDeal
- [x] cancelDeal
- [x] getActiveDeals
- [x] getDealDetails
- [x] getNotifications

**Status:** [ ] Pass / [ ] Fail

---

## ✅ Validation Check

### Check validators exist:
```bash
grep "function " src/utils/validators.js
```

**Expected validators:**
- [x] isValidPhoneNumber
- [x] normalizePhoneNumber
- [x] isValidPin
- [x] isValidAmount
- [x] isValidChoice
- [x] isNumeric

**Status:** [ ] Pass / [ ] Fail

---

## 📊 Final Score

Count your passes:

- Total checks: 15
- Passed: ____
- Failed: ____

**Grade:**
- 15/15 = A+ (Perfect)
- 13-14/15 = A (Excellent)
- 11-12/15 = B (Good, minor issues)
- 9-10/15 = C (Functional, needs work)
- <9/15 = F (Major issues)

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'express'"
**Solution:** Run `npm install`

### Issue: "ECONNREFUSED localhost:3000"
**Solution:** Start Phase 2 backend first

### Issue: "Session expired" immediately
**Solution:** Increase `SESSION_TIMEOUT_SECONDS` in .env (default is now 90s, but can be increased to 120s for very slow typers)

### Issue: SMS not showing in inbox
**Solution:** 
1. Check backend is running
2. Verify notifications endpoint works
3. Check browser console for errors

### Issue: Menu not advancing
**Solution:**
1. Check session is active
2. Verify input is numeric
3. Check server logs for errors

---

## 🎉 Success Criteria

Phase 3 is considered **COMPLETE** if:
- ✅ All 15 checks pass
- ✅ Full 3-phone flow works end-to-end
- ✅ SMS notifications appear in all inboxes
- ✅ No critical errors in logs
- ✅ Documentation is readable and accurate

---

**Checklist completed by:** ________________  
**Date:** ________________  
**Overall Status:** [ ] PASS / [ ] FAIL

---

**Notes:**
