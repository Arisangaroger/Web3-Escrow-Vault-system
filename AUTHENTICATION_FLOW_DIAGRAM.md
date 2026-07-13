# Authentication Flow Diagrams

## Visual Guide: How Authentication Works

---

## Flow 1: New User (First Time)

```
┌─────────────────────────────────────────────────────────┐
│                    User's Phone                          │
│                                                          │
│  Action: Dials *384*96#                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP POST: { sessionId: "ABC", phoneNumber: "+250788111111", text: "" }
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Check if user exists in backend                    │
│     → Calls: GET /users/+250788111111/deals            │
│                                                         │
│  2. Backend returns: "User not found"                  │
│                                                         │
│  3. Route to: PIN_SETUP node                           │
│                                                         │
│  4. Response: CON "Welcome! Create your account.       │
│                    Set your 4-digit PIN:"              │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Welcome! Create your account.                │
│           Set your 4-digit PIN:"                       │
│                                                         │
│  User enters: 1111                                     │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTP POST: { sessionId: "ABC", text: "1111" }
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Current node: PIN_SETUP                            │
│  2. User input: "1111"                                 │
│  3. Store in session context                           │
│  4. Route to: PIN_CONFIRM node                         │
│  5. Response: CON "Confirm your 4-digit PIN:"          │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Confirm your 4-digit PIN:"                   │
│                                                         │
│  User enters: 1111                                     │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTP POST: { sessionId: "ABC", text: "1111*1111" }
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Current node: PIN_CONFIRM                          │
│  2. User input: "1111"                                 │
│  3. Compare with stored: "1111"                        │
│  4. Match! → Call backend                              │
│     → POST /users/+250788111111/pin { pin: "1111" }    │
│                                                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTP POST to Backend
                 ↓
┌────────────────────────────────────────────────────────┐
│             Backend Server (Port 3000)                  │
│                                                         │
│  1. Create wallet for user                             │
│  2. Hash PIN with Argon2id + pepper                    │
│  3. Store in database:                                 │
│     - phone_number: +250788111111                      │
│     - pin_hash: $argon2id$v=19$m=...                  │
│     - pin_attempts: 0                                  │
│  4. Return: { success: true }                          │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ Success response
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Account created successfully!                      │
│  2. Route to: MAIN_MENU node                           │
│  3. Response: CON "Account created!                    │
│                                                         │
│                    Main Menu:                          │
│                    1. My Shipments                     │
│                    2. My Deliveries                    │
│                    3. My Purchases                     │
│                    4. Create New Deal"                 │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Account created!                             │
│                                                         │
│           Main Menu:                                   │
│           1. My Shipments                              │
│           2. My Deliveries                             │
│           3. My Purchases                              │
│           4. Create New Deal"                          │
│                                                         │
│  ✅ User can now navigate!                             │
└────────────────────────────────────────────────────────┘
```

---

## Flow 2: Returning User (Successful Login)

```
┌─────────────────────────────────────────────────────────┐
│                    User's Phone                          │
│  (User dialed before, already has account)              │
│                                                          │
│  Action: Dials *384*96#                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP POST: { sessionId: "XYZ", phoneNumber: "+250788111111", text: "" }
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Check if user exists in backend                    │
│     → Calls: GET /users/+250788111111/deals            │
│                                                         │
│  2. Backend returns: { success: true, data: [...] }    │
│     (User exists!)                                     │
│                                                         │
│  3. Route to: PIN_LOGIN node                           │
│                                                         │
│  4. Response: CON "Welcome back!                       │
│                    Enter your 4-digit PIN:"            │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Welcome back!                                │
│           Enter your 4-digit PIN:"                     │
│                                                         │
│  User enters: 1111                                     │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTP POST: { sessionId: "XYZ", text: "1111" }
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Current node: PIN_LOGIN                            │
│  2. User input: "1111"                                 │
│  3. Call backend to verify PIN                         │
│     → POST /users/+250788111111/verify-pin             │
│       { pin: "1111" }                                  │
│                                                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTP POST to Backend
                 ↓
┌────────────────────────────────────────────────────────┐
│             Backend Server (Port 3000)                  │
│                                                         │
│  1. Check if account locked (lockout_until > now)      │
│     → Not locked ✓                                     │
│                                                         │
│  2. Get user from database                             │
│     → pin_hash: $argon2id$v=19$m=...                  │
│     → pin_attempts: 0                                  │
│                                                         │
│  3. Hash entered PIN: "1111" + pepper                  │
│                                                         │
│  4. Compare hashes with Argon2.verify()                │
│     → MATCH! ✓                                         │
│                                                         │
│  5. Reset attempts to 0                                │
│                                                         │
│  6. Return: { success: true, data: { message: ... } }  │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ Success response
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. PIN verified successfully!                         │
│  2. Route to: MAIN_MENU node                           │
│  3. Response: CON "Main Menu:                          │
│                    1. My Shipments                     │
│                    2. My Deliveries                    │
│                    3. My Purchases                     │
│                    4. Create New Deal"                 │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Main Menu:                                   │
│           1. My Shipments                              │
│           2. My Deliveries                             │
│           3. My Purchases                              │
│           4. Create New Deal"                          │
│                                                         │
│  ✅ Authenticated! User can navigate                   │
└────────────────────────────────────────────────────────┘
```

---

## Flow 3: Failed Login (Wrong PIN)

```
┌─────────────────────────────────────────────────────────┐
│                    User's Phone                          │
│                                                          │
│  Action: Dials *384*96#                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
         ... (user check happens) ...
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  Response: CON "Welcome back!                          │
│                 Enter your 4-digit PIN:"               │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Welcome back! Enter your 4-digit PIN:"       │
│                                                         │
│  User enters: 9999 (WRONG PIN!)                        │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTP POST: { sessionId: "XYZ", text: "9999" }
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Current node: PIN_LOGIN                            │
│  2. User input: "9999"                                 │
│  3. Call backend verify-pin                            │
│                                                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│             Backend Server (Port 3000)                  │
│                                                         │
│  1. Get user: pin_hash, pin_attempts: 0                │
│  2. Hash entered PIN: "9999" + pepper                  │
│  3. Compare hashes: NO MATCH! ❌                        │
│  4. Increment attempts: 0 → 1                          │
│  5. Return: { success: false,                          │
│              error: "Incorrect PIN. 4 attempts..." }   │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ Error response
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. PIN verification failed                            │
│  2. Stay on: PIN_LOGIN node (retry)                    │
│  3. Response: CON "Incorrect PIN. 4 attempts...        │
│                    Enter your 4-digit PIN:"            │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Incorrect PIN. 4 attempts remaining.         │
│           Enter your 4-digit PIN:"                     │
│                                                         │
│  ⚠️ User can retry                                     │
└────────────────────────────────────────────────────────┘
```

---

## Flow 4: Account Lockout (5 Failed Attempts)

```
After 4 failed attempts (pin_attempts = 4):

┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  User enters: 8888 (5th wrong PIN!)                    │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│             Backend Server (Port 3000)                  │
│                                                         │
│  1. Get user: pin_attempts: 4                          │
│  2. Hash entered PIN: "8888"                           │
│  3. Compare: NO MATCH! ❌                               │
│  4. Increment: 4 → 5                                   │
│  5. 5 attempts reached! LOCK ACCOUNT                   │
│  6. Set: lockout_until = now + 15 minutes              │
│  7. Return: { success: false,                          │
│              error: "Account locked. Too many..." }    │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│              USSD Server (Port 4000)                    │
│                                                         │
│  1. Account locked!                                    │
│  2. End session (not retry)                            │
│  3. Response: END "Account locked for 15 minutes.      │
│                    Please try again later."            │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Screen: "Account locked for 15 minutes.               │
│           Please try again later."                     │
│                                                         │
│  🔒 Session ends. Cannot dial again for 15 mins        │
└────────────────────────────────────────────────────────┘

---

After 15 minutes pass:

┌────────────────────────────────────────────────────────┐
│                    User's Phone                         │
│                                                         │
│  Action: Dials *384*96# (after waiting)                │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
         ... verification happens ...
                 ↓
┌────────────────────────────────────────────────────────┐
│             Backend Server (Port 3000)                  │
│                                                         │
│  1. Check: lockout_until < now                         │
│     → Lockout expired! ✓                               │
│  2. Allow verification again                           │
│  3. User can enter correct PIN                         │
│  4. If correct: Reset attempts to 0                    │
│  5. Success!                                           │
└────────────────────────────────────────────────────────┘
```

---

## Security Flow Summary

```
┌──────────────────────────────────────────────────────────┐
│                    Security Layers                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Layer 1: Phone Number Identification                    │
│  ├─ Every request includes phoneNumber                   │
│  └─ Server checks if user exists                         │
│                                                           │
│  Layer 2: PIN Authentication                             │
│  ├─ User must enter correct 4-digit PIN                  │
│  ├─ PIN hashed with Argon2id (memory-hard)               │
│  ├─ Server-side pepper adds extra security               │
│  └─ Hash comparison happens server-side                  │
│                                                           │
│  Layer 3: Brute Force Protection                         │
│  ├─ Track failed attempts per user                       │
│  ├─ Lock account after 5 failures                        │
│  ├─ 15-minute lockout period                             │
│  └─ Lockout tracked in database (survives restart)       │
│                                                           │
│  Layer 4: Session Timeout                                │
│  ├─ Sessions expire after 30 seconds inactivity          │
│  ├─ User must re-authenticate to start new session       │
│  └─ Prevents session hijacking                           │
│                                                           │
│  Layer 5: HTTPS (Production)                             │
│  ├─ Encrypt all requests in transit                      │
│  ├─ Protect PINs from network sniffing                   │
│  └─ Certificate validation                               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Database State During Authentication

### Before Any Attempts:
```sql
users table:
┌──────────────────┬───────────────────┬──────────────┬──────────────┐
│ phone_number     │ pin_hash          │ pin_attempts │ lockout_until│
├──────────────────┼───────────────────┼──────────────┼──────────────┤
│ +250788111111    │ $argon2id$v=19... │ 0            │ NULL         │
└──────────────────┴───────────────────┴──────────────┴──────────────┘
```

### After 1 Failed Attempt:
```sql
┌──────────────────┬───────────────────┬──────────────┬──────────────┐
│ phone_number     │ pin_hash          │ pin_attempts │ lockout_until│
├──────────────────┼───────────────────┼──────────────┼──────────────┤
│ +250788111111    │ $argon2id$v=19... │ 1            │ NULL         │
└──────────────────┴───────────────────┴──────────────┴──────────────┘
```

### After 5 Failed Attempts (Locked):
```sql
┌──────────────────┬───────────────────┬──────────────┬─────────────────────┐
│ phone_number     │ pin_hash          │ pin_attempts │ lockout_until       │
├──────────────────┼───────────────────┼──────────────┼─────────────────────┤
│ +250788111111    │ $argon2id$v=19... │ 5            │ 2026-07-13 10:15:00 │
└──────────────────┴───────────────────┴──────────────┴─────────────────────┘
                                                         ↑
                                        Current time + 15 minutes
```

### After Successful Login:
```sql
┌──────────────────┬───────────────────┬──────────────┬──────────────┐
│ phone_number     │ pin_hash          │ pin_attempts │ lockout_until│
├──────────────────┼───────────────────┼──────────────┼──────────────┤
│ +250788111111    │ $argon2id$v=19... │ 0            │ NULL         │
└──────────────────┴───────────────────┴──────────────┴──────────────┘
                                         ↑               ↑
                                      Reset to 0      Cleared
```

---

## Quick Reference: Response Messages

### PIN_SETUP (New User):
```
CON Welcome! Create your account.
Set your 4-digit PIN:
```

### PIN_CONFIRM (New User):
```
CON Confirm your 4-digit PIN:
```

### PIN_LOGIN (Returning User):
```
CON Welcome back!
Enter your 4-digit PIN:
```

### Successful Authentication:
```
CON Main Menu:
1. My Shipments
2. My Deliveries
3. My Purchases
4. Create New Deal
```

### Wrong PIN (Attempts < 5):
```
CON Incorrect PIN. X attempts remaining.
Enter your 4-digit PIN:
```

### Account Locked:
```
END Account locked for 15 minutes.
Please try again later.
```

### Invalid Format:
```
CON Invalid PIN format.
Enter your 4-digit PIN:
```

---

**This completes the authentication flow documentation!** 🔐
