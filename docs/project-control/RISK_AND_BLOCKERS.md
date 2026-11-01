# Risk and blocker register

| ID | Risk | Severity | Treatment |
|---|---|---|---|
| R-001 | main has one README while candidate code is in stacked Draft PRs | CRITICAL | Reconcile PR parents/head and consolidate only by approved review procedure |
| R-002 | Candidate NAV01..NAV11 are synthetic review interfaces | HIGH | Implement thin vertical slice with authentic data and authorization |
| R-003 | Official Child06/Child07 sources and legal authority not accepted | CRITICAL | Block member/holding/trade real read/write activation |
| R-004 | Preview backed API/PG persistent authorization and actual SMS unverified | HIGH | Protected test-only readiness plan; do not deploy automatically |
| R-005 | W2.7..W2.14 offline security checks mistaken for production safety | HIGH | Separate synthetic PASS from operational G3 acceptance |
| R-006 | National admin has generic preview shells without scoped use cases | MEDIUM | Implement targeted aggregated operational monitoring after core domain |
| R-007 | Documentation/status drift across 80 open PRs | HIGH | One versioned checkpoint, exact SHA, automated reconciliation later |
| R-008 | Unapproved sensitive document upload/storage | HIGH | Block real upload until scanning/retention/access design approved |

## PCS-017 observed G3/pilot risks (2026-11-01)
| ID | Evidence | Severity | Owner/action | Status |
|---|---|---|---|---|
| R-009 | `main` unprotected; no standard-path CODEOWNERS; PR #109/#111 have no recorded review | CRITICAL G3 | project/codeowner: enforce controlled merge and cumulative main→#109 review | OPEN |
| R-010 | Existing shared CSS has small text contrast ~3.02:1 and ~3.23:1 versus 4.5:1 normal-text AA | HIGH UX | UI/QA: fix in separate reviewed PR, validate visual and keyboard behavior | OPEN |
| R-011 | Manager demo hardcodes one fixture identifier; review status overwritten after refresh | MEDIUM product | product/UI: distinguish CI fixture page from any operational flow, redesign before pilot | OPEN |
| R-012 | No selected lawful pilot, Child06 steward or independent Child07 ledger authority | CRITICAL legal/data | owner/legal/data custodians: approve independent source/pilot packets before real data | BLOCKED |
| R-013 | Formal Codeowner and human WCAG/RTL/keyboard signoffs missing despite green automated CI | HIGH G3 | designated reviewers: produce traceable review and signoff | OPEN |
