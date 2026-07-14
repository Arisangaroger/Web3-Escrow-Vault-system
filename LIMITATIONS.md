# System Limitations & Design Trade-offs

This document explicitly describes features deliberately deferred or simplified during prototype development.

---

## Prototype Scope Decisions

| Limitation | Status | Production Path |
|-----------|--------|-----------------|
| **Driver goes silent after "Shipped"** | Deferred | Add ship-stage timeout mirroring delivery-stage 3hr pattern |
| **Wrong phone number at deal creation** | Deferred | Add confirmation/edit step before deal broadcast |
| **Real MoMo on/off-ramp for eRWF** | Simulated only | Integrate with BNR's e-Franc API or licensed MoMo aggregator |
| **KYC / BNR licensing** | Deferred | Requires regulatory engagement before real-money deployment |
| **SMS delivery reliability** | Simulated (assumes perfect) | Real gateway needs delivery-receipt handling and fallback |
| **Wallet/PIN recovery on device loss** | Deferred | Requires secure identity-recovery flow, likely tied to KYC |
| **Single admin role** | Simplified by design | Multi-admin AccessControl roles if scaling to cooperatives |
| **USSD via simulator (not telecom)** | Protocol-compatible | Swap in Africa's Talking against same CON/END contract |
| **Multi-admin role separation** | Deferred | Junior vs senior admin roles for larger cooperatives |
| **Photo/evidence upload** | Deferred | Admin could upload photos during dispute resolution |
| **In-portal messaging** | Deferred | Currently all communication via SMS/notifications |
| **Analytics dashboard** | Deferred | Dispute frequency, resolution times, regional stats |
| **Rate limiting on all endpoints** | Partial (admin login only) | Add per-phone rate limiting on USSD and API |
| **Admin login lockout** | Deferred | Track failed attempts, temporary lockout like user PINs |
| **Wallet key rotation** | Deferred | Periodic re-encryption with new master key |
| **Database replication** | Single instance | Primary + read replicas for production |
| **Blockchain event gap recovery** | Basic checkpoint | Handle long downtime with chunk-based catch-up |
| **Gas price optimization** | Fixed gas settings | Dynamic gas pricing based on network conditions |
| **Multi-currency support** | eRWF only | Support multiple stablecoins or tokens |
| **Partial refunds** | All-or-nothing splits | Allow custom percentage splits in resolutions |
| **Delivery confirmation photos** | Deferred | Driver uploads photo proof of delivery |
| **GPS tracking** | Deferred | Driver location tracking during transit |
| **Automatic translation** | English/French only | Support more languages in USSD menus |
| **USSD session persistence** | 90-second timeout | Consider Redis for longer sessions |
| **Smart contract upgradeability** | Non-upgradeable | Use proxy pattern for production |
| **Emergency pause mechanism** | Manual admin only | Contract-level pause for emergencies |

---

## Security Limitations

### Current Prototype
- Master encryption key in environment variable
- PIN pepper in environment variable
- No hardware security module (HSM)
- Single treasury wallet (single point of failure)
- HTTP-only in dev (HTTPS required for production)
- No formal security audit

### Production Requirements
- HSM or cloud KMS for key management
- Multi-signature treasury wallet
- Professional security audit
- Penetration testing
- Bug bounty program
- Regular dependency updates

---

## Testing Limitations

### Current Coverage
- Backend unit tests for core services ✅
- Frontend component tests ✅
- E2E tests for admin portal ✅
- Manual integration testing ✅

### Missing Coverage
- Automated USSD flow tests
- Load testing / stress testing
- Network partition simulation
- Blockchain reorg handling
- Concurrent transaction handling
- Long-running system stability tests

---

## Operational Limitations

### Monitoring
- Basic structured logging ✅
- Simple status endpoint ✅
- No alerting system
- No metrics dashboards
- No distributed tracing
- No log aggregation service

### Deployment
- Single-instance architecture
- Manual deployment process
- No CI/CD pipeline
- No blue-green deployment
- No automated rollback
- No container orchestration

### Scaling
- In-memory USSD sessions (doesn't scale horizontally)
- Single keeper instance (no distributed locking)
- Single event listener (no parallel processing)
- Database not optimized for high load

---

## User Experience Limitations

### USSD Interface
- Text-only (no images or rich media)
- 90-second session timeout (telecom constraint)
- No back button (USSD protocol limitation)
- Limited screen size (160 characters)
- No offline mode

### Admin Portal
- Desktop/tablet only (not mobile-optimized)
- Single language (English)
- Basic search (no advanced filters)
- No bulk actions
- No export functionality (CSV, PDF)

---

## Data Limitations

### Storage
- No data archival strategy
- No data retention policy
- No GDPR compliance considerations
- No data export for users
- No data deletion on request

### Backup
- Database backup manual
- No point-in-time recovery
- No disaster recovery plan
- No geographic redundancy

---

## Integration Limitations

### External Systems
- SMS simulated (not real gateway)
- No payment gateway integration
- No accounting system integration
- No ERP integration
- No mobile app (USSD only)

### Blockchain
- Single network (Polygon Amoy testnet)
- No cross-chain support
- No L2 optimization
- Fixed gas limits
- No MEV protection

---

## Design Decisions (Intentional)

These are **not limitations** but conscious design choices:

### ✅ Custodial Wallets
**Decision:** Backend holds private keys for all users and admins  
**Rationale:** Feature phone users can't manage crypto wallets  
**Trade-off:** Central trust in backend vs user sovereignty  
**Status:** Correct for target market

### ✅ Single Relay Wallet
**Decision:** One wallet submits all meta-transactions  
**Rationale:** Simplifies gas management, consistent with custodial model  
**Trade-off:** Single point of gas payment vs distributed costs  
**Status:** Acceptable for prototype scale

### ✅ 90-Second USSD Timeout
**Decision:** Sessions expire after 90 seconds  
**Rationale:** Matches industry standard, forces quick interactions  
**Trade-off:** May frustrate slow users vs security/resource usage  
**Status:** Correct per USSD constraints

### ✅ 3-Hour Dispute Window
**Decision:** Fixed 3-hour window after delivery  
**Rationale:** Balance fraud prevention vs farmer liquidity  
**Trade-off:** May miss delayed fraud vs holding funds too long  
**Status:** Can be tuned based on real-world data

### ✅ Triangular Broadcast
**Decision:** Notify all 3 parties simultaneously on delivery  
**Rationale:** Core fraud-prevention mechanism  
**Trade-off:** More SMS costs vs stronger security  
**Status:** Essential design feature

---

## Future Roadmap Considerations

### Phase 6 (Pilot Deployment)
- Real MoMo integration
- Real SMS gateway
- KYC onboarding
- Regulatory compliance
- Production security hardening

### Phase 7 (Scale)
- Multi-cooperative support
- Mobile app (native or PWA)
- Analytics dashboard
- Multi-language support
- Geographic expansion

### Phase 8 (Advanced Features)
- Smart contract automation (Chainlink)
- Weather insurance integration
- Credit scoring based on deal history
- Cooperative treasury management
- Supply chain financing

---

## Known Bugs / Edge Cases

### ⚠️ Active Issues
1. **Event listener lag:** If blockchain RPC is slow, database may be seconds behind
2. **Concurrent deal creation:** No locking prevents race conditions on nonce
3. **PIN reset:** Requires manual admin intervention (no self-service)
4. **Session collision:** Same phone dialing twice creates separate sessions

### 🐛 Minor Issues
1. Notification logs don't track delivery status (all marked "Simulated_Sent")
2. Admin portal doesn't refresh dispute queue automatically
3. USSD simulator doesn't perfectly mimic real gateway timeout behavior
4. Treasury balance warning threshold hardcoded (should be configurable)

---

## Documentation Gaps

### Missing Docs
- Deployment playbook
- Runbook for common issues
- API integration guide for 3rd parties
- Cooperative onboarding guide
- User training materials

### Incomplete Docs
- Smart contract verification guide
- Performance tuning guide
- Monitoring setup guide

---

## Compliance Considerations

### Not Addressed in Prototype
- BNR e-money licensing
- Data protection regulations
- Anti-money laundering (AML)
- Know Your Customer (KYC)
- Consumer protection laws
- Cross-border transaction regulations
- Tax reporting requirements

---

## Performance Considerations

### Not Optimized
- Database queries (no indexes on common filters)
- Event listener polls every 30s (not push-based)
- Keeper jobs run every 5 minutes (not event-driven)
- No caching layer (Redis, Memcached)
- No CDN for frontend assets
- No database connection pooling tuning

---

## Summary

This is a **learning-stage prototype** demonstrating technical feasibility and core business logic. Every limitation listed above is:

1. **Documented** (not hidden)
2. **Understood** (trade-offs clear)
3. **Addressable** (production path known)
4. **Scoped** (deliberately deferred, not overlooked)

The system proves the concept works end-to-end. Production deployment would require addressing security, regulatory, operational, and scaling concerns listed above.

---

**Last Updated:** Phase 5 Implementation  
**Status:** Prototype Complete, Production Roadmap Defined
