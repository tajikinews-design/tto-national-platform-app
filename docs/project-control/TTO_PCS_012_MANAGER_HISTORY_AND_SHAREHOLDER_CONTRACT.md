# TTO-PCS-012 — Manager review history and next shareholder admission contract
Date 2026-11-01. Scope: CI-only fictional source acceptance, no live membership, share register, transfer, sale or funds.
## Code and verified surfaces to assess
Draft app PR #103 descends from #101. Nest manager-only GET returns last 30 fictional audit records with review ID, fixture reference, status, recorded time, sourced from disposable PostgreSQL 17, scoped to verified manager/tenant and protected by role checks; the Next BFF allowlists response fields and forwards the server-side session. A Persian RTL screen shows status, event reference and time. CI is configured to open that screen with real Chromium at 390 and 1440 pixels, post an approval and refresh the history from Nest+PG. Exact-head CI must be checked before declaring this complete.

## Independent Child06 and Child07 source contract — NOT AUTHORIZED YET
- Preconditions: project owner accepts the consolidated baseline and a specific pilot cooperative; official data stewards and legal reviewer separately approve membership and share-register access. Product approval does NOT confer data access.
- Identity: user session authenticated through Nest/Postgres, explicit Party link with verifiable evidence, active tenant authorization, strict own-only policy. A COOPERATIVE_MANAGER role by itself must never imply ownership or read access to an unrelated shareholder.
- Child06 membership: signed/attested official issuer and batch ID, member status, source event, positive source version, as-of/effective timestamps, source quarantine/validation + independent reviewer, immutable provenance and anti-replay.
- Child07 holdings: separate issuer/official share register, verified account/Party mapping, ledger version, entry reference, source as-of, nonnegative exact quantity and explicit zero only when an approved official ledger states zero. Membership cannot manufacture a holdings balance.
- Transaction path: read-only projections only; no share purchase, sale, ownership transfer, wallet or general cooperative accounting. Market process is a later separately gated Wave 3.
- Negative acceptance: no session, wrong actor, wrong tenant, copied cookie, forged Party/role headers, stale/revoked session, nonexistent ledger, expired source, version conflict, dual source inconsistency and audit write failure must deny or display UNAVAILABLE—not zero.
- UI: authenticated shareholder sees only own approved source information and distinct provenance; a mock fixture must never render in a production source panel.

## Remaining project gates
Wave-0 G3 owner acceptance still pending; Wave-1 test-only manager source review is not operational acceptance. Real Child06/Child07 source approval, manager delegation evidence, authenticated shareholder own read, full cross-portal journey and manual reviewer UX remain separate acceptance tasks. Do not silently merge or deploy.
