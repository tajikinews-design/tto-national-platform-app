# TTO-PCS-005 — isolated integration validation candidate
Date: 2026-11-01. Candidate parent: PCS-004 PR #88 SHA dcb78b4c12db06b293c5a9628f2259bb2dde12f0.
Scope: trigger existing full CORE GitHub Actions pipeline including disposable PostgreSQL 17, migration 0001–0010 and real Next/Nest/PG HTTP checks, while keeping main, deployed systems and real member/share data untouched.
Do not import secrets, issue real SMS, authorize real share transfers or publish deployments.
This branch is deliberately **not** in the W2 NO-DOCKER exception. Its draft pull request must run the real isolated PG steps. Passing tests does not imply a production deployment or legal/data-source approval.
Acceptance: actual observed exact-head CI job PASS, separate screenshot-based browser and accessibility checks, plus user approval for any integration merge. Wave 0 remains IN_PROGRESS until all gates pass.
