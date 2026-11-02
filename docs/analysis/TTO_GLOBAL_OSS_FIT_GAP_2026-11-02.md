# TTO — Global open-source projects × real architecture fit-gap and adoption gates
**Document:** TTO-GLOBAL-OSS-FIT-GAP-v1.0  
**As of:** 2026-11-02 (Europe/Berlin); **status:** PROPOSED FOR REVIEW — documentation only.  
**Evidence boundary:** approved source repo `tajikinews-design/tto-national-platform@5eb6be8edfbb61f2eca740a42c30f572b493f023` is **immutable**. App analysis reference branch: `feat/ph05-core-foundation-evidence-gates-20261102`. This document has no authority to modify approved source, merge, deploy, install packages, run production migrations, onboard real shareholder data, or initiate share/financial workflows.

## Executive decision
**Reuse proven ideas and narrow components, not a replacement cooperative platform.** Immediate low-risk work: requirements traceability to OWASP ASVS; read-only software-composition/security inventory; cooperative-member and capitalization **conceptual crosswalks**; component-level UI evaluation in a standalone fixture. Any authorization engine, auth platform, storage back end or workflow runtime is a **separate ADR / proof of value / owner-gated decision**, not an approved architectural substitution. This work does not close source parity, independent QA, or pilot legal authority.

## Source-of-truth, baseline and unresolved authority
1. Immutable original 15 documents: `docs/source/SOURCE_BASELINE.json` and `TTO-IMPLEMENTATION-SPECIFICATION-MASTER-v1.0.docx`; product scope `TTO-MVP-BASELINE-RECONCILIATION-v1.0.docx` and `TTO-Share-Market-Spec-v3.0.docx`.
2. Current engineering ADR: `docs/architecture/ADR-001-FINAL-STACK.md`: three Next.js 16/React/TS surfaces, modular NestJS 11/Fastify, PostgreSQL 17 with forced RLS and separate runtime role; SQL-first migration; REST/OpenAPI; outbox; S3-compatible evidence adapter; pnpm; synthetic test environments.
3. Canonical 23 CHILD domains (source catalog), 148 logical entities, 786 field phrases and 155 original acceptance IDs. These are design/source **inventories**, not 148 physical tables or 155 accepted runtime tests; refer `docs/reports/PH00_PH01_FINAL_SOURCE_EVIDENCE_AUDIT_2026-11-02.md` and issue #119. Detailed CF01 has 18 tests; CF02 22; never conflate with eight-case summaries.
4. Boundaries: `USER_ACCOUNT != PARTY != COOPERATIVE_RELATIONSHIP != SHARE_OWNERSHIP_LEDGER`; Party merge never transfers shares; reported payment != verified payment != finalized ownership; national platform admin is NOT a tenant superuser; all sensitive tenant reads use explicit authority and JIT where required.
5. Product registry `docs/project-control/CAPABILITY_REGISTRY.json`: CAP-001..010 status as of 2026-11-01; `docs/project-control/ROADMAP.json`: Wave-0 G3 owner review incomplete, Wave-1 official Child06/07 sources BLOCKED. PR #125 is PH05 **under review**; source/legal/independent signoff still pending. Documentation lineage and release status may be stale across stacked Draft PRs; confirm exact live SHA when acting.
6. No wallet/top-up/cash withdrawal, general ledger, independent official ministerial e-voting replacement or unapproved share trade in MVP. No real PII, real share ownership, money movement, production secrets or vendor data transfer in evaluation. Vercel permitted only for protected synthetic internal previews within actual plan terms; final production requires separate dedicated-server authorization under existing policy; no automated production deployment.

## Comparative shortlist (2026-11-02 repository metadata; code not yet audited)
**Decision codes:** REF = read/reference ideas only; POC = isolated non-production proof of concept; PILOT = candidate for small reviewed component integration; HOLD = later dependency and ADR; EXCLUDE = out of current MVP. Every candidate remains **NOT_ADOPTED**.

| ID | Public repository | Fits TTO contract | Proposed use | Decision | Main hard gate |
|---|---|---|---|---|---|
| OSS-01 | [OWASP/ASVS](https://github.com/OWASP/ASVS) | CF01–05, Child20,23; security negative scenarios; all three portals | Map ASVS requirements to existing source IDs and tests; do NOT rename source acceptance IDs | **REF / P0** | Only mapping/checklist; no claim of audit certification |
| OSS-02 | [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | Child23 CI supply chain; source dependencies/OCI | Read-only SBOM/vulnerability feasibility and budgeted CI proposal; never upload code to external scanner without review | **POC / P0** | Exact version/action digest, false positives, minutes, artifact privacy; separate CI PR |
| OSS-03 | [Open-Cap-Table-Coalition/Open-Cap-Format-OCF](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) | Child07, CAP-004/007, NAV-02/03; Share Market Spec v3 | **Semantic crosswalk only**: ownership events, timestamps, history, share classes; never use format as official Iran cooperative ledger | **REF / P0** | OCF legal/license scope unresolved; independent Child07 source authorization; no generated trade schema |
| OSS-04 | [SuperCoopBerlin/tapir](https://github.com/SuperCoopBerlin/tapir) | Child06, CAP-003, NAV-02 | Compare member join/change/exit, forms, status history; **no code import** | **REF / P0** | AGPL-3.0, German cooperative model not Iranian legal truth |
| OSS-05 | [membermatters/MemberMatters](https://github.com/membermatters/MemberMatters) | Child06, CAP-003; member self-service | Benchmark UX, enrollment, record change and contact consent | **REF / P1** | Membership != account != official shareholding; data minimization |
| OSS-06 | [civicrm/civicrm-core](https://github.com/civicrm/civicrm-core) | Child06,09,10,14; CAP-003/005 | Membership/workflow/communications patterns | **REF / P1** | AGPL, unrelated PHP stack; no replacement of Next/Nest |
| OSS-07 | [TanStack/table](https://github.com/TanStack/table) | NAV-01/02/10, CAP-002/008/009 | Standalone RTL table experiment (keyboard, filters, paging, accessible no-data state) | **POC / P1** | Must not expose unauthorized rows or misrepresent missing KPI as zero |
| OSS-08 | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | shared UI; 3 portals NAV-01..11 | Small isolated RTL/a11y fixture; reuse agreed Vazirmatn design tokens | **POC / P1** | No overwrite of approved visual baseline; copy/upgrade needs attribution and review |
| OSS-09 | [marmelab/react-admin](https://github.com/marmelab/react-admin) | management/national portal; CAP-002/008 | Study admin grid/forms and compare bundle/role boundaries | **REF / P1** | Framework-wide abstraction may conflict with existing routing/design; do not replace panels |
| OSS-10 | [pgaudit/pgaudit](https://github.com/pgaudit/pgaudit) | CF03 audit, Child20/22/23 | Review DB audit **complement** against immutable business audit/evidence | **HOLD / P1** | Never substitute for signed domain audit; extension availability/retention/PII/prod approval |
| OSS-11 | [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | Child23 operational observability | Offline design for redacted structured tracing/logging across Next/Nest/outbox | **HOLD / P1** | No session, OTP, PII, hashes, legal evidence or secret leak in traces; hosting ADR |
| OSS-12 | [jaegertracing/jaeger](https://github.com/jaegertracing/jaeger) | Child23 diagnostics | Compare self-hosted trace query against simpler baseline | **HOLD / P2** | Same telemetry privacy and production infrastructure gates |
| OSS-13 | [cerbos/cerbos](https://github.com/cerbos/cerbos) | CF01/02/04; W1/W2 PDP/PEP | Offline differential evaluation of deny/allow **without wiring routes** | **HOLD / P1** | One policy authority; fail-closed, revocation, signed trust, multi-instance fencing, no new path to bypass RLS |
| OSS-14 | [openfga/openfga](https://github.com/openfga/openfga) | CF01/02/04; role/resource relations | Compare relation tuples with current authority model | **HOLD / P1** | Alternative to Cerbos not complementary by default; never become ownership source |
| OSS-15 | [keycloak/keycloak](https://github.com/keycloak/keycloak) | CF01 identity/session | Compare OIDC standards against existing domestic OTP/session adapter | **HOLD / P2** | Not a silent authentication migration; session revocation, provider availability and data residency |
| OSS-16 | [temporalio/temporal](https://github.com/temporalio/temporal) | Child04/05/23 | Durable workflow ideas for long approvals, replay and idempotency | **HOLD / P2** | Keep transactional outbox first; no additional distributed runtime absent measured need |
| OSS-17 | [seaweedfs/seaweedfs](https://github.com/seaweedfs/seaweedfs) | CF03, Child22 | Storage architecture benchmark vs approved S3 adapter | **HOLD / P2** | Legal hold, quarantine, malware scanning, encryption, residency, restore tests |
| OSS-18 | [loomio/loomio](https://github.com/loomio/loomio) and [decidim/decidim](https://github.com/decidim/decidim) | Child08/13, NAV-04 | Deliberation and participatory-UX reference | **REF / P2** | Not an official legally binding election/voting system; AGPL constraints |
| OSS-19 | [documenso/documenso](https://github.com/documenso/documenso) | CF03/Child08/09 | Comparative reading on signing flow only | **HOLD / P2** | AGPL/commercial licensing and Iranian electronic-signature validity, legal reviewer |
| OSS-20 | [formancehq/ledger](https://github.com/formancehq/ledger) | Possible **future** financial architecture | No implementation under current MVP | **EXCLUDE / P3** | General financial ledger/wallet not approved; finance/legal scope change mandatory |

**Licensing screen**: Repo metadata identified MIT (TanStack, shadcn/ui, React Admin, Temporal), Apache-2.0 (Trivy, OpenTelemetry, Cerbos, OpenFGA, Keycloak), AGPL-3.0 (Tapir, Loomio, Decidim, CiviCRM, Documenso), CC-BY-SA-4.0 (OWASP ASVS). GitHub API returned `NOASSERTION` for Open Cap Format and pgAudit: review LICENSE file/component-level grants before any code copy, deployment or derivative distribution. These metadata observations are not final legal advice; verify commit-specific licenses, NOTICE, dependency graph, outbound network behavior, maintenance and security advisories.

## Non-negotiable safety case / acceptance gates
- **Security & tenancy:** forbidden cross-tenant API/DB/search/export/cache/job/file access and admin escalation MUST deny; current server-side tenant context + FORCE RLS remain controlling; test unauthorized behavior and no side effects.
- **Legal source:** Child06 membership and Child07 ledger are separate official authorities. A reference schema or demo member list MUST NOT create verified membership, share ownership, entitlement or ledger write.
- **Trust lifecycle:** no replacement/bypass of W2 signed key revocation, epoch, TTL/fencing semantics; never infer synthetic PASS implies distributed production safety. Old/revoked/isolated replicas deny.
- **Data protection:** no live PII, raw token, OTP, private file, official shareholder record or real SMS in OSS POCs, CI logs, hosted demos or SaaS telemetry.
- **UI:** Persian RTL, keyboard-only flows, visible focus, WCAG-aligned contrast, accessible names, no fake counters, no_data != 0, no financial operation enabled by preview.
- **Operational:** pin immutable dependencies/digests, create SBOM, license inventory, provenance and rollback; respect available Actions minutes; all evaluation uses isolated, disposable environments and does not enable network writes by default.
- **Evidence:** requirement/CHILD/CAP/NAV mapping → exact git SHA → test IDs/outcome → artifact URL → reviewer decision; specialist signatures, 148 physical parity and 155 official tests remain independent downstream blockers (issue #119, #122, #126 as applicable).
- **Deployment:** no merge into main, release, Arvan deployment or protected Vercel preview change without explicit separate approval.

## Executable adoption work packets (issues should track these, not imply completion)
### WP-01 — Source-to-OSS semantic crosswalk (P0, docs-only)
- Inputs: Source SHA/15 originals; `CHILD_CATALOG.json`, `CORE_OWNERSHIP_BOUNDARIES.md`, `CAPABILITY_REGISTRY.json`, original Share Market Spec, Issue #119.
- Deliverable: two traceable mapping tables, `Tapir/MemberMatters → Child06` and `OCF → Child07` with **keep / adapt / reject / legal-uncertain**, every mapping linked to original term rather than inferred official mandate.
- PASS: reviewer confirms Party≠member≠share owner, legal authority and sourceVersion/asOf explicit, no cross-tenant leakage and no data import. STOP if direct official source text cannot be inspected or legal meaning ambiguous.
### WP-02 — OWASP & Trivy safe supply-chain baseline (P0, isolated)
- Inventory existing dependency audit, current security tests, CI triggers/consumption, current AGENTS restrictions. Produce ASVS crosswalk to existing security negative tests; offline SBOM format/retention proposal and pinned Trivy proof **without changing workflows** first.
- PASS: exact source-version mapping, no vulnerability claims from unexecuted scan, bounded Action minutes estimate, secrets scrub, version locks, reproducible local/CI recipe. STOP on unapproved artifact egress or CI cost.
- Separate code PR only after codeowner accepts tool/version and work plan; no automatic PR/secret uploads.
### WP-03 — RTL data-grid fixture (P1)
- Comparison only in isolated fixture: existing UI vs TanStack Table; shadcn/ui optional and separately assessed.
- PASS: 390px and 1440px; Persian RTL order; keyboard focus; axe accessibility; unauthorized item absent at API and DOM; no_data distinct from 0; no approved PNG baseline replacement. STOP on bundle/security regression.
### WP-04 — Policy engines differential lab (P1; ADR-required)
- Compare **Cerbos OR OpenFGA** to baseline policy contract, signed revisions and revoked authority through a synthetic detached test harness. No route, DB or PEP changes.
- PASS: stale policy, network partition, missing tenant, key revocation, replay, cross-tenant and crash recovery all fail-closed; independent security reviewer accepts evidence; adds material benefit beyond current system. STOP if a parallel policy source could grant access.
### WP-05 — Evidence, storage and telemetry architecture (P2)
- Evaluate pgAudit, OpenTelemetry and storage alternatives against Child03/20/22/23 legal-hold, retention, residency, audit immutability and log classification.
- PASS: reviewed retention matrix, measured overhead in disposable environment, no classified telemetry leakage, signed hosting/operational ADR. STOP if credentials/real records needed for evaluation.

## Decision procedure and ownership (roles, not fabricated people)
1. **Engineering owner:** prepare exact-SHA diff and proof-of-value; confirm no duplicated existing capability.
2. **Product/source owner:** validate functional need against immutable approved source, CAP/NAV/CHILD boundaries.
3. **Legal/compliance:** review licenses, AGPL/network/NOTICE duties, Iranian cooperative law, privacy and electronic signature where relevant.
4. **Security/DB reviewer:** test RLS, policy fail-closed, source provenance, no-secret/no-PII logging, signed trust and tenant leakage.
5. **Independent QA/accessibility reviewer:** prove synthetic tests, Chromium keyboard/RTL/contrast, regression and exact artifacts.
6. **Project owner:** separately approve architecture changes, infrastructure, merge and production gates. No approval is inferred by issuance of this report or opening planning issues.

## Evidence and decision log
| Item | Current state | Evidence or blocker |
|---|---|---|
| Source repository | PINNED / READ-ONLY | `SOURCE_BASELINE.json`, immutable 15 documents, commit `5eb6be8e...` |
| Three-portal app and stack | IMPLEMENTATION CANDIDATE | `ADR-001-FINAL-STACK.md`, feat/ph05 branch; main README only |
| Source physical parity | BLOCKED | original 148 logical entities/786 phrases not all implemented |
| Formal acceptance | BLOCKED | original 155 source IDs; independent reviewer exact-SHA approval missing |
| Real member/share source | BLOCKED | Child06/Child07 source and legal authority absent |
| Global OSS project installation | **NOT STARTED** | shortlist is review, not an approval or installed integration |
| GitHub adoption document | PREPARED ON ISOLATED BRANCH | this file; no approved merge |
| Production or live share trade | **NOT AUTHORIZED** | no deploy, real data, payments or share changes |

## References / audit trail
Internal (app repo): `docs/architecture/ADR-001-FINAL-STACK.md`, `docs/architecture/TTO_OWNER_DESIGN_PHASE_CLOSURE_20261102.md`, `docs/project-control/{ROADMAP.json,CAPABILITY_REGISTRY.json,DECISION_REGISTER.md,RISK_AND_BLOCKERS.md}`, `docs/reports/PH00_PH01_FINAL_SOURCE_EVIDENCE_AUDIT_2026-11-02.md`, `docs/reports/PH04_INDEPENDENT_SPECIALIST_SIGNOFF_2026-11-02.md`, `docs/security/W2.8-multi-instance-trust.md`, source SHA-pinned `SOURCE_BASELINE.json`, security and acceptance issues #119/#122/#124/#126. Public upstream repositories linked in table (GitHub metadata accessed on 2026-11-02; not a code-level vulnerability audit).

**Change control:** Document-only proposal. No framework change, package installation, migrations, real user data, secret exposure, CI workflow change, merge, deployment, official voting, share transfer or payment authorization.
