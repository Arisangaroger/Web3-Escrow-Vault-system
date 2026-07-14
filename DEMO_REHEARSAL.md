# Demo Rehearsal Guide

Phase 5 §7: script the narrative, dry-run it, and keep evidence of rehearsal.  
Walkthrough detail lives in [DEMO_CREDENTIALS.md](DEMO_CREDENTIALS.md). Terms: [GLOSSARY.md](GLOSSARY.md).

---

## Narrative arc (5–7 minutes)

1. **Problem** — Mutual trust gap (Musanze farmer ↔ Kigali buyer); no reliable rural escrow.
2. **Happy path** — Lock → ship → deliver → (seeded) near auto-release / keeper.
3. **Fraud resistance** — Early “Delivered” → triangular SMS → buyer disputes in simulator.
4. **Admin resolution** — Portal timeline → Driver Fraud / Faulty Goods / False Buyer Claim.
5. **Why it matters** — Feature-phone access, BNR e-Franc forward-compat story, multi-role deals.

---

## Environment checklist (before any dry-run)

| Step | Command / check | Pass? |
|------|-----------------|-------|
| Local chain running | `cd blockchain && npx hardhat node` | ☐ |
| Contracts deployed / addresses in `backend/.env` | `deployments/localhost-latest.json` → `.env` | ☐ |
| DB migrated | `cd backend && npx prisma migrate deploy` | ☐ |
| Clean demo state | `npm run reset:demo:full` **or** `npm run reset:demo` | ☐ |
| Seed on-chain + DB | `npm run seed:demo` | ☐ |
| Backend | `npm run start:dev` → `:3000` + `/internal/status` | ☐ |
| USSD | `cd ussd-service && npm start` → `:4000` | ☐ |
| Simulator | Open `ussd-service/simulator-ui/index.html` (SIMs `0788100001` / `0788300003` / `0788200002`) | ☐ |
| Admin portal | `cd admin-portal && npm run dev` → login `admin@escrow.local` | ☐ |

---

## Dry-run script (perform in order)

### A. Desk check (docs & seed — no audience)

| # | Action | Expected | Pass? |
|---|--------|----------|-------|
| A1 | Read problem opener from concept / DEMO | Clear trust-gap framing | ☐ |
| A2 | `seed:demo` completes without error | Users minted; deals Created / FundsLocked / Shipped / Delivered / Disputed | ☐ |
| A3 | `/internal/status` shows disputed ≥ 1 | Matches seed dispute deal | ☐ |
| A4 | Simulator dials `0788100001` → PIN login works | Seed PIN `1111` | ☐ |
| A5 | Admin portal shows Disputed queue item | Timeline has lock → ship → deliver → revoke | ☐ |

### B. Live narrative dry-run (stopwatch)

| # | Beat | Timing | Pass? | Notes |
|---|------|--------|-------|-------|
| B1 | Open with problem | ~30s | ☐ | |
| B2 | Happy path using seeded FundsLocked/Shipped (or live create) | ~2 min | ☐ | |
| B3 | Show Delivered + triangular inbox SMS | ~1 min | ☐ | |
| B4 | Dispute path (seeded Disputed or live revoke) | ~1 min | ☐ | |
| B5 | Admin resolve (one outcome) + notify check | ~1.5 min | ☐ | |
| B6 | Close: e-Franc / multi-role talking points | ~30s | ☐ | |

### C. Failure drill (optional but recommended)

| # | Action | Pass? |
|---|--------|-------|
| C1 | Wrong PIN → lockout messaging | ☐ |
| C2 | End session mid-flow → dial again | ☐ |
| C3 | `reset:demo` then re-seed restores queue | ☐ |

---

## Rehearsal log (evidence)

Record each dry-run below. Tick boxes above during the run; summarize here.

### Rehearsal #1 — desk + script dry-run

| Field | Value |
|-------|--------|
| **Date** | 2026-07-14 |
| **Operator** | Project maintainer (Phase 5 prep) |
| **Mode** | Desk rehearsal of narrative + environment checklist against current repo/scripts |
| **Environment** | Local Hardhat path as documented in README Quick Start |
| **Seed** | `backend/scripts/seedDemo.ts` (on-chain deals + mint + `ENCRYPTION_KEY` wallets) |
| **Reset** | `reset:demo` / `reset:demo:full` documented |
| **Narrative** | Problem → happy path → triangular fraud → admin resolve → e-Franc close |
| **Artifacts used** | `DEMO_CREDENTIALS.md`, simulator defaults aligned to seed phones, Admin portal |
| **Gaps found** | Live stopwatch pass (B1–B6) still requires operator to run with services up; recorded video optional / not required for desk pass |
| **Result** | **PASS (desk)** — script and tooling sufficient for a live dry-run; operator signs B1–B6 when performed |

### Rehearsal #2 — (fill on live dry-run)

| Field | Value |
|-------|--------|
| **Date** | |
| **Operator** | |
| **Duration** | |
| **Outcomes tested** | DRIVER_FRAUD / FAULTY_GOODS / FALSE_BUYER_CLAIM (circle one+) |
| **Result** | PASS / FAIL |
| **Follow-ups** | |

---

## Recording (optional, Phase 5 §7.2)

If producing a shareable fallback:

1. Complete Rehearsal #2 live.  
2. Screen-record simulator + admin portal with narration following the narrative arc.  
3. Store the file outside git (or link from a private drive); note path under Rehearsal #2 follow-ups.  
4. Do **not** commit secrets or live JWT cookies into the repo.

---

## Sign-off

| Role | Name | Date | Signature / note |
|------|------|------|------------------|
| Desk rehearsal | Phase 5 prep | 2026-07-14 | Checklist + scripts verified in repo |
| Live dry-run | | | Complete B1–B6 then sign here |
| Recording | | | Optional |
