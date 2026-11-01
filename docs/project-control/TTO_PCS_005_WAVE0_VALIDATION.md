# TTO-PCS-005 — Wave 0 isolated integration and readiness evidence
Date: 2026-11-01
Scope: integrated build, actual disposable PostgreSQL17 and HTTP, temporary Chromium desktop/mobile, historical release smoke. No production, real shareholder data, SMS, shares, payment, merge or deployment.

## Exact candidate
- App Draft PR #90 branch integration/tto-pcs-005-full-validation-20261101; inherited prior PCS-004 PR #88 at dcb78b4c12db06b293c5a9628f2259bb2dde12f0.
- Docs Draft parent PR #89 at 77d754aab8c747df227ff2fca9dda994082f2bda.
- GitHub Actions first docs-only run 41303086128 SUCCESS but classified lite: no build/PG/browser. Not accepted as integration evidence.
- Run 41303146526: forced CORE plus disposable PG17; the test steps completed successfully but this was superseded by subsequent browser/release commits.
- Run 41303284573: built Next/Nest; temporary Chromium tested shareholder review and cooperative front pages at 390 and 1440 widths; temporary PostgreSQL17 migrations 0001–0010 and real Nest/Next identity, tenant and share quarantine HTTP E2E all SUCCESS.
- Run 41303499601: full release mode; Chromium, PG17 migrations and HTTP E2E, historical SQL/OTP/login regression and manifest validation SUCCESS; OCI step FAILED due to existing shell marker expression echo "TTO_RELEASE_OCI_$label_PASS" reading undefined Bash variable "label_PASS" with nounset after first image. This is a CI script bug, **not** a successful OCI acceptance. Failure preserved.
- Corrective commit 064ef8b27b280526468b540291299d49e08347d6 changes only shell interpolation of the OCI result marker to ${label}. Subsequent exact-HEAD run needs verification before this document claims OCI PASS.

## Browser coverage and limits
- Added scripts/ci/pcs005-browser-review.cjs: launches built Next shareholder and cooperative portals in local loopback, temporary Chromium, both 390x844 mobile and 1440x900 desktop viewports; verifies HTTP200, language, horizontal overflow, JS errors, no external or non-GET requests and some shareholder nav text. No real backend data, visual screenshot artifacts, no authenticated interactive management case, no WCAG audit. These **do not** demonstrate finished operational manager/shareholder workflows.

## Release acceptance remaining
- Exact-HEAD full CI including 4 OCI image build/smoke PASS.
- Confirm all PR/commit metadata and preserve CI artifacts, issue review of source/legal pilot and data owners.
- Authorized reviewer UX/UI acceptance and legally approved persistent test source; require selective code review and explicit owner approval before merging app/docs branches.
- No full official Child06 membership or Child07 ledger source contract acceptance. Wave 1 remains blocked; no real trade/ownership or finance.
- Wave 0 is still IN_PROGRESS until authorized G3; CI alone cannot mark Wave 0 completed.

## Next step
Review latest exact-HEAD CI; if regression fails, fix only documented failure, rerun and update checkpoint and acceptance register. After green, create safe signed-off consolidation proposal for PCS docs and app baseline (no silent merge).
