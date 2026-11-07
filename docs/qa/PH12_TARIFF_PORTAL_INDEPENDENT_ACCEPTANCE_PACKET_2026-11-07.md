# PH12 Share-Market v3 — independent QA / cooperative legal-source acceptance packet

Date: 2026-11-07. Scope: **tariff configuration, board resolution, financial officer + CEO**.
Normative product contract: `TTO-SHARE-MARKET-SPEC v3.0`, §§21–25 and §51.
Product owner clarification: tariffs are dynamically configurable per cooperative, must be linked to an actual board resolution, and cooperative-account fee receipt requires **both** authorized financial officer and CEO confirmations. The platform does not provide cooperative general accounting and holds **no funds**.

## Distinguish three gates

1. **Lab evidence**: Isolated PG17/API checks are synthetic and can be GREEN. They never prove the lawful existence of a board decision, appointment or bank receipt.
2. **Authenticated source evidence**: A cooperative supplies the signed, current board decision covering the exact tariff, fee method and split, the authorization of its finance officer and CEO, and bank-origin settlement information. Reviewer identifies the real cooperative and signatories, checks document integrity/date/scope and ensures no revocation or supersession. **No such authenticated package is presently attached or verified.**
3. **Independent QA**: A human reviewer not the change author executes the cases below on a separately configured test tenant and signs outcomes, timestamps, SHA/build, and evidence references. **No independent human signoff has been received.**

## UAT cases

| ID | Independent procedure and expected result | Mandatory evidence before PASS |
|---|---|---|
| TAR-AT-001 | Authenticated cooperative manager opens tariff page; unauthorized/no-session and cross-tenant requests are refused. | Valid identity/tenant role from approved source, HTTP trace. |
| TAR-AT-002 | Create a new tariff and correct it from the management interface without code deployment. | Actual board decision and effective scope; durable backend draft store. |
| TAR-AT-003 | Publish tariff change only after verifying original board resolution and authority of signatories; plain references must NOT publish it. | Signed original board minutes, source check, immutable approval event. |
| TAR-AT-004 | Edit tariff by creating an incremented version; old transaction snapshot remains unchanged, new transaction sees effective version. | Version history, timestamps, approved policy source, old/new cases. |
| TAR-AT-005 | Test FIXED, PERCENTAGE, FIXED_PLUS_PERCENTAGE and CUSTOM_APPROVED_BASE against approved price/base source, min/max and integer rounding. | Approved tariff formula and custom-base method, independent calculations. |
| TAR-AT-006 | BUYER/SELLER/SPLIT percentages conserve total, do not silently change prior obligations or use a different tenant's policy. | Board fee split, balanced test ledger evidence. |
| TAR-AT-007 | Financial officer authority comes from time-valid board mandate; wrong/revoked role must be denied. | Signed mandate and source-derived privilege scope. |
| TAR-AT-008 | CEO authority derived from official office/appointment evidence, not self-asserted form values; expired or revoked claim denies. | Official registration/board appointment and revocation proof. |
| TAR-AT-009 | A buyer/seller reports external cooperative-fee payment; amount, destination and receipt reference are independently verified; report alone is not PAID. | Direct cooperative bank-origin evidence, privacy-controlled. |
| TAR-AT-010 | Only distinct authorized finance officer and CEO can jointly endorse the cooperative receipt; each solo signature is insufficient. | Two independently authenticated approvals and exact transaction linkage. |
| TAR-AT-011 | Rejection, cancellation, revocation, replay and concurrent attempts remain append-only and fail closed; no false PAID. | Negative-case logs and event chronology. |
| TAR-AT-012 | Without successful source/signoff and official share-register entry, no appointment, transfer, wallet/custody or ownership update is performed. | Transaction trace and official cooperative share-register authority. |

## Current software reality

- `apps/cooperative-management/app/share-market/tariffs/page.tsx`: **authenticated, tenant-scoped client draft preparation and JSON handoff**, not persisted tariff CRUD in production.
- `apps/cooperative-management/app/api/tenants/[tenantId]/share-market/tariff-draft-readiness/route.ts`: read-only tenant verification through Nest session and FORCE RLS; **no POST or business authorization**.
- `services/api/src/market-v3-disposable-tariff-admin.ts`: isolated lab-only tariff draft CRUD and two-role receipt simulation. It is not imported into the production Nest `AppModule`.
- `TTO_Master_Execution_Roadmap.xlsx` remains the sole durable project tracker; `PH12_Tariff_UAT_v423` cases remain **NOT_SIGNED** until the original reviewer formally signs each.

## Reviewer acceptance record (unfilled on purpose)

QA reviewer name / organization: **NOT_ASSIGNED**  
Reviewer authorization and independence evidence: **NOT_PROVIDED**  
Cooperative identity and tenant: **NOT_PROVIDED**  
Signed board resolution identifier/hash: **NOT_PROVIDED**  
Finance officer board mandate: **NOT_PROVIDED**  
CEO mandate/current office verification: **NOT_PROVIDED**  
Verified cooperative bank settlement reference: **NOT_PROVIDED**  
Build SHA and separate QA environment: **NOT_CERTIFIED**  
Cases TAR-AT-001..012 officially PASS: **0/12**  
Original MEMBER-AT-001..007 and SHARE-AT-001..008 officially PASS: **0/15**  
PH12/PH13: **HOLD**; PR169: **DRAFT**; **NO Merge, Deploy, real PAID, appointment, payment custody or share-title transfer**.

Do not upload personal identity or bank account details to public GitHub issue comments. Use private approved evidence storage and put only immutable redacted references in the tracker.
