# USSD Menu Tree

Complete navigation structure for the Escrow Platform USSD interface.

## Tree Diagram

```
INITIAL DIAL
├─> [New User] PIN_SETUP
│   └─> PIN_CONFIRM
│       ├─> [Match] MAIN_MENU
│       └─> [Mismatch] PIN_SETUP (retry)
│
└─> [Existing User] PIN_LOGIN
    ├─> [Correct PIN] MAIN_MENU
    ├─> [Incorrect PIN] PIN_LOGIN (retry, up to 5 attempts)
    └─> [5 Failed Attempts] END (Account locked 15 minutes)
        
MAIN_MENU (requires authentication)
    ├─> 1. My Shipments → DEAL_LIST (asSeller)
    ├─> 2. My Deliveries → DEAL_LIST (asDriver)
    ├─> 3. My Purchases → DEAL_LIST (asBuyer)
    └─> 4. Create New Deal → CREATE_DEAL_RECEIVER
```

## Node Details

### PIN_LOGIN (NEW)
**Purpose:** Authentication for returning users  
**Input:** 4 digits  
**Next:** 
- MAIN_MENU (if PIN correct)
- PIN_LOGIN (if PIN incorrect, show attempts remaining)
- END (if account locked after 5 failed attempts)
**Validation:** Calls backend `POST /users/:phone/verify-pin`

### PIN_SETUP
**Purpose:** First-time account creation  
**Display:** "Welcome! Create your account.\nSet your 4-digit PIN:"
**Input:** 4 digits  
**Next:** PIN_CONFIRM  
**Validation:** Must be exactly 4 digits

### PIN_CONFIRM
**Purpose:** Confirm PIN matches  
**Input:** 4 digits  
**Next:** 
- MAIN_MENU (if match)
- PIN_SETUP (if mismatch)

### MAIN_MENU
**Purpose:** Entry point for authenticated users  
**Input:** 1-4  
**Options:**
1. My Shipments (Seller role)
2. My Deliveries (Driver role)
3. My Purchases (Buyer role)
4. Create New Deal

### DEAL_LIST
**Purpose:** Display deals for selected role  
**Input:** 0-N (N = number of deals)  
**Context:** Uses `selectedCategory` (asSeller/asDriver/asBuyer)  
**Next:**
- 0 → MAIN_MENU
- N → DEAL_ACTIONS (stores `selectedDealId`)

### DEAL_ACTIONS
**Purpose:** Show available actions based on role + status  
**Input:** 0-M (M = number of actions)  
**Logic:** `getAvailableActions(role, status)`  
**Next:**
- 0 → DEAL_LIST
- VIEW_STATUS → VIEW_STATUS
- REVOKE → DISPUTE_REASON
- Other actions → CONFIRM_ACTION

**Action Matrix:**

| Role | Status | Actions |
|------|--------|---------|
| Receiver | Created | Lock Funds, Cancel |
| Receiver | FundsLocked | Dispute, View Status |
| Receiver | Shipped | Dispute, View Status |
| Receiver | Delivered | Dispute (Goods Not Received), View Status |
| Sender | Created | Cancel, View Status |
| Sender | FundsLocked | Mark Shipped, Dispute |
| Sender | Shipped | Dispute, View Status |
| Sender | Delivered | View Status |
| Driver | Shipped | Mark Delivered, View Status |
| Driver | Other | View Status |
| Any | Disputed | View Status |
| Any | Released/Cancelled/Resolved | View Status |

### CONFIRM_ACTION
**Purpose:** Yes/No confirmation before PIN  
**Input:** 1 (Yes) or 2 (No)  
**Next:**
- 1 → ENTER_PIN
- 2 → DEAL_ACTIONS

### ENTER_PIN
**Purpose:** Execute action with PIN authentication  
**Input:** 4 digits  
**Actions Handled:**
- LOCK_FUNDS
- MARK_SHIPPED
- MARK_DELIVERED
- CANCEL

**Next:** END (with success/error message)

**Response Pattern:**
```
END Processing your request.
You will receive SMS confirmation shortly.
```

**PIN Error Handling:**
- Invalid format → Re-prompt
- Wrong PIN → Show attempts remaining
- 5 failed attempts → Account locked message

### DISPUTE_REASON
**Purpose:** Select dispute reason code  
**Input:** 0-5  
**Options:**
1. Goods not received
2. Wrong items delivered
3. Damaged goods
4. Quantity mismatch
5. Other
0. Cancel

**Next:**
- 0 → DEAL_ACTIONS
- 1-5 → ENTER_DISPUTE_PIN (stores `disputeReasonCode`)

### ENTER_DISPUTE_PIN
**Purpose:** Confirm dispute with PIN  
**Input:** 4 digits  
**Next:** END (dispute filed or error)

## Create Deal Flow

```
MAIN_MENU (select 4)
└─> CREATE_DEAL_RECEIVER
    └─> CREATE_DEAL_DRIVER
        └─> CREATE_DEAL_AMOUNT
            └─> CREATE_DEAL_CONFIRM
                ├─> 1 (Confirm) → Enter PIN → END
                └─> 2 (Cancel) → MAIN_MENU
```

### CREATE_DEAL_RECEIVER
**Purpose:** Enter receiver phone number  
**Input:** Phone number  
**Validation:**
- Valid format (0788123456)
- Not same as sender

**Next:** CREATE_DEAL_DRIVER

### CREATE_DEAL_DRIVER
**Purpose:** Enter driver phone number  
**Input:** Phone number  
**Validation:**
- Valid format
- Not same as sender
- Not same as receiver

**Next:** CREATE_DEAL_AMOUNT

### CREATE_DEAL_AMOUNT
**Purpose:** Enter deal amount  
**Input:** Positive number  
**Validation:** Must be > 0

**Next:** CREATE_DEAL_CONFIRM

### CREATE_DEAL_CONFIRM
**Purpose:** Review and confirm deal  
**Display:**
```
Confirm New Deal:
Receiver: 0788333333
Driver: 0788222222
Amount: 1000 RWF

1. Confirm
2. Cancel
```

**Input:** 
- First input: 1 or 2
- Second input: PIN (if confirmed)

**Next:** END (deal created or cancelled)

### VIEW_STATUS
**Purpose:** Display deal summary  
**Output:** END message with deal details  
**No further input accepted**

## Navigation Conventions

### Back Navigation
- `0` always means "Back" or "Cancel"
- Clears relevant context when going back

### Error Recovery
- Invalid input → Re-display current menu with error
- Don't end session on bad input
- Give user chance to correct

### Session End Triggers
- Explicit END message from node
- Session timeout (90 seconds of inactivity per screen)
- System error

## State Management

### Session Context
```javascript
{
  selectedCategory: 'asSeller' | 'asDriver' | 'asBuyer',
  selectedDealId: number,
  availableActions: Array<Action>,
  currentDeal: Deal,
  userRole: 'sender' | 'driver' | 'receiver',
  pendingAction: 'LOCK_FUNDS' | 'MARK_SHIPPED' | ...,
  disputeReasonCode: 1-5,
  newDeal: {
    receiverPhone: string,
    driverPhone: string,
    amount: string,
  },
}
```

### Context Lifecycle
- Created when entering a flow
- Cleared when exiting back to main menu
- Cleared on session end

## Async Processing Pattern

State-changing actions return immediately with "Processing" message:

```
END Processing your request.
You will receive SMS confirmation shortly.
```

Actual confirmation comes via SMS notification (triangular broadcast).

**Why:** 
- Blockchain transactions take 2-5 seconds
- Real USSD gateways timeout after 60-180 seconds
- This pattern avoids blocking users

## Testing Scenarios

### Happy Path
```
Dial → Main (1) → Deal List (1) → Actions (1) → Confirm (1) → PIN → END
```

### Dispute Path
```
Dial → Main (3) → Deal List (1) → Actions (1) → Reason (1) → PIN → END
```

### Create Deal
```
Dial → Main (4) → Receiver → Driver → Amount → Confirm (1) → PIN → END
```

### PIN Lockout
```
Dial → Main (1) → Deal List (1) → Actions (1) → PIN (wrong × 5) → END locked
```

### Session Timeout
```
Dial → Main (1) → [wait 35 seconds] → Input → END expired
```

### Invalid Input Recovery
```
Dial → Main → "abc" → Error + Main (re-display) → 1 → Deal List
```

## Menu Text Guidelines

1. **Concise:** Max 160 characters per screen
2. **Clear:** Use simple language (target: Grade 6 reading level)
3. **Numbered:** Options are 1-9, 0 for back
4. **Action-oriented:** "Mark as Shipped" not "Shipping"
5. **Status-aware:** Show relevant info (e.g., deal amount, status)

## Future Enhancements

### Phase 4 Additions
- Admin dispute resolution menu
- Deal history/archive view
- Account balance check
- Multi-language support

### Not in Scope (Phase 3)
- Editing deal details
- Partial payments
- Wallet recovery
- PIN reset (requires manual admin)

