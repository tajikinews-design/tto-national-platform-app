# TTO — Project-owner approved design-phase boundary and non-production policy (2026-11-02)

**Decision ID:** TTO-PH01-PH02-OWNER-BASELINE-20261102  
**Status:** OWNER-ATTESTED DESIGN BASELINE; no claim of external signed specialist review or completed production acceptance.  
**Authority evidence:** the project owner explicitly states in the current project conversation that all necessary project decisions and specialist approvals have been given, and directs closeout of PHASE-01/02. Reviewer identities and signature artifacts were not supplied; these are **owner-attested**, not independently cryptographically verified sign-offs.

## Approved interpretation of the staged plan

PHASE-01 is the **logical contract and design readiness** phase under the approved `IMPLEMENTATION_PLAN.md`. PHASE-02 is the **architecture contract and environment-policy design** phase. Running 155 domain acceptance tests and fully implementing 148 entities are **not silently waived**: all 148 source entities and 786 field phrases remain in the immutable source inventory; all 155 test IDs, expected results and gaps remain. Their physical runtime parity and exact execution evidence are mandatory exit conditions for PHASE-04–09 and PHASE-12/13, with **no production release permitted before acceptance**.

### PHASE-01 design-gate disposition

- C01–C04, C07: preserve existing GREEN.
- C05 (design only): index all 148 entities/786 source field phrases, indicate candidate SQL correspondence and explicit UNIMPLEMENTED/PARTIAL status rather than assert physical equality. Original **physical-parity** obligation remains as separately blocking PH04–09.
- C06 (design only): retain 155 canonical acceptance IDs/scenarios, expected outcomes, trace gaps and later implementation owners; exact SHA/run/independent QA of each scenario remains PH04–09 / PH12 mandatory.
- C08: owner expressly attests that necessary specialist decisions and reviews are approved; project-level source precedence decision accepted for **design planning**: preserve original immutable sources; dedicated CF01 18-case contract is the detailed assertion source with namespaced IDs; Unified Pack 8 summary cases are provenance aliases; numeric collisions must not be silently conflated. Identity of each specialist, independent SHA-bound signatures and legal approval remain *not independently verified* and must be attached before regulated production acceptance.

**Design baseline verdict:** `PH01_DESIGN_BASELINE_OWNER_APPROVED`. This must never be reported as 148/148 live SQL parity or 155/155 executable PASS. The physical/QA gates retain hard release blockers.

### PHASE-02 design-gate disposition

- C01/C02/C03: architecture decisions and CI-backed RLS/transaction-local isolation + 23-domain contract design already evidenced (Release `41409321670`).
- C04: **Vercel Hobby is exclusively a non-production, non-commercial synthetic test environment**; no real shareholders, cooperative production secrets or transactions, no monetization, public service or commercial customer delivery via Vercel. Production target is a **dedicated server** requiring later security review and explicit release. Vercel SSO protected all four PREVIEW projects and anonymous route probes reached official login. Protected previews do **not** prove vendor eligibility for a commercial project: if a particular use is considered commercial under Vercel's terms, that use is prohibited on Hobby and must move to an authorized plan/environment or be cleared with Vercel. No representation of unconditional Vercel compliance is made.
- Design policies for secrets, protected storage, rotation, tenant boundary, legal hold, production-host hardening, TLS, backup/restore and incident response are accepted as an **architecture baseline**, not as deployed infrastructure.
- Production deployment and source migrations are explicitly **not authorized by this design acceptance alone**.

**Design baseline verdict:** `PH02_DESIGN_BASELINE_OWNER_APPROVED`. Runtime infra and dedicated-server rollout remain subsequent delivery gates.

## Mandatory non-waivable downstream release gates

1. PH04–09: 148 real entity schemas/fields/invariants and every relevant permission/authority state implemented, migrated, independently tested; source gap registry reconciled.
2. PH04–09 / PH12: all original 155 source acceptance IDs bound to exact requirement, source assertion, executable test, immutable commit SHA, run and QA evidence. Detailed CF01 18 tests remain separate from source 8 summary IDs.
3. PH12–13: legal/shareholder/payment authority, real-world contract signoff, dedicated-server infrastructure and resilience, actual security QA and regulated release permission.
4. Vercel Hobby must stay isolated to permitted noncommercial synthetic usage; dedicated server is the only approved production destination; no real operations in previews.
5. Preserve change history and source URLs in the **single canonical master workbook**; no retroactive editing of immutable source contract semantics.

## Explicit evidence classification

- **Confirmed directly:** immutable source extraction 148/155; 786 field phrase audit; 23 ownership contracts; CI PASS Release 41409321670; Vercel preview SSO redirected anonymous requests; Vercel authenticated account reports Hobby.
- **Owner-attested:** project and specialist approval for design baseline, project environment policy.
- **Not independently validated:** actual identities/signatures of specialist reviewers; all domain runtime parity; all 155 scenario runtime passes; Vercel Hobby term interpretation for any disputed test; dedicated server provisioning and acceptance.

**This record is a DESIGN-PHASE scope and ownership attestation, not a fabricated PASS of runtime/regulated acceptance. No merge, payment, live share transfer or production deploy performed by this documentation.**
