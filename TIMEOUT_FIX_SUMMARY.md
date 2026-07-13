# Session Timeout Fix Summary

**Date:** July 13, 2026  
**Issue:** 30-second timeout too short for phone number entry  
**Solution:** Increased to 90 seconds  
**Status:** ✅ FIXED

---

## The Problem

Users entering phone numbers on feature phones need **25-40 seconds** per number.

**Create Deal flow requires entering TWO phone numbers:**
- Receiver phone: ~30 seconds
- Driver phone: ~30 seconds

**With 30-second timeout:** User would timeout while typing! ❌

---

## The Solution

**Increased timeout to 90 seconds (1.5 minutes)**

### Why 90 Seconds?

1. ✅ Allows comfortable phone number entry (30s + 60s buffer)
2. ✅ Matches real USSD gateway standards (60-180 seconds)
3. ✅ Still secure (timer resets on every screen)
4. ✅ Better user experience (less frustration)

---

## Changes Made

### 1. Updated Default Timeout
**File:** `ussd-service/src/server.js`
```javascript
// Before:
const sessionStore = new SessionStore(
  parseInt(process.env.SESSION_TIMEOUT_SECONDS) || 30,
  ...
);

// After:
const sessionStore = new SessionStore(
  parseInt(process.env.SESSION_TIMEOUT_SECONDS) || 90, // 90 seconds allows time for phone number entry
  ...
);
```

### 2. Updated Environment Template
**File:** `ussd-service/.env.example`
```bash
# Before:
SESSION_TIMEOUT_SECONDS=30

# After:
SESSION_TIMEOUT_SECONDS=90
```

### 3. Updated Documentation
**Files:** 
- `ussd-service/README.md` (timeout references)
- `phase3_ussd_simulation_layer_plan.md` (design rationale)

---

## How Timeout Works

### Per-Screen Reset (Not Total Time)

```
User dials
→ Screen 1: 90 seconds available
→ User presses button
→ Screen 2: 90 seconds available (timer reset!)
→ User presses button
→ Screen 3: 90 seconds available (timer reset!)
... and so on
```

**Key Point:** User gets fresh 90 seconds on EACH screen, not 90 seconds total!

---

## Real-World Timing

### Create Deal Flow (Slow Typer):

| Screen | Action | Time Taken | Timeout Risk |
|--------|--------|------------|--------------|
| Login | Enter PIN | 8s | ✅ (90s avail) |
| Main Menu | Press 4 | 3s | ✅ (90s avail) |
| Receiver | Type +250788333333 | 35s | ✅ (90s avail) |
| Driver | Type +250788222222 | 35s | ✅ (90s avail) |
| Amount | Type 1000 | 8s | ✅ (90s avail) |
| Confirm | Press 1 | 3s | ✅ (90s avail) |
| PIN | Enter PIN | 8s | ✅ (90s avail) |

**Total:** ~100 seconds across 7 screens = ✅ NO TIMEOUT

---

## Security Impact

### Is 90 Seconds Safe?

**Yes!** Security comes from:
1. **PIN authentication** (main protection)
2. **Session per phone number** (isolation)
3. **Timer resets per screen** (not cumulative)
4. **Physical device access required** (low hijacking risk)

**Comparison:**
- 30 seconds: Secure but frustrating
- 90 seconds: Secure AND usable
- 180 seconds: Still secure (some banks use this)

---

## Industry Standards

| Service | Timeout | Note |
|---------|---------|------|
| Africa's Talking | 180s | 3 minutes |
| Banking USSD | 90-120s | Data entry |
| Airtime top-up | 30-60s | Quick transactions |
| Menu navigation | 20-30s | Simple selections |

**Our use case:** Data entry → 90 seconds is standard

---

## Configuration

### Change Timeout (if needed):

**File:** `ussd-service/.env`

```bash
# Conservative (banking-style):
SESSION_TIMEOUT_SECONDS=120

# Balanced (recommended):
SESSION_TIMEOUT_SECONDS=90

# Aggressive (not recommended):
SESSION_TIMEOUT_SECONDS=30
```

Restart server after changing.

---

## Testing

### Test Scenarios:

1. **Slow phone number entry:**
   - Take 40 seconds to type one phone number
   - Should NOT timeout ✅

2. **Idle timeout still works:**
   - Stay on one screen for 95 seconds without input
   - SHOULD timeout ✅

3. **Rapid navigation:**
   - Navigate through menus quickly
   - Should work smoothly ✅

---

## Migration

**No migration needed!**

- Environment variable controls timeout
- Just restart server with new .env
- Existing sessions will use old timeout until they expire
- New sessions use new timeout

---

## Rollback

If 90 seconds causes issues (unlikely):

```bash
# Revert to 30 seconds
SESSION_TIMEOUT_SECONDS=30
```

Restart server.

---

## Summary

**Problem:** Users timeout while typing phone numbers  
**Root Cause:** 30 seconds too short for feature phone keypad  
**Solution:** Increased to 90 seconds  
**Impact:** Better UX, no security compromise  
**Status:** ✅ Fixed and documented

---

**Files Modified:**
1. `ussd-service/src/server.js`
2. `ussd-service/.env.example`
3. `ussd-service/README.md`
4. `phase3_ussd_simulation_layer_plan.md`

**New Documents:**
1. `SESSION_TIMEOUT_ANALYSIS.md` (detailed analysis)
2. `TIMEOUT_FIX_SUMMARY.md` (this file)

---

**Recommendation:** Deploy with 90-second timeout. Monitor user feedback and adjust if needed (can increase to 120s if users still report issues).
