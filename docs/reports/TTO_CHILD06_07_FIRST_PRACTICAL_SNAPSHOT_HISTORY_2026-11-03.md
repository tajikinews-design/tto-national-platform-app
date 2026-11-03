# Child06/Child07 — first practical same-source snapshot history (2026-11-03)
**Baseline:** PH05 approved dev SHA `f65d7c5a67d833e521a2a4fbcc7b46592627d17d`; immutable normative TTO source SHA `5eb6be8edfbb61f2eca740a42c30f572b493f023`.

## Already present and intentionally reused
Child06 source-approved member self-service and Child07 latest shareholding owner-only GET; independent CF02 identity linking and tenant isolation; two private source approvals; append-only imported holding snapshot table with versions. The existing snapshot table is **not** Child07's canonical share transfer/ownership ledger. We **did not** create duplicate record screens, membership approval commands, trading services or a second ledger.

## This small practical read-only increment
- A new SECURITY DEFINER PostgreSQL history read function (migration 0020) calls existing `my_shareholding_from_source` and fails closed without currently authorized latest holdings. Only actor-linked tenant/account, currently approved Child07 `source_ref`, <=20 newest imported snapshot versions and nonfuture timestamps; no raw party identifiers or ledger-entry UUIDs exposed.
- Nest owner-only GET using verified revocable session and transaction-local identity/tenant, Next BFF GET using HttpOnly cookie, schema validation and no-store. Any malformed, denied or missing source is unavailable, **never an invented zero**.
- Existing Persian RTL record page gains explicitly labelled *verified source snapshot versions* list; this is **not** trade, transfer or legal ledger history. UI compares current and history latest source quantities/versions, aborts stale responses, and keeps exact-tenant render guard.
- E2E tests for absence, verified first 37 shares, second **sourced zero**, tenant mismatch, forged browser Authorization, source revocation/expiry and loss of Child06 approval. PG17 app role remains unable to access the private raw tables.

## Acceptance
Engineering tests are source-gated, disposable PG17 synthetic only. The 7 Child06 and 8 Child07 original legal acceptance identifiers remain **NOT_RUN**. No real provider/source approvals, external counsel acceptance, actual membership activation, transfer, money movement, share trading, production migration or Deploy. This slice DOES NOT implement Child06's `SubmitMembershipApplication`/`RecordMembershipDecision`, Child07 `FinalizeTransfer`, or a canonical ledger. Those require separate approved design and acceptance.
