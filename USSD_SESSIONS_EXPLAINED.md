# USSD Sessions Explained (Simple Language)

## What is a Session?

A **session** = One complete "conversation" with the USSD system, from dialing to ending.

### Real-World Analogy:

**Session = Phone Call to Customer Service**

```
Session ID: ABC123 (like a call reference number)
Start: When you dial *384*96#
End: When you hang up or timeout after 90 seconds of inactivity
```

---

## Example: One Session, Multiple Requests

### Alice's Session Story:

```
TIME: 10:00:00 AM
Action: Alice dials *384*96#
→ NEW SESSION CREATED: "session_alice_001"
→ Server says: "CON Main Menu: 1. Shipments, 2. Deliveries..."
→ SESSION STORED: { sessionId: "session_alice_001", currentNode: "MAIN_MENU", phoneNumber: "+250788111111" }

TIME: 10:00:05 AM (5 seconds later)
Action: Alice presses "1"
→ SAME SESSION: "session_alice_001"
→ Server says: "CON My Shipments: 1. Deal #42, 2. Deal #57..."
→ SESSION UPDATED: { sessionId: "session_alice_001", currentNode: "DEAL_LIST", context: { category: "asSeller" } }

TIME: 10:00:10 AM (10 seconds later)
Action: Alice presses "1" again
→ SAME SESSION: "session_alice_001"
→ Server says: "CON Deal #42: 1. Mark Shipped, 2. Cancel..."
→ SESSION UPDATED: { sessionId: "session_alice_001", currentNode: "DEAL_ACTIONS", context: { category: "asSeller", selectedDealId: 42 } }

TIME: 10:00:40 AM (40 seconds later - Alice got distracted)
Action: Alice tries to press "1"
→ Still OK! (90 seconds timeout)

TIME: 10:01:35 AM (95 seconds later - Alice got REALLY distracted)
Action: Alice tries to press "1"
→ SESSION EXPIRED! (timeout = 90 seconds of inactivity)
→ Server says: "END Session expired. Please dial again."
→ SESSION DELETED from server
```

**That was ONE SESSION with 4 requests.**

---

## The `text` Parameter

### What It Shows:

The `text` parameter is like a **breadcrumb trail** showing every button press in this session.

### Example:

```
Alice's journey in session "ABC123":

Request 1:
{ sessionId: "ABC123", phoneNumber: "+250788111111", text: "" }
→ First dial, no input yet

Request 2:
{ sessionId: "ABC123", phoneNumber: "+250788111111", text: "1" }
→ Alice pressed: 1

Request 3:
{ sessionId: "ABC123", phoneNumber: "+250788111111", text: "1*1" }
→ Alice pressed: 1, THEN 1 again

Request 4:
{ sessionId: "ABC123", phoneNumber: "+250788111111", text: "1*1*2" }
→ Alice pressed: 1, THEN 1, THEN 2

Request 5:
{ sessionId: "ABC123", phoneNumber: "+250788111111", text: "1*1*2*1234" }
→ Alice pressed: 1, THEN 1, THEN 2, THEN entered PIN 1234
```

**The `*` separates each screen's input.**

---

## Stateless Requests vs Stateful Sessions

### The Paradox Explained:

**Stateless Request** = Each HTTP request stands alone (like separate letters in the mail)

**Stateful Session** = Server remembers previous requests by storing session data (like keeping a conversation log)

### Visual Example:

```
┌─────────────────────────────────────────────────────────┐
│                    Alice's Phone                         │
│  (No memory, just sends requests)                        │
└────────────┬────────────────────────────────────────────┘
             │
             │ Request 1: { sessionId: "ABC", text: "" }
             ↓
┌────────────────────────────────────────────────────────┐
│            USSD Server (Port 4000)                      │
│  ┌──────────────────────────────────────────┐          │
│  │   Session Store (In-Memory Map)          │          │
│  │                                           │          │
│  │   "ABC" → {                               │          │
│  │     phoneNumber: "+250788111111",        │  ← STORES SESSION
│  │     currentNode: "MAIN_MENU",            │          │
│  │     context: {},                         │          │
│  │     lastActivityAt: 10:00:00             │          │
│  │   }                                      │          │
│  └──────────────────────────────────────────┘          │
└────────────┬───────────────────────────────────────────┘
             │
             │ Response: "CON Main Menu..."
             ↓
┌────────────────────────────────────────────────────────┐
│                    Alice's Phone                         │
│  "Main Menu: 1. Shipments..."                          │
└────────────┬────────────────────────────────────────────┘
             │
             │ Request 2: { sessionId: "ABC", text: "1" }
             ↓
┌────────────────────────────────────────────────────────┐
│            USSD Server (Port 4000)                      │
│  ┌──────────────────────────────────────────┐          │
│  │   Session Store (In-Memory Map)          │          │
│  │                                           │          │
│  │   "ABC" → {                               │          │
│  │     phoneNumber: "+250788111111",        │          │
│  │     currentNode: "DEAL_LIST",            │  ← UPDATED!
│  │     context: { category: "asSeller" },   │  ← UPDATED!
│  │     lastActivityAt: 10:00:05             │  ← UPDATED!
│  │   }                                      │          │
│  └──────────────────────────────────────────┘          │
└────────────┬───────────────────────────────────────────┘
             │
             │ Response: "CON My Shipments..."
             ↓
```

**Key Point:** Each request is stateless (doesn't carry previous data), but the server maintains state by storing session info in memory.

---

## Where Are Sessions Stored?

### Answer: In the USSD Server (NOT the Backend)

```
┌─────────────────────────────────────────────┐
│         USSD Server (Port 4000)              │
│                                              │
│  ┌────────────────────────────────┐         │
│  │  SessionStore (In-Memory Map)  │         │
│  │                                 │         │
│  │  "ABC" → { currentNode: "...", │         │ ← SESSIONS LIVE HERE
│  │           context: {...}       │         │
│  │         }                       │         │
│  │                                 │         │
│  │  "XYZ" → { currentNode: "...", │         │
│  │           context: {...}       │         │
│  │         }                       │         │
│  └────────────────────────────────┘         │
│                                              │
│  Cleanup: Every 60 seconds, delete           │
│           sessions older than 30 seconds     │
└─────────────┬───────────────────────────────┘
              │
              │ Calls Backend API when needed
              ↓
┌─────────────────────────────────────────────┐
│       Backend Server (Port 3000)             │
│                                              │
│  - NO session storage                        │
│  - Just executes actions                     │
│  - Returns results                           │
│                                              │
│  ┌────────────────────────────────┐         │
│  │  PostgreSQL Database            │         │
│  │                                 │         │
│  │  - Users                        │         │ ← PERSISTENT DATA
│  │  - Deals                        │         │   (survives restart)
│  │  - Notifications                │         │
│  └────────────────────────────────┘         │
└─────────────────────────────────────────────┘
```

---

## Session Data Structure

### What Gets Stored:

```javascript
{
  sessionId: "ABC123",              // Unique ID for this conversation
  phoneNumber: "+250788111111",     // Who's talking
  currentNode: "DEAL_ACTIONS",      // Where are we in the menu tree
  context: {                         // What have we selected so far
    selectedCategory: "asSeller",
    selectedDealId: 42,
    pendingAction: "MARK_SHIPPED"
  },
  createdAt: 1735000000,            // When session started
  lastActivityAt: 1735000015        // Last button press time
}
```

### Why We Store This:

So the server can answer questions like:
- "Which menu are we on?" → `currentNode`
- "Which deal did Alice select?" → `context.selectedDealId`
- "What action is pending?" → `context.pendingAction`
- "Has this session expired?" → Check `lastActivityAt`

---

## Session Lifecycle

```
1. SESSION BIRTH
   ↓
   User dials *384*96#
   → Server creates new session in SessionStore
   → Assigns unique sessionId
   → Sets currentNode = "PIN_SETUP" or "MAIN_MENU"

2. SESSION LIFE (up to 30 seconds)
   ↓
   User presses buttons
   → Each request includes sessionId
   → Server looks up session in SessionStore
   → Updates currentNode and context
   → Returns next menu

3. SESSION DEATH (one of three ways)
   ↓
   a) Natural death: User sees "END" message
      → Server deletes session immediately
   
   b) Timeout death: User waits > 90 seconds on one screen
      → Server returns "Session expired"
      → Session deleted
   
   c) Cleanup death: Session sits idle
      → Cleanup job (runs every 60s) finds it
      → Deletes it automatically
```

---

## Multiple Sessions Simultaneously

### Example: 3 People Using System at Once

```
USSD Server Session Store at 10:00:00 AM:

┌──────────────────────────────────────────────────────┐
│  Session: "session_alice_001"                         │
│  Phone: +250788111111                                │
│  Node: "DEAL_ACTIONS"                                │
│  Context: { dealId: 42, action: "MARK_SHIPPED" }    │
│  Last Activity: 10:00:00                             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Session: "session_bob_002"                           │
│  Phone: +250788222222                                │
│  Node: "ENTER_PIN"                                   │
│  Context: { dealId: 57, action: "MARK_DELIVERED" }  │
│  Last Activity: 09:59:58                             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Session: "session_carol_003"                         │
│  Phone: +250788333333                                │
│  Node: "CREATE_DEAL_AMOUNT"                          │
│  Context: { receiver: "+25...", driver: "+25..." }  │
│  Last Activity: 09:59:55                             │
└──────────────────────────────────────────────────────┘
```

**Each person has their own independent session!**

---

## Session vs Backend Data

### Session Data (USSD Server - Temporary)
**Lives:** In RAM, deleted after session ends  
**Purpose:** Track navigation through menus  
**Examples:**
- Which menu screen are you on?
- Which deal did you select?
- What action are you about to do?
- When did you last press a button?

**Lifespan:** 30 seconds of inactivity, then deleted

### Backend Data (Backend Server - Permanent)
**Lives:** In PostgreSQL database, permanent  
**Purpose:** Store real business data  
**Examples:**
- User accounts (phone, wallet, PIN hash)
- Deals (sender, receiver, amount, status)
- Notifications (SMS messages)
- Transaction history

**Lifespan:** Forever (until explicitly deleted)

---

## Why This Design?

### Why Not Store Sessions in Backend?

**Answer:** Speed and separation of concerns

```
USSD Server handles:
- Menu navigation (fast, temporary)
- Session timeouts (automatic cleanup)
- User interface state

Backend handles:
- Business logic (creating deals, locking funds)
- Blockchain interaction
- Permanent data storage
```

### Benefits:

1. **Faster:** Session lookups are in-memory (microseconds)
2. **Cleaner:** Backend doesn't need to know about "which menu screen"
3. **Scalable:** Can restart backend without killing USSD sessions
4. **Simpler:** Each server has one job

---

## Summary (ELI5 Version)

**Session** = Your phone conversation with the system (starts when you dial, ends when you hang up or wait too long)

**Stateless Request** = Each message you send doesn't remember previous messages

**Stateful Session** = Server keeps a notebook with your conversation history, so it remembers even though your messages don't

**Where Sessions Live** = In the USSD server's memory (like a sticky note on its desk)

**text Parameter** = A list of all buttons you pressed, separated by `*` (like a receipt of your journey)

**Session Timeout** = If you stop pressing buttons for 90 seconds on any single screen, the server throws away its notes and you start over

**Multiple Users** = Each person gets their own conversation ID and their own notes

---

## Quick Test Your Understanding

### Question 1:
Alice dials USSD and navigates: Main Menu (press 1) → Deal List (press 2) → Actions.  
What is the `text` parameter in her 3rd request?

**Answer:** `"1*2"`

### Question 2:
Where is Alice's `selectedDealId` stored while she's navigating menus?

**Answer:** In the USSD Server's SessionStore (in RAM), under her sessionId

### Question 3:
Alice leaves for lunch without ending her session. What happens after 30 seconds?

**Answer:** Her session is deleted (expired). When she comes back, she starts a new session from scratch.

### Question 4:
Alice creates a deal. Where is the deal data stored?

**Answer:** In the Backend's PostgreSQL database (permanent storage)

### Question 5:
Can Bob and Alice use USSD at the same time?

**Answer:** Yes! Each has a different sessionId, so their sessions are completely separate.

---

**Got it?** Sessions are like temporary phone calls, and each call gets its own memory notebook that lasts 30 seconds!
