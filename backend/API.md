# Escrow Backend API Reference

Base URL: `http://localhost:3000`

All endpoints return responses in this format:
```json
{
  "success": true/false,
  "data": { ... },      // On success
  "error": "message"    // On failure
}
```

---

## User Management

### Set PIN
**POST** `/users/:phone/pin`

Set PIN for first-time user (creates wallet automatically if needed).

**Request:**
```json
{
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "PIN set successfully"
  }
}
```

**Validation:**
- PIN must be exactly 4 digits
- Phone number format: `+250788123456` or `250788123456`

---

## Deal Management

### Create Deal
**POST** `/deals`

Create a new deal between three parties.

**Request:**
```json
{
  "senderPhone": "+250788123456",
  "driverPhone": "+250788234567",
  "receiverPhone": "+250788345678",
  "amount": "1000",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dealId": 0,
    "txHash": "0xabc..."
  }
}
```

**Business Rules:**
- Sender must have PIN set
- All three parties must have different addresses
- Amount is in RWF (will be converted to 18-decimal token units)
- Deal automatically expires in 24 hours if funds not locked

---

### Lock Funds
**POST** `/deals/:dealId/lock`

Receiver locks eRWF tokens into escrow.

**Request:**
```json
{
  "phone": "+250788345678",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc..."
  }
}
```

**Business Rules:**
- Only receiver can lock funds
- Must be called within 24 hours of deal creation
- Receiver must have sufficient eRWF balance
- Automatic token approval is handled by backend

---

### Mark Shipped
**POST** `/deals/:dealId/ship`

Sender marks goods as shipped.

**Request:**
```json
{
  "phone": "+250788123456",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc..."
  }
}
```

**Business Rules:**
- Only sender can mark shipped
- Funds must be locked first

---

### Mark Delivered
**POST** `/deals/:dealId/deliver`

Driver marks goods as delivered (starts 3-hour dispute window).

**Request:**
```json
{
  "phone": "+250788234567",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc..."
  }
}
```

**Business Rules:**
- Only driver can mark delivered
- Goods must be shipped first
- **CRITICAL:** Triggers triangular broadcast to sender AND receiver
- Receiver has 3 hours to dispute if goods not actually received

---

### Revoke/Dispute Deal
**POST** `/deals/:dealId/revoke`

Sender or receiver disputes the deal.

**Request:**
```json
{
  "phone": "+250788345678",
  "pin": "1234",
  "reasonCode": 1
}
```

**Reason Codes:**
- 1: Goods not received
- 2: Wrong items delivered
- 3: Damaged goods
- 4: Quantity mismatch
- 5: Other

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc..."
  }
}
```

**Business Rules:**
- Only sender or receiver can revoke
- Only available after funds locked
- Freezes deal for admin resolution
- All parties notified

---

### Cancel Deal (Before Lock)
**POST** `/deals/:dealId/cancel`

Sender or receiver cancels before funds locked.

**Request:**
```json
{
  "phone": "+250788123456",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc..."
  }
}
```

**Business Rules:**
- Only available before funds locked
- Either sender or receiver can cancel
- No funds are transferred

---

### Get Active Deals (Role-Segmented)
**GET** `/users/:phone/deals`

Get all active deals for a phone number, segmented by role.

**Response:**
```json
{
  "success": true,
  "data": {
    "asSeller": [
      {
        "dealId": 0,
        "amount": "1000",
        "status": "Shipped",
        "createdAt": "2026-07-12T10:30:00Z",
        "counterparties": {
          "sender": "+250788123456",
          "driver": "+250788234567",
          "receiver": "+250788345678"
        }
      }
    ],
    "asDriver": [...],
    "asBuyer": [...]
  }
}
```

**Deal Statuses:**
- `Created` - Deal created, awaiting funds
- `FundsLocked` - Buyer locked funds
- `Shipped` - Seller marked shipped
- `Delivered` - Driver marked delivered (3-hour window active)
- `Disputed` - Deal under dispute
- `Released` - Funds released to seller (terminal)
- `Cancelled` - Deal cancelled (terminal)
- `Resolved` - Dispute resolved by admin (terminal)

---

### Get Deal Details
**GET** `/deals/:dealId`

Get full details of a specific deal.

**Response:**
```json
{
  "success": true,
  "data": {
    "dealId": 0,
    "senderPhone": "+250788123456",
    "driverPhone": "+250788234567",
    "receiverPhone": "+250788345678",
    "amount": "1000",
    "status": "Delivered",
    "createdAt": "2026-07-12T10:30:00Z",
    "fundLockDeadline": "2026-07-13T10:30:00Z",
    "payoutReadyTime": "2026-07-12T15:30:00Z",
    "disputeReasonCode": null,
    "txHashCreated": "0xabc...",
    "actionLogs": [
      {
        "action": "MarkedDelivered",
        "actorPhone": "+250788234567",
        "timestamp": "2026-07-12T12:00:00Z",
        "txHash": "0xdef..."
      }
    ]
  }
}
```

---

## Admin Functions

Dispute resolution is **not** exposed on the public `/deals/*` API.
Use the authenticated admin portal endpoints instead:

**POST** `/admin/disputes/:dealId/resolve`  
Auth: admin JWT cookie  
Body: `{ "outcome": "DRIVER_FRAUD" | "FAULTY_GOODS" | "FALSE_BUYER_CLAIM" }`

The backend maps the outcome to a sender/receiver split and calls on-chain `resolveDispute` via the relay wallet (`ADMIN_ROLE`).

---

## Testing Utilities

### Mint Tokens
**POST** `/test/mint`

Mint eRWF tokens to a user (testing only).

**Request:**
```json
{
  "phone": "+250788123456",
  "amount": "10000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc...",
    "address": "0x1234..."
  }
}
```

**Note:** Only works if treasury wallet has OPERATOR_ROLE on eRWF contract.

---

### Health Check
**GET** `/health`

Check API health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-07-12T10:30:00Z"
  }
}
```

---

## Error Handling

All errors return HTTP 200 with:
```json
{
  "success": false,
  "error": "Error message"
}
```

### Common Errors:
- `User not found` - Phone number not registered
- `Invalid PIN` - Wrong PIN entered
- `Account locked. Try again in X minute(s)` - 5 failed PIN attempts
- `Only receiver can lock funds` - Wrong role for action
- `Deal not in Created status` - Invalid state transition
- `Fund lock deadline passed` - 24-hour window expired
- `Dispute window not expired` - Trying to release funds too early

---

## PIN Security

- **Max Attempts:** 5 failed attempts
- **Lockout Duration:** 15 minutes
- **Storage:** Hashed with argon2id + server-side pepper
- **Validation:** 4 digits, numeric only

---

## Automatic Processes (Keeper Jobs)

### Auto-Cancel
- **Trigger:** Deal in Created status, 24 hours past creation
- **Frequency:** Every 5 minutes
- **Action:** Automatically cancels deal

### Auto-Release
- **Trigger:** Deal in Delivered status, 3 hours past delivery
- **Frequency:** Every 5 minutes
- **Action:** Automatically releases funds to sender

**Note:** These are permissionless on-chain, but executed by backend keeper for reliability.

---

## Event-Driven Notifications

All actions trigger SMS notifications (simulated in Phase 2):

| Event | Recipients | Message Purpose |
|-------|-----------|-----------------|
| DealCreated | Driver, Receiver | New deal invitation |
| FundsLocked | Sender, Driver | Confirm funds secured |
| MarkedShipped | Driver, Receiver | Pickup/delivery alert |
| **MarkedDelivered** | **Sender, Receiver** | **TRIANGULAR BROADCAST** (fraud prevention) |
| DealRevoked | All 3 parties, Admin | Dispute alert |
| FundsReleased | All 3 parties | Transaction complete |
| DisputeResolved | All 3 parties | Admin decision |
| DealAutoCancelled | All 3 parties | Expiration notice |

---

## Integration Testing Flow

### Happy Path
```bash
# 1. Setup users
curl -X POST http://localhost:3000/users/+250788111111/pin -d '{"pin":"1111"}'
curl -X POST http://localhost:3000/users/+250788222222/pin -d '{"pin":"2222"}'
curl -X POST http://localhost:3000/users/+250788333333/pin -d '{"pin":"3333"}'

# 2. Mint tokens to receiver
curl -X POST http://localhost:3000/test/mint -d '{"phone":"+250788333333","amount":"5000"}'

# 3. Create deal
curl -X POST http://localhost:3000/deals -d '{
  "senderPhone":"+250788111111",
  "driverPhone":"+250788222222",
  "receiverPhone":"+250788333333",
  "amount":"1000",
  "pin":"1111"
}'

# 4. Lock funds (receiver)
curl -X POST http://localhost:3000/deals/0/lock -d '{"phone":"+250788333333","pin":"3333"}'

# 5. Mark shipped (sender)
curl -X POST http://localhost:3000/deals/0/ship -d '{"phone":"+250788111111","pin":"1111"}'

# 6. Mark delivered (driver)
curl -X POST http://localhost:3000/deals/0/deliver -d '{"phone":"+250788222222","pin":"2222"}'

# 7. Wait 3 hours (or let keeper auto-release)
# Funds automatically released to sender

# 8. Check final status
curl http://localhost:3000/deals/0
```

### Dispute Path
```bash
# ... steps 1-6 same as above ...

# 7. Receiver disputes (within 3 hours)
curl -X POST http://localhost:3000/deals/0/revoke -d '{
  "phone":"+250788333333",
  "pin":"3333",
  "reasonCode":1
}'

# 8. Admin resolves via authenticated portal API (JWT cookie required)
# Login first: POST /admin/login → cookie admin_token
curl -X POST http://localhost:3000/admin/disputes/0/resolve \
  -H 'Content-Type: application/json' \
  -b 'admin_token=<jwt>' \
  -d '{"outcome":"DRIVER_FRAUD"}'
```

---

## Production Considerations (Phase 3+)

1. **Authentication:** Add JWT/API keys for USSD gateway
2. **Rate Limiting:** Implement per-phone rate limits
3. **Monitoring:** Add structured logging and metrics
4. **Real SMS:** Replace simulated notifications with actual gateway
5. **Admin Auth:** Dispute resolution only via `/admin/*` (JWT)
6. **Webhooks:** Add webhook support for USSD provider callbacks
