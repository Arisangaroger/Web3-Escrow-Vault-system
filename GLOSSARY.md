# Glossary

Plain-language definitions for the Escrow Vault prototype. Technical terms map to how an evaluator or cooperative stakeholder should think about the system.

| Term | Plain meaning |
|------|----------------|
| **Escrow contract** | The digital vault on the blockchain that holds the buyer’s eRWF until delivery is confirmed or an admin resolves a dispute. |
| **eRWF** | The project’s on-chain stablecoin stand-in for Rwandan francs (demo/test token, not national e-Franc). |
| **USSD** | Shortcodes like `*384*96#` on a basic feature phone; the farmer, driver, and buyer use this instead of an app. |
| **USSD simulator** | Browser “handsets” that pretend to be feature phones for demos and testing (not a live telecom gateway). |
| **CON / END** | USSD response types: keep the session open (**CON**) or finish the call (**END**). |
| **Sender (farmer)** | Party who ships the goods and creates the deal. |
| **Receiver (buyer)** | Party who locks payment into escrow and can dispute if goods are wrong or missing. |
| **Driver (transporter)** | Party who marks goods as delivered. Transport pay is **off-platform** between farmer and driver. |
| **Custodial wallet** | A blockchain wallet the **backend** creates and stores encrypted for each phone number; the user never holds a private key on their phone. |
| **PIN** | Four-digit code proving the person at that phone number authorized an action. |
| **Meta-transaction (meta-tx)** | User signs an action off-chain; the **relay/treasury** wallet submits it and pays gas. Identity ≠ gas payer. |
| **EIP-712** | Signature format used so meta-tx approvals can’t be forged or replayed. |
| **Relay / treasury wallet** | Shared backend key that pays gas and holds Escrow **ADMIN_ROLE** for dispute resolution. |
| **ADMIN_ROLE** | On-chain permission to call `resolveDispute`. Held by the relay; portal admins authenticate separately with email/password. |
| **Admin portal** | Web UI for cooperative managers to review disputed deals and pick a resolution. |
| **Deal status** | Lifecycle of one shipment/payment: `Created` → `FundsLocked` → `Shipped` → `Delivered` → then `Released`, or `Disputed` → `Resolved`, or `Cancelled`. |
| **Fund-lock window** | ~24 hours after deal creation for the buyer to lock funds, or the deal can auto-cancel. |
| **Dispute window** | ~3 hours after “Delivered” for the buyer to dispute before funds auto-release to the farmer. |
| **Triangular broadcast** | When delivery is marked, **all three** parties get an SMS-style alert at once so a false “delivered” is noticed quickly. |
| **Revoke / dispute** | Sender or receiver freezes a deal for admin review; money does not move until resolution. |
| **Resolution outcome** | Admin decision presets: Driver Fraud / Faulty Goods (refund buyer) or False Buyer Claim (pay farmer). Labels differ; escrow only splits sender ↔ receiver. |
| **Keeper job** | Background timer that auto-cancels unlocked deals and auto-releases funds after the dispute window. |
| **Event listener** | Backend process that watches blockchain events and updates the database + notification inbox. |
| **Action log / timeline** | Chronological audit of who did what on a deal (shown in the admin portal). |
| **Gas** | Network fee to write to the blockchain; users don’t pay it in this design—the relay does. |
| **Hardhat** | Local blockchain used for development demos (chain ID `31337`). |
| **Amoy** | Polygon’s public test network used for remote testing. |
| **Seed / reset demo** | Scripts that load (`seed:demo`) or clear (`reset:demo` / `reset:demo:full`) a known demo state. |

For product limits and production follow-ons, see [LIMITATIONS.md](LIMITATIONS.md).  
For why these choices were made, see [DECISIONS.md](DECISIONS.md).
