# TTO-PCS-006 — Technical Baseline Decision and Wave-1 First Vertical Slice
Date 2026-11-01 | State: RECOMMENDED TECHNICAL BASELINE; OWNER G3 SIGNOFF PENDING

## 1. Verified candidate
- Application Draft PR #90 exact HEAD `064ef8b27b280526468b540291299d49e08347d6`, descendant of Draft PR #88, app tree originally from Draft PR #84. NO merge.
- PCS documents Draft PR #91 exact HEAD `9017b06c710d6ff4754986a3921fb5f89330af51`; independent document history from main. Neither PR #90 nor #91 merged.
- Exact-head GitHub Actions run 41303773442 / job 124839904879: COMPLETED SUCCESS; build and TypeScript, synthetic Chromium shareholder and cooperative 390/1440, PostgreSQL17 migrations 0001–0010, real Next/Nest/PG identity and tenant/source quarantine E2E, historical SQL/OTP login/logout, manifests, four OCI image builds/smokes without registry push. This is technical CI, not G3.
- Prior fail 41303499601 was fixed by Bash OCI echo marker correction. Preserve failed and successful run evidence.

## 2. Baseline ruling (technical, not owner approval)
**SELECT_FOR_ENGINEERING:** PR #90 SHA 064ef8b27b280526468b540291299d49e08347d6 as frozen app comparison baseline for WAVE-1 feature design and review only; no new development fork should silently reset to #84 or create alternative app architectures.
**SELECT_FOR_PROJECT_CONTROL:** PR #91 SHA 9017b06c710d6ff4754986a3921fb5f89330af51 as control-doc ancestor for PCS-006. PCS and app histories are separate.
**DO NOT:** assume app main contains code; merge the entire 80-PR stack blindly; overwrite current NAV04/font/journal with #43/#44/#64/#73; treat a green OCI test as production acceptance.

## 3. Approved procedure proposal to consolidate (approval pending)
1. Freeze the two SHAs, get codeowner review of cumulative diff of main versus app #90 and review PR side-branch decisions #43/#44/#64/#73.
2. Review control document branch independently and reconcile copy/version of docs into an isolated integration candidate based on #90, with explicit commits and preservation of Git history, without merger side effects.
3. Run exact-SHA regression on resulting combined candidate, including **full** Next/Nest/PG17, RTL Chromium review, RLS, OTP and OCI; archive runner evidence.
4. Review conflicts, data-source quarantine and branch protections; obtain explicit project-owner authorization before any merge into main, and separate authorization for any deployment.
5. Lock accepted baseline SHA only after signed technical, product, data and governance G3 decisions. A draft PR is not accepted merely because this document exists.

## 4. First vertical slice: TTO-CAP-003+004 — official cooperative membership and holdings → shareholder
**User story:** a legally authorized cooperative operator admits or validates an official source snapshot for a specific tenant and Party, after which the same authenticated shareholder can view *only their own* membership status and share quantity (with independent source version and as-of timestamps).

### Contracts already in candidate
- Shareholder BFF GET `/api/tenants/[tenantId]/me/member-record`, validates tenant UUID and session, calls Nest source endpoint, fail-closed and returns only ACTIVE membership / Party kind / sourceVersion / sourceAsOf. No browser-authorized Party, role or shares.
- Shareholder BFF GET `/api/tenants/[tenantId]/me/shareholding`, independently validates official ledger source and responds with shareQuantity as string, ledgerVersion and ledgerAsOf; distinct Child06 and Child07 authority.
- Cooperative management `apps/cooperative-management/app/modules/[id]/page.tsx` still renders PortalModulePreview; there is NO approved real source-upload/validate/approve workbench implemented. Do not expose unreviewed import endpoints or invent a write path.
- Current NAV02 review is synthetic and not evidence of an authenticated real-data panel.

### Implementation slices (complete one at a time; G0–G3 separately)
1. **CAP-001 / Identity & tenancy prerequisite:** authenticated manager and shareholder scoped to one pilot tenant; verify session revocation, Party linkage and cross-tenant negative cases. Retain existing Nest/Next checks.
2. **CAP-003 / Source admission (BLOCKED for genuine source):** declare official Child06 dataset schema, issuing authority, signature/provenance, lawful retention, official sourceVersion/asOf, consent or other legal basis, idempotent/quarantined import and human manager approval; test using isolated fictional signed fixtures until source-owner approval. Authorization comes from governance, not role name alone.
3. **CAP-004 / Separate share ledger read (BLOCKED for genuine source):** Child07 official ledger record for the same verified Party, with its own version/asOf and nonnegative exact quantity; a missing/expired ledger MUST display 'unavailable', never fabricated zero. Never infer share ownership from membership.
4. **Shareholder end-to-end view:** use actual authenticated session, backend-authorized Party, source-approved row-level tenant projection; display official issuer, as-of/version and separate member/holding unavailable states; no fake fixtures on authenticated view.
5. **Manager review UI:** authorized manager sees status of validation/provenance and rejects stale/forged/conflicting records, not an unrestricted free-form share editor. No authorization to mutate official share ledger unless separately delegated and signed off.
6. **G2 tests:** independently reject wrong tenant, wrong Party, copied cookie, client-supplied role/Party, forged trusted headers, revoked session, duplicate source version, stale record, network failure, ambiguous/missing holdings, tampered source and simultaneous unauthorized change. Verify RTL keyboard/mobile and audit trail.
7. **G3 acceptance:** product reviewer and lawful Child06, Child07 source owners approve versioned fixture/provenance, UX and intended audience. Only then consider real pilot data in a separately approved protected environment.

## 5. Required decisions before Wave-0 G3 / Wave-1 real data
| Decision | State | Accountable |
|---|---|---|
| Approve frozen app baseline #90 and its cumulative PR review | PENDING | Project owner / codeowner |
| Approve isolated combined-docs + app integration approach and merge plan | PENDING | Project owner / codeowner |
| Approve manual responsive/keyboard UX and authenticated workflows | PENDING | Product and QA reviewer |
| Select pilot cooperative and permitted dataset / lawful processing basis | PENDING | Project owner / cooperative |
| Accept 9 Child06 membership provenance controls | PENDING | Official membership source owner |
| Accept 10 Child07 ledger controls independently | PENDING | Official ledger and legal authority |
| Permit production deployment or real shares | NOT AUTHORIZED | Independent explicit approval |

**Wave-0 is TECHNICALLY READY FOR OWNER G3 REVIEW, not ACCEPTED. Wave-1 G0 is SPECIFIED, real-data activation BLOCKED.** No Merge, Deploy, account/ledger write or real trading executed.
