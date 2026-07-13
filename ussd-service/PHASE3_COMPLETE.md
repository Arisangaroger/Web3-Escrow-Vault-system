# Phase 3 — USSD Simulation Layer (status)

**Status: demo-oriented scaffold — not production-ready.**  
Do **not** treat older “100% / A+ complete” writeups as accurate.

## What works now

- CON/END Express USSD server + in-memory sessions (90s)
- Menu tree (PIN setup/login, role lists, create deal, actions, dispute reasons)
- New vs returning user routing via backend `GET /users/:phone/pin-status`
- Phone canonical form: local `07XXXXXXXX` (e.g. `0788111111`)
- State-changing actions: verify PIN → `END Processing…` (chain work continues in background; SMS later)
- Simulated SMS inbox: `GET /users/:phone/notifications` on backend + simulator polling
- PIN redacted from USSD request logs; debug `/sessions` gated + strips `pendingPin`

## Explicit gaps (still open)

- No gateway shared-secret / HTTPS / rate limits
- In-memory sessions (not multi-instance)
- No automated Jest E2E suite; happy-path shell may be stale
- Real SMS provider not integrated (DB + console only)
- Docs elsewhere (`PHASE3_AUDIT_REPORT`, etc.) may still overclaim — prefer this file + code

## Demo phones (simulator defaults)

- Sender: `0788111111`
- Driver: `0788222222`
- Receiver: `0788333333`

## How to run

```bash
# backend (port 3000) with .env + migrated DB + contracts
# ussd-service (port 4000)
cd ussd-service && npm start
# open simulator-ui/index.html
```

## Phone +250 vs 07…

Product decision: **use local `0788…` everywhere** in USSD and DB phone fields for this project. Inputs like `+250788…` are accepted on dial/entry but normalized to `0788…`.
