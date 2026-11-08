# CHILD-06 / PH12 — Torghabeh-Shandiz legal notices and longitudinal board/signatory archive

**Date:** 2026-11-08. **Draft PR:** #172 (open, unmerged). **Issue:** #171.  
**Engineering gate:** GREEN in branch CI. **Real legal source-authentication:** HOLD. **Tariff ACTIVE:** BLOCKED.

## 1. Source and separation of claims
The project owner supplied the text of a purported registered company-change notice for **شرکت تعاونی توسعه و عمران شهرستان طرقبه شاندیز** with **company legal-person identifier 14007823781** and **registration number 65549**. The supplied notice refers to board minutes **1404/08/06**, county cooperative authority letter **1293 dated 1404/11/05**, and the announced remaining tenure until **1406/12/20**. These are **source-supplied business facts**, not fabricated names.

There is **no original issuer-native Gazette notice number, Gazette issue number or certified original PDF** in the supplied material. Independent official registry/Gazette matching could not be established in this session. Consequently the code records **`USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED`**, not `OFFICIALLY_VERIFIED`, despite preserving the source details and genuine names as the test fixture. No production tenant is mapped to this cooperative, and the CI uses a completely separate fictional tenant and authorized test users.

**Safety:** The supplied 10-digit personal national identifiers are intentionally omitted from public GitHub, user-facing board history and the Excel project workbook. The legal person's separate 11-digit public identifier is retained. No manager session, private identity credentials or official company files are committed.

## 2. Parsed company governance from owner-supplied notice
| Name | Reported new/continuing offices | Event | Stated remaining tenure |
| --- | --- | --- | --- |
| عباس قنبری طرقدری | BOARD_CHAIR | APPOINTED | 1406/12/20 |
| سید جواد شاکری | BOARD_VICE_CHAIR | APPOINTED | 1406/12/20 |
| مجتبی گلپری | BOARD_SECRETARY | APPOINTED | 1406/12/20 |
| ثورج سلطانی | BOARD_MEMBER | APPOINTED | 1406/12/20 |
| مرتضی افخمی | BOARD_MEMBER | APPOINTED | 1406/12/20 |
| محمد معمرزاده طرقبه | BOARD_MEMBER | APPOINTED | 1406/12/20 |
| مرتضی کابلیان شاندیز | BOARD_MEMBER and CEO (two role events) | APPOINTED | 1406/12/20 |
| مجتبی گلپری | Former CEO | RESIGNED | reported on 1404/08/06 |

The actual start date of the **former** CEO tenure is not provided; the new notice's board-meeting date is a recorded **event date**, not an inferred historical original appointment date. A future notice may supersede this information but must not erase prior history.

**Reported signing rules, not source-authenticated legal grants**:
- Binding banking/formal/financial commitments: fixed signature **مرتضی کابلیان شاندیز**, plus the signature of **عباس قنبری طرقدری** OR **سید جواد شاکری**, **with cooperative seal**.
- Ordinary letters: **مرتضی کابلیان شاندیز** with cooperative seal.
- The application does not assume legal authority just from holding a board position.

## 3. Implemented permanent archive and integration
- New **migration 0054** `database/migrations/0054_child06_cooperative_legal_notice_history.sql` adds append-only tenant-scoped `cooperative_legal_notice_archive`, `cooperative_board_office_history`, and `cooperative_signing_authority_history`. Supports both **COMPANY_REGISTRY** and **OFFICIAL_GAZETTE**, ten notice kinds and multiple events/rules per notice.
- Records carry legal-entity identifier and registration number, meeting date (Jalali), optional original notice number, Gazette issue/publication, oversight authority letter, sanitized summary, optional source URL, immutably computed SHA256, request-key idempotency and fixed **pending authentication** status.
- Direct raw table access by `tto_app` is revoked; RLS is forced and immutable triggers protect the original chronological evidence.
- A tenant manager may submit a notice via SECURITY DEFINER `cooperative_append_legal_notice`; a tenant member, manager or legal reviewer may read only their own tenant's historical view via `cooperative_shareholder_governance_history`. Data never grants app roles, voting rights, signing powers or a tariff ACTIVE transition.
- **Nest** endpoints: `POST /v1/tenants/:tenantId/child06/legal-notices`, `GET /v1/tenants/:tenantId/child06/governance-history`, separately feature-flagged.
- **Shareholder Next BFF** `GET /api/tenants/:tenantId/governance-history` authenticates the HttpOnly session; projects only safe chronology fields and returns a strict `verified:false` source boundary.
- **Shareholder RTL page** `/tenants/:tenantId/governance-history` accessible from the shareholder’s own records; includes chronological notices, historical office events, all reported signing-rule modes and prominent provenance warning.
- **Manager RTL page** `/legal-notice-archive` linked from existing `/official-records`; permits multi-person/multi-source archival submissions. Its BFF `POST /api/tenants/:tenantId/governance-archive` enforces same-origin, cookie, input/size validation and development-only feature gate. Existing PH10 preview manual one-person source-claim screen remains intact.
- No automated scraping or issuer integration and no bulk import of every historically existing Gazette entry is claimed. Archive enables adding each entry; completeness depends on collecting the actual notices.

## 4. Actual CI acceptance
| Evidence | Outcome |
| --- | --- |
| Full PostgreSQL17 migrations, **76 files** | SUCCESS; https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42474943593 |
| PostgreSQL structural/RLS/immutability and no-approval checks | PASS |
| Full Nest real HTTP + PostgreSQL + shareholder Next cookie/BFF E2E with user-supplied company names/legal ID (no individual IDs) | SUCCESS; https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/42474943575 |
| Manager intake, member read, 9 role events, 2 signing rules, 2 preserved notices, idempotency/conflict and cross-tenant denial | PASS; marker `CHILD06_TORGHABEH_REAL_NAMED_SOURCE_DECLARED_HISTORY_NEST_PG17_BFF_PASS` |
| Regression suite | `TTO_CF02_IDENTITY_MANAGER_NATIONAL_E2E_PASS_CHECKS=348`, previously 328 |
| Prior PG17 root-signed, durable anchor/restore and 21 synthetic Ed25519 HTTP checks | PASS in dedicated CI |

The second/Gazette notice in the regression is explicitly **synthetic**, only to prove a second source record coexists without deleting the source-supplied first notice. Its notice number is `CI-SYNTHETIC-GAZETTE-002`, **not a real publication number**.

## 5. Follow-up source/governance requirements
- Obtain the original official notice number, official publication issue/date and certified original file; separately compare company ID/number and legal effective period against official registries.
- Bring prior Gazette and registry notices into the archive chronologically. Corrected announcements are new immutable entries, not edits to older entries. Build the canonical current-office view only after an explicit supersession/temporal decision and valid issuer evidence, never via `MAX(date)` alone.
- Board role display is separate from the statutory share-voting entitlement, independent legal PH12 review, fee/tariff approval and CHILD07 ownership ledger.
- Introduce a restricted, encrypted identity-linking facility later if legally necessary; the public archive and shareholder BFF must never surface raw personal national numbers.
- The manager BFF archive form is development-gated; enabling production requires an independently reviewed source authorization and privacy assessment.

**Decision:** `CHILD06_GOVERNANCE_ARCHIVE_TECHNICAL_GREEN`; `OFFICIAL_SOURCE_AUTHENTICITY_HOLD`; `PH12_LEGAL_HOLD`; `TARIFF_ACTIVE_BLOCKED`; `PR172_DRAFT_UNMERGED`; no Deploy, live share transfer, financial transactions or real data import.
