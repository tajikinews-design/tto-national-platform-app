# WAVE 0–3 — execution contracts and no-go gates
Version 1.0, 2026-11-01. This document is a work specification, not evidence that work has been performed.

## WAVE-0: baseline
- PR review snapshot: 81 open Draft PRs, two branches based directly on main (#1 app chain; #85 docs), and no missing parent among open PRs (at snapshot).
- Main (9eb48b7f06c25e66021adbe0b4386133cdcb3039) contains README only. Last candidate app head PR #84 a5e211ec9933055657055d2bf64712d558fe6c0e.
- Do not merge the long PR chain blind. Validate cumulative changes via diff of main vs candidate, retained test coverage, codeowners/reviews, actual migrations, needed approvals and runtime acceptance. Code baseline remains unapproved.
- G3 exit: product owner accepts target candidate/merge strategy; reproducible build/integration checks on selected new SHA; source owners identified; pilot/source lawfulness approved.

## WAVE-1: cooperative to shareholder
First vertical slice: authorized manager/approved source supplies membership and official shareholding -> tenant-scoped Nest/API -> authenticated Next shareholder displays own versioned information.
Acceptance must prove: approved Child06 membership and Child07 ownership ledger are distinct; verified session and legally linked Party; per-tenant and per-owner authorization; no-data is not zero; stale/revoked sources deny; cross-tenant, forged headers and duplicate identity deny. Frontend mobile RTL and keyboard checks. No real data until pilot consent/legal authority established.
Blockers: pilot cooperative, data controllers, source version, integration baseline, live protected test host.

## WAVE-2: communication and disclosure
Authorized publisher can draft/approve/publish scoped notice and statutory document metadata; recipient sees only published authorized items. Download right checked independently of listing. No accounting flows, banking wallet, unrestricted storage uploads or e-voting replacements. Test revocation, classification, version, audit, retention and mixed tenants.
Blockers: Child09 publisher/audience approval; legal categories; approved protected storage and malware scan for document bytes.

## WAVE-3: lawful market request + national oversight
Implement only share requests approved in official v3 spec and superior legal/board policies. State-based independent seller and buyer workflows; board decision external/manual if required. Payment buyer->seller direct; no wallet/custody, no internal accounting. Final share transfer never enabled without source-ledger atomicity, legal proof, payment evidence, revocation and collision tests. National administrator gets aggregated scoped information; no default cross-tenant superuser.
Blockers: legal trade rule registry, official ledger/source and rights, board delegation, participant eligibility, integration and independent signoff.

## Universal gates
G0 reviewed contracts and real source/owner; G1 code complete; G2 tested actual integrated environment with negative isolation and recovery; G3 recorded lawful product acceptance. Explicit NO GO on missing authorization or missing evidence. No automatic production deploy, merge, live trades or financial effect. Program status is not inferred from the number of green GitHub workflows.

## Sequence of approved next engineering work
1. Audit cumulative PR files and select integration baseline (read-only until authorized).
2. Verify actual code reuse paths and resolve competing authority contracts.
3. Run approved full tests on candidate using permitted isolated test infrastructure, not on live user/share data.
4. Obtain pilot cooperative/data legal authority.
5. Implement CAP-001..004 as a thin slice, then Wave 2 and Wave 3 as their gates pass.
