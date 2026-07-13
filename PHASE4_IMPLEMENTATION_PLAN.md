# Phase 4 Implementation Plan - Admin Arbitration Portal

**Status:** 🚧 IN PROGRESS  
**Start Date:** July 13, 2026

---

## Implementation Order

### Part 1: Backend Extensions (3-4 hours)
1. Database migrations (admins table)
2. Admin authentication middleware
3. Admin API routes (disputes, resolution)
4. Admin wallet custody integration

### Part 2: Frontend Setup (1 hour)
1. React + Vite scaffolding
2. Routing setup
3. API client wrapper
4. Authentication context

### Part 3: Core UI Components (4-5 hours)
1. Login page
2. Dispute queue (table view)
3. Dispute detail page with timeline
4. Resolution panel with confirmation modals

### Part 4: Integration & Testing (2-3 hours)
1. End-to-end dispute resolution flow
2. Notification verification
3. Security hardening
4. Documentation

---

## Estimated Total Time: 10-15 hours

---

## Key Design Decisions

### 1. Admin Wallet Custody (Section 3.3)
**Decision:** Option A - Custodial pattern  
**Rationale:** Consistent with Phase 2, simpler for prototype

### 2. Technology Stack (Section 1.1)
**Frontend:** React SPA with Vite  
**Backend:** Extend existing NestJS backend  
**Auth:** JWT tokens (HTTP-only cookies)

### 3. Resolution Flow (Section 6.1)
**Approach:** Synchronous (wait for blockchain confirmation)  
**Rationale:** Web interface can afford loading spinner, better UX than async

---

## File Structure

```
admin-portal/
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Root component with routing
│   ├── api/
│   │   └── client.js            # API wrapper
│   ├── context/
│   │   └── AuthContext.jsx      # Auth state management
│   ├── pages/
│   │   ├── Login.jsx            # Login page
│   │   ├── DisputeQueue.jsx     # Main queue view
│   │   ├── DisputeDetail.jsx    # Detail + timeline
│   │   └── History.jsx          # Resolved disputes
│   ├── components/
│   │   ├── Timeline.jsx         # Action timeline
│   │   ├── ResolutionPanel.jsx  # Resolution buttons
│   │   ├── DealSummaryCard.jsx  # Deal header
│   │   └── ConfirmModal.jsx     # Confirmation dialog
│   └── styles/
│       └── index.css            # Global styles
├── index.html
├── vite.config.js
└── package.json

backend/ (extended)
├── src/modules/admin/           # New admin module
│   ├── admin.module.ts
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── dto/
│       ├── login.dto.ts
│       └── resolve-dispute.dto.ts
├── src/middleware/
│   └── admin-auth.middleware.ts # Route protection
└── prisma/
    └── migrations/
        └── XXX_add_admins_table/
```

---

## Database Schema Addition

```prisma
model Admin {
  adminId       Int       @id @default(autoincrement()) @map("admin_id")
  name          String
  email         String    @unique
  passwordHash  String    @map("password_hash")
  walletAddress String    @map("wallet_address")
  createdAt     DateTime  @default(now()) @map("created_at")
  lastLoginAt   DateTime? @map("last_login_at")
  
  @@map("admins")
}
```

---

## API Endpoints to Implement

### Authentication
- `POST /admin/login` - Admin login
- `POST /admin/logout` - Admin logout
- `GET /admin/me` - Get current admin info

### Disputes
- `GET /admin/disputes` - List active disputes
- `GET /admin/disputes/:dealId` - Get dispute detail with timeline
- `POST /admin/disputes/:dealId/resolve` - Resolve dispute
- `GET /admin/disputes/history` - List resolved disputes

---

## Resolution Outcomes Mapping

| Outcome | Description | On-Chain Action |
|---------|-------------|-----------------|
| `DRIVER_FRAUD` | Driver lied, refund buyer | 100% to receiver |
| `FAULTY_GOODS` | Goods bad, not driver's fault | 100% to receiver |
| `FALSE_BUYER_CLAIM` | Buyer lying, pay farmer | 100% to sender |

---

## Security Checklist

- [ ] Admin passwords hashed with Argon2
- [ ] JWT tokens expire after 8 hours
- [ ] HTTP-only cookies for token storage
- [ ] Rate limiting on login endpoint
- [ ] Admin wallet encrypted like user wallets
- [ ] All admin routes protected by middleware
- [ ] Resolution actions require confirmation
- [ ] Admin actions logged to audit trail

---

## Testing Strategy

### Backend Tests
1. Admin authentication flow
2. Dispute filtering (only `Disputed` status)
3. Timeline ordering
4. Resolution execution for each outcome
5. Unauthorized access rejection

### Frontend Tests
1. Login form validation
2. Dispute queue rendering
3. Timeline chronological order
4. Confirmation modal flow
5. Success/error state handling

### Integration Test
1. Create dispute via USSD simulator (Phase 3)
2. Login to admin portal
3. Verify dispute appears with correct timeline
4. Resolve dispute
5. Verify all 3 parties receive SMS notification
6. Verify deal removed from queue

---

## Progress Tracker

### Backend
- [ ] admins table migration
- [ ] Admin authentication service
- [ ] Admin auth middleware
- [ ] Admin controller (disputes endpoints)
- [ ] Resolution service integration
- [ ] Audit logging

### Frontend
- [ ] Project scaffolding
- [ ] API client
- [ ] Auth context
- [ ] Login page
- [ ] Dispute queue
- [ ] Dispute detail + timeline
- [ ] Resolution panel
- [ ] History view

### Documentation
- [ ] ADMIN_PORTAL.md
- [ ] Updated ARCHITECTURE.md
- [ ] API documentation
- [ ] Deployment guide

---

## Next Steps

Starting with backend extensions since frontend depends on API endpoints.

