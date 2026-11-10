# NAV02 Operational Data Path R1 — 2026-11-10

## Goal and constraints
Real, owner-authorized input for membership applications, with legally distinct
membership, shareholding, and voting. Data shall never be silently restricted to
fictional identities. The old temporary commerce-demo DB naming is **not** a
legal membership register and shall be replaced via a separate CHILD06 cutover.

Legally effective member admission, financial share transfers, voting and
formal governance require separate authority and evidence acceptance; an
application record alone grants none of these legal entitlements.

## Verified state before intervention
- Shared Supabase project `zkfwsgrgslxxlusxrwce` is PG17 and already had
  one encrypted profile/draft and a private quarantined photo. Provenance of
  that record was not independently established. DO NOT erase or rewrite it.
- The same database did not yet contain `nav02_member_number_registry`,
  `nav02_member_collections`, or `commerce_demo_nav02_management_audit`
  at the beginning of R1.
- Vercel's API Preview had no member-production-specific Shahkar/number
  variables on the current branch and used an older code revision.
- Source-specific emergency preview gates were preventing any real applicant
  registration, even with an authorized verified identity provider.

## Changes introduced in source
- Member registration is validated for 10-digit Iranian national-code checksum,
  real 11-digit mobile and at least one legally required county relationship.
  Shahkar is queried server-to-server and **must** explicitly return match.
  Missing token/provider errors are fail-closed, not false mismatch.
- Unrelated mock-data environment flags are no longer required on NAV02
  member intake; the encryption key, authenticated session, tenant owner
  check, protected database RPC and Shahkar integration remain mandatory.
- Full member-application edit read/submit API: owner-scoped encrypted
  envelope, no-store and same-origin BFF, optimistic record_version,
  audit function, registration status preserved. National ID is immutable
  here; a change requires a separately verified reidentification workflow.
  Mobile change demands Shahkar re-match.
- Protected collection and immutable numbering registry source contracts
  from preceding commits are retained. The server rejects missing schema
  rather than handing out fake membership numbers.
- No production entitlements are granted by entering personal data.
- Identity data is never written in plaintext columns; database profile
  encryption and owner-scoped read functions are retained.

## Legality to verify with project counsel
Iran Electronic Commerce Act Articles 58-59: explicit purpose, minimization,
accuracy, access/correction and qualified erasure requests. Source:
https://www.wipo.int/wipolex/en/legislation/details/7711

The cooperative's charter, CHILD06 membership decision rule and authority
records govern acceptance. CHILD07 governs ownership ledger and legal share
transfer. Neither is inferred from administrative registration.

## Release/acceptance gates — no fabricated GREEN
1. Disposition/retention policy and legal basis for real personal-data intake.
2. Back up existing DB and apply numbered migrations 9999w/x/y (plus secure
   attachment schema if approved) on the intended database; verify retained
   encrypted record, owner isolation, rollback and role grants.
3. Configure the reviewed API release with all secret-bearing provider,
   database and encryption credentials **without placing secrets in Git**.
4. Run PostgreSQL17, app build, HTTP owner/session/tenant cross-scope tests.
5. Run a **consented real** Shahkar check using the owner-authorized flow.
   Do not invent an Iranian identity or mobile number for test claims.
6. Verify full create/read/edit/member number/collection/archive/restore
   operations with lawful consent, audited actions, and bounded retention.
7. Roll out CHILD06 + CHILD07 and remaining business modules individually
   with their own testable acceptance evidence.
8. Production deployment only after verified app/database/environment parity.
   This document does not authorize turning off encryption, role checks,
   membership qualification, financial controls or audit retention.

## Scope/status
Code changes: PR #183 (Draft). CI, SQL and protected Preview evidence shall
be attached to this PR. This source change is **not** proof that the older
deployed API has received the new code or that existing historical member
records are legally admitted. No real data or Production schema has been
modified as part of the initial source patch.
