# TTO W1 — Isolated Policy Enforcement Point (PEP) v0.1

**Baseline:** accepted synthetic PDP `ca084742c760ceefb5205dcc8d31cda17bb24a05` (PR #61).  
**Phase:** 2026-10-30 / TEST-ONLY. **No authorization activation, no real data or operations.**

## Deliverables
- `scripts/security/w1_pep_simulator.py`: pure in-memory simulator, invokes the isolated PDP and checks its output before exposing **only a synthetic demonstration marker**.
- `scripts/ci/test_shareholder_w1_pep_simulator.py`: nine offline unittest methods; existing Docker Release auto-discovers these tests through `scripts/ci`.
- Existing `scripts/security/w1_pdp_simulator.py` and its 29 test fixtures are unchanged.

## Four acceptance capabilities
1. **PDP before resource**: PEP calls PDP first; on any `DENY`, a synthetic resource object's `touches` counter stays at zero. Neither `ALLOW` nor any operational effect exists.
2. **Tenant and ownership isolation**: changing tenant match, Party link, or resource ownership fails closed; failures never reach the demonstration object.
3. **Operation separation**: `read` cannot grant `download`, `export`, `write`, `trade`, or `finalize`; business/legal/source approvals remain independent.
4. **Security audit (in-memory demonstration only)**: each decision has UUID request ID; events have only `requestId`, `operation`, `decision`, `reasonCode`. No session, token, Party, tenant, resource, payload, PII or financial information is written. Audit failure blocks access.

## Explicit boundaries
- No Next route, Nest endpoint, SQL migration, RLS change, credentials, network, disk persistence, real source adapter, payments, actual shares, account mutation, or deployment.
- `SIMULATED_ALLOW` yields `{kind: SYNTHETIC_DEMO, record: null, persisted: false, operationalEffect: false}` rather than a record.
- `LIVE`, `STAGING`, `PRODUCTION`, `REVIEW`, null and malformed operation/context are all denied.
- The PEP and PDP files are located only under `scripts/security`, not the live application/module import graph. They must not be used as runtime authorization.
- The main `NAVIGATION_CONTRACT.json` retains 11× `authoritative_routes: null` and `permission_policy: null`.
- Source approval and legal authority have not been established by these tests.

## Acceptance evidence required
- A clean clone/checkout at the **exact proposed SHA**, local isolated Docker Release `ExitCode=0`, and `TTO_LOCAL_RELEASE_PASS_SHA=<SHA>`.
- Both test methods `test_01_denied_requests_never_touch_resource` and `test_06_audit_failure_denies_before_resource_touch` reported `ok` within unittest output; capture both stdout and stderr.
- A 29-case synthetic matrix PASS, no tests skipped or removed, and all previous release gates unchanged.
- PR remains Draft; **no merge, deploy or real operation**.

## Threat and caveats
The in-memory audit is a demonstrator, not a durable or tamper-evident production audit. PDP's test-only approval flags and PEP's fixture counter must never be confused with authoritative source proofs, real ownership checks, or actual RLS isolation. Future runtime enforcement requires separately designed, approved and tested session/tenant/service-side proof, legal source admission, deny-side privacy controls, and independent release acceptance.

**Verdict before exact-SHA Release: CODE CREATED / ACCEPTANCE PENDING / LIVE BLOCKED.**
