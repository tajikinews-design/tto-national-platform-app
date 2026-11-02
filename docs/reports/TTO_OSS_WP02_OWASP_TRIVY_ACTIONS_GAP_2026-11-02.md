# TTO — گزارش ممیزی امنیت توسعه بر پایه OWASP ASVS 5.0 و امکان‌سنجی Trivy
**WP-02 | نسخه ۱٫۰ | ۲۰۲۶-۱۱-۰۲ | تحلیل فقط‌خواندنی، بدون اجرای اسکن آسیب‌پذیری یا نصب ابزار**

## نتیجه فوری
TTO در شاخه مبنا **کنترل‌های مستند و آزمون‌های امنیتی موجود** دارد: قراردادهای CF01..05، RLS اجباری PostgreSQL17، تست‌های tenant isolation و session/OTP/JIT، کد W2 signed-trust **صرفاً آزمایشی**، pin شدن SHA برخی GitHub Actions، نصب `pnpm --frozen-lockfile`، یک Adaptive-CI با `concurrency` و سناریوهای منفی جداگانه. بااین‌حال در درخت بررسی‌شده (**۶۶۴ ورودی git tree**) هیچ `trivy`، `CodeQL`، فایل `.github/dependabot.yml`، فایل SBOM پایدار یا گزارش اجرای قابل‌استناد SCA اسکن‌کننده مشاهده نشد. این **عدم مشاهده در شاخه** است، نه اثبات نبود این امکانات در تنظیمات حساب یا شاخه‌های دیگر؛ آسیب‌پذیری واقعی نیز بدون scan **نامعلوم** است.

### شواهد محلی و حدود قطعیت
- مبنا: `feat/ph05-core-foundation-evidence-gates-20261102` (نسب مخزن اجرایی و PR بررسی سند OSS). `main` همان README اولیه را دارد؛ این کنترل‌ها در زنجیره Draft هستند.
- `AGENTS.md`: no real PII, no production secret, no Merge/Deploy, source 15 immutable.
- `docs/architecture/ADR-001-FINAL-STACK.md`: Next16, Nest11/Fastify, PostgreSQL17 with FORCE RLS + least-privilege app DB role; `docs/analysis/CORE_OWNERSHIP_BOUNDARIES.md` and `docs/contracts/shareholder-w1-security-test-matrix-v0.1.json` control default DENY.
- `database/README.md`, `tests/sql/tenant-isolation.sql`, `.github/workflows/next-nest-pg-ci.yml`, `.github/workflows/tto-adaptive-ci.yml`: disposable real PG17 tests and PR CI. Reports `docs/reports/PH04_INDEPENDENT_SPECIALIST_SIGNOFF_2026-11-02.md` and `docs/security/W2.8-multi-instance-trust.md` explicitly deny production signoff and distributed-trust claims.
- `docs/analysis/SECURITY_NEGATIVE_SCENARIOS.json` contains **10 original security test proposals with status NOT_RUN** even though overlapping noncanonical synthetic technical checks are reported successful elsewhere. Never silently equate a related CI check with an original official acceptance ID.
- `scripts/ci/select_suite.py`: `lite` only for Draft PR changed paths under `docs/reports/`, `docs/deployment/`, `docs/guides/` and `README.md`; unknown/empty/source-analysis changes → `core`; non-Draft PR → `release`. This **intentionally conservative** policy should not be broadened globally to bypass security.
- `docs/reports/GITHUB_ACTIONS_FREE_TIER_OPTIMIZATION_2026-10-23.md`: historic 2,000/2,000 Free-minute exhaustion and prior remediation; no assertion of current billing balance.
- Official ASVS [v5.0.0](https://github.com/OWASP/ASVS/tree/master/5.0/en), Trivy [filesystem scanning](https://www.trivy.dev/docs/latest/guide/target/filesystem/), [secret scan](https://www.trivy.dev/docs/latest/guide/scanner/secret/) and [SBOM/reporting](https://www.trivy.dev/docs/latest/guide/configuration/reporting/) checked 2026-11-02.

## 1. بندهای عینی ASVS 5.0.0 در برابر وضع مشاهده‌شده
**Status legend:** `EVIDENCE_PARTIAL` = documented/synthetic coverage exists, not independently accepted; `DESIGN_ONLY` = documented not certified; `GAP_NOT_EVIDENCED` = no demonstrable complete evidence in reviewed tree; `NOT_RUN` = no scan or canonical signed evidence. These are **preliminary** and not vulnerability verdicts.

| ASVS ID | کنترل مورد انتظار | شواهد TTO / تطبیق | ارزیابی |
|---|---|---|---|
| **6.1.1** | مستندسازی جلوگیری از brute force و anti-automation | OTP abuse guard, `cf01-smsotp-server.yml`, source CF01; policy and throttle tests in historic CI | **EVIDENCE_PARTIAL** (live upstream/proxy behavior not independently certified) |
| **7.2.1** | اعتبارسنجی session در backend trusted | `services/api` + session E2E reports; no trust in client-only cookie | **EVIDENCE_PARTIAL** (test SHA evidence exists, production readiness absent) |
| **7.4.1** | بی‌اعتبار شدن کامل session در logout/revoke | E2E 3-panel session invalidation + revoked token replay denial documented | **EVIDENCE_PARTIAL** |
| **7.4.2** | پایان همه نشست‌ها پس از غیرفعال شدن حساب | CF01 revocation mechanisms available as architectural controls; exact end-to-end all-session account-disable behavior not mapped in reviewed evidence | **GAP_NOT_EVIDENCED** |
| **8.1.1** | قوانین دسترسی function/data documentation | `CORE_OWNERSHIP_BOUNDARIES.md`, signed W2 contracts, tenant/RLS ADR | **DESIGN_ONLY / PARTIAL_TESTS** |
| **8.1.2** | مستندسازی مجوز سطح field | classification RLS and contract fields present; complete 148 logical entity field-permission parity pending | **GAP_NOT_EVIDENCED** |
| **8.2.1** | کنترل دسترسی functions | Next BFF/Nest permission contracts and negative source-domain tests | **EVIDENCE_PARTIAL** |
| **8.2.2** | کنترل IDOR/BOLA object-level | `tests/sql/tenant-isolation.sql`, own-only fictional share checks, cross-tenant denial tests | **EVIDENCE_PARTIAL** (all resource/API routes not proven) |
| **8.3.1** | authorization server-side not UI gating | Nest and PostgreSQL RLS; UI menu visibility not permission | **EVIDENCE_PARTIAL** |
| **8.3.2** | revocation authorization freshness | W2 signed revocation, version/expiry/fencing synthetic contracts; no distributed production proof | **GAP_NOT_EVIDENCED** for operational multi-instance freshness |
| **4.1.3** | untrusted proxy header spoofing blocked | source-IP/XFF abuse tests and identity boundary notes in CI | **EVIDENCE_PARTIAL** (deployed trust-proxy verification required) |
| **5.2.2** | upload content type matches extension | ClamAV adapter workflow, CF03 source upload gates | **GAP_NOT_EVIDENCED** for production every-file enforcement |
| **5.2.3** | zip/docx decompression size and file count constraints | no complete evidenced archive bomb enforcement found in inspected source tree | **GAP_NOT_EVIDENCED** |
| **14.1.1** | inventory/classification sensitive data | CF03 evidence classification and `AGENTS.md`, legal hold, no PII test policy | **DESIGN_ONLY / PARTIAL_TESTS** |
| **14.2.3** | prevent sending sensitive info to untrusted third parties | no external real-data deployment, docs forbid telemetry egress | **GAP_NOT_EVIDENCED** for deployed third-party/telemetry inventory |
| **15.1.1** | risk-based remediation deadlines for vulnerable dependencies | pinned lockfile, no observed written critical/high remediation SLA | **GAP_NOT_EVIDENCED** |
| **15.1.2** | maintained SBOM and trusted dependency inventory | `pnpm-lock.yaml` is deterministic dependency lock; **not itself an audited, versioned SBOM inventory** | **GAP_NOT_EVIDENCED** |
| **16.1.1** | security logging inventory / retention / ACL across layers | CF03 audit and Child22 contracts; full layered logging/retention deployment matrix pending | **GAP_NOT_EVIDENCED** |
| **16.2.1** | who/what/when/where for security log | audit event docs and fictional PCS009 structured log evidence; incomplete durable production proof | **EVIDENCE_PARTIAL** |

**Coverage denominator:** 19 **selected relevant** ASVS controls, not the whole 5.0.0 set. This does **not** yield an ASVS compliance percentage or a security score.

## 2. Trivy / CodeQL / Dependabot / supply-chain findings
| Capability | Evidence on reviewed branch | Gap and treatment |
|---|---|---|
| Locked dependencies | `pnpm-lock.yaml`, pinned pnpm `10.18.0`, `pnpm install --frozen-lockfile` | **EXISTS**; still vulnerability/exception/expiration policy needed |
| GitHub Action provenance | SHA-pinned checkout/setup-node in reviewed workflows, `persist-credentials: false`, `permissions: contents: read` | **EXISTS PARTIAL**; inventory **all** other actions and transitive pinning, no blanket audit claim |
| RLS / negative CI | real disposable PostgreSQL17 and HTTP tests, W2 synthetic cases | **EXISTS PARTIAL**; official 155 case acceptance and specialist signoff remain pending |
| GitHub Actions budget | Adaptive single runner, concurrency cancellation, `lite/core/release` | **EXISTS**; current run minutes and budget remain **UNMEASURED** |
| Trivy vulnerabilities/misconfiguration/secrets | no Trivy configuration/job found in reviewed tree | **NOT OBSERVED / NOT SCANNED**; cannot assert zero CVEs |
| Dependency-alert / Dependabot version/security updates | no `.github/dependabot.yml` found | **REPO CONFIG GAP**; GitHub-hosted alerts may still exist in account settings, not verified |
| CodeQL | no CodeQL workflow found | **NOT OBSERVED**; Advanced Security / security scanning entitlements need checking |
| SBOM CycloneDX/SPDX | no published maintained SBOM and retention/version/approval register found | **GAP**; avoid public artifacts or injecting secrets |
| License and proprietary data egress | policy exists; no complete dependency-level license list/Trivy result observed | **GAP** for copied third-party code and deployment |
| Security escalation process | issue/PR workflow and phase gates exist | **PARTIAL**; severity thresholds, SLA, exception expiry, named security owner and retest need decision |

**Do not run a vulnerability scan on real secrets/production data, or claim Trivy passed without a reproducible output.** Trivy usually downloads its vulnerability database; initial proof must document egress, cache, exact tool version and private storage of findings.

## 3. کم‌هزینه‌ترین مسیر واقعی، بدون اضافه‌کردن CI خودکار
### Phase 0 — Already performed (zero new scanning minutes)
- Compared approved architecture, 664-entry Git tree, existing workflows and ASVS source controls; result in this report. No secret, package, DB or CI writes.

### Phase 1 — Read-only, local/off-runner first (approval required for tools)
1. Have codeowner/security reviewer pin a known-good Trivy release binary **by digest** after inspecting official advisories; do not add `@master` action or `latest` unpinned downloads.
2. On isolated disposable **synthetic** checkout and reviewed release SHA, generate privacy-approved vulnerability summary and CycloneDX SBOM. Planned commands **NOT EXECUTED**:
   ```bash
   trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL --format json --output /tmp/tto-trivy-internal.json .
   trivy fs --format cyclonedx --output /tmp/tto-sbom-private.cdx.json .
   ```
   Validate exit codes, report count, exception review and the privacy of scan artifacts before adopting as a gate. Scanner coverage is tool-specific; absence of findings is never proof of no vulnerability.
3. Never commit reports containing secrets, private file paths or personal data, nor upload them to a public action, third-party scan service or GitHub issue. Allow only sanitised summary + exact SHA and controlled internal artifact.

### Phase 2 — Controlled manual pilot (one run, not per PR)
- Add a **separate explicitly approved** `workflow_dispatch`-only security job in another PR; **not** in this document-only PR.
- `timeout-minutes` 10–15 as provisional budget cap, one Linux runner, `permissions: contents: read`, no environment tokens, no deploy; allow reviewed tool download/cache only.
- Cache vulnerability DB by reviewed policy and avoid pulling large OCI images for first `trivy fs` pass. A capped job duration is a maximum, **not an estimate of actual minutes**.
- First release: report-only, no accidental build failure; after triage/exceptions, transition to **fail for new CRITICAL/HIGH with fixed version** subject to security owner policy. Do not suppress security findings to claim GREEN.
- Keep the result outside ordinary PR CI until budget owner accepts frequency and resource use. Optional schedule **weekly** only after verified account allowance and runtime cost.

### Phase 3 — CI preservation and budget correction
- Existing `scripts/ci/select_suite.py` supports `docs/reports/**` as light when Draft and no other changed files. This **new WP-02 report under docs/reports** is therefore eligible for `lite` if its PR diff contains only allowed paths. This avoids build/PG for pure reports **without changing production CI logic**.
- Previous broad OSS registry at `docs/analysis/TTO_GLOBAL_OSS_FIT_GAP_2026-11-02.md` is in a **separate PR #128** and correctly triggers **core**, because `docs/analysis/**` is not whitelisted. This conservative behavior is a known **minute-cost tradeoff**, not a bug to override via blanket `paths-ignore`.
- On source/code/lockfile/workflow changes: retain `core`; on ready-for-review: retain `release`; preserve required checks and deny-by-default test selection.
- Review the expense of `pull_request.edited` and repeated update events with exact Actions run timing before proposing trigger modifications. Never use PR metadata to silently bypass required reviews.
- Do **not** enable arbitrary self-hosted runners on laptops with confidential data for untrusted PRs. No automatic paid minutes or external cloud billing change.

## 4. کنترل‌های تعریف‌شده برای قبول WP-02 (هنوز PASS نشده‌اند)
| Gate | معیار پذیرش | وضعیت |
|---|---|---|
| SEC-G01 | 19 selected ASVS IDs linked to exact TTO source/test paths and reviewer dispositions | **DOCUMENTED / REVIEW PENDING** |
| SEC-G02 | Full repo dependency inventory and license notice generated, signed or SHA-linked | **NOT_RUN** |
| SEC-G03 | Pinned-version offline/private Trivy scan, vulnerability triage, exceptions and planned fix | **NOT_RUN** |
| SEC-G04 | No private data/secret in reports/logs/vendor egress; verified with synthetic repo | **NOT_RUN** |
| SEC-G05 | Workflow budget single runner, manual-only initial trigger, measured minutes, no duplicate scans | **DESIGNED / NOT_RUN** |
| SEC-G06 | Independent security/QA approves exact SHA evidence; source test IDs remain untouched | **PENDING** |
| SEC-G07 | Production/source data, share trade, live payment, legal/voting permission remain disabled | **GUARDRAIL — NO CHANGE** |

## 5. تصمیم‌ها، ریسک‌ها و نیاز به تأیید
- **P0 immediately**: approve requirements matrix and resolve reviewer/owner for remediation policy, SBOM artifact retention and scanner egress; no tool install is implied.
- **P0 next PR**: propose `workflow_dispatch`-only Trivy PoC, pinned version and bounded cache, with deterministic fixture data. Needs codeowner/security signoff; don't touch source baseline or PH05 code paths.
- **P1**: optionally configure Dependabot with carefully scoped schedule and PR limits after checking repo settings and dependency availability; do not automatically merge updates.
- **P1**: CodeQL feasibility only if account plan and Actions-minute budget permit; no duplicate scanner path.
- **HARD blockers retained**: 148 physical parity, 155 exact official AT IDs, official Child06/07 source authority, W2 operational distributed trust, independent legal/security/QA and owner release authority.

**Conclusion:** TTO already has meaningful negative and isolated database tests; the **unverified supply-chain/SBOM/vulnerability inventory and formal ASVS traceability** are the clearest observed gaps. This evaluation performed **no Trivy execution and found no evidence sufficient to declare the project vulnerability-free**.


## VERIFIED FIELD-TEST ADDENDUM — 2026-11-02, supersedes only the earlier NOT_RUN Trivy-pilot status
- **Performed:** Trivy **v0.76.1** filesystem vulnerability scan on **`pnpm-lock.yaml` only**, using an isolated exact-branch GitHub Actions job; pinned `aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25`, permissions `contents: read`, no secrets, no Docker/Production/share data, no published artifact. Final scan run [41491605676](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/41491605676), exact source SHA `2ad4a1f7aaea58eeeb265ed4bfb8be6c19a0449b`, **SUCCESS**, raw JSON deleted at job end. Earlier workflow setup failures are preserved as FAIL, not mistaken for vulnerability scan successes.
- **Observed lockfile findings: 0 CRITICAL, 4 HIGH, 3 MEDIUM = 7 vulnerabilities, all tied to `fastify@5.11.3`**. IDs and per-advisory minimum corrected version:
  | CVE | Severity | Trivy fixed version |
  |---|---|---|
  | CVE-2026-76169 | HIGH | 5.12.2 |
  | CVE-2026-84428 | HIGH | 5.12.2 |
  | CVE-2026-84469 | HIGH | 5.12.2 |
  | CVE-2026-84504 | HIGH | 5.12.2 |
  | CVE-2026-16732 | MEDIUM | 5.12.1 |
  | CVE-2026-18504 | MEDIUM | 5.12.1 |
  | CVE-2026-92081 | MEDIUM | 5.12.5 |
- **Current upstream status**: [Fastify latest official v5.12.8](https://github.com/fastify/fastify/releases/tag/v5.12.8), published `2026-11-02T10:51:32Z`, is a **security release**. Minimum `5.12.5` resolves *these seven according to the scanner*, but **5.12.8 or newer vetted 5.x** should be assessed because new advisories are possible. Scanner summary is not exhaustive and gives no exploitability proof for the particular Nest app.
- **Remediation issue** [#136](https://github.com/tajikinews-design/tto-national-platform-app/issues/136): isolated manifest+lockfile update (no hand-edit), pinned package and Nest Fastify adapter compatibility, real Nest/Next HTTP & RLS/tenant regression, fresh Trivy rescan, independent security/codeowner and owner approval before merge.
- **Gate statuses corrected only for this POC**: `SEC-G03=SCANNED_LOCKFILE_FINDINGS_PENDING_REMEDIATION`; `SEC-G04=DISPOSABLE_LOCAL_JSON_PRIVATE_LOG_ONLY` (no third-party data proof outside POC); `SEC-G05=ONE_EXACT_BRANCH_BOUNDED_JOB_EXECUTED`; `SEC-G06=PENDING`. Full repo SCA, container image scan, SBOM and code-scan/production permission remain `NOT_RUN`. **The one-off test workflow must be removed before any final merge; never expand its push trigger.**
- **Decision:** Do not adopt more OSS tools as production dependencies yet. Address observed Fastify high-severity advisories first on separately reviewed patch branch, then accept or reject additional OSS proposals based on actual evidence. No upgrade performed by this analysis.
