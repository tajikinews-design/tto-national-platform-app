# TTO — CF02 from Child06 relationship source event (Issue #154)

**Immutable authoritative source:** `TTO-CORE-TENANT-PARTY-IMPLEMENTATION` (CF02), `TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION` (Child06), frozen source repository SHA `5eb6be8edfbb61f2eca740a42c30f572b493f023`. Source map `docs/architecture/PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json`. Starting development PH05 head `07bc750f16904260d869682ddf3793abd57fa007` (PRs #144, #146, #153 merged, postmerge CI GREEN). **No change to original requirements or original seven MEMBER-AT tests.**

## Exact scope
This is the **disposable CF02 projection laboratory**, not an operational consumer. Original Child06 source-of-truth `cooperative_relationships` emits immutable local `MEMBERSHIP_APPROVED` event `(event_id,tenant_id,party_id,relationship_id,source_version)`. CF02 owns **only** `relationship_projections`. Migration `0023` supplies source validation and strict monotonic projection using a dedicated migration-owner-only SQL function; NO app-server `tto_app` execute permission and NO outbox publisher, listener or worker. No runtime endpoint or elevated API route added.

## Fail-closed acceptance properties
- Actor/tenant from transaction-local test context, must be a scoped `DOCUMENT_REVIEWER` with independent approved authorization, published CF03 evidence, enabled and unexpired CF04 rule gate (**disabled by default**). No production authority asserted by a synthetic gate.
- Read immutable Child06 source event, independently cross-validate the Child06 relationship and approved source application, tenant, Party, version and reviewed evidence. Actor may not be source applicant, decider or activator.
- Lock Party row (matching Child06 activation lock order) and CF02 target; create only version 1 for a new source projection; existing entries cannot be blindly replaced. Replays match exact `source_event_id`, version and status with unique immutable receipt. Reject unknown, cross-tenant, stale, conflicting, version gap, legacy imported source conflicts or existing active membership instead of auto-merging.
- One immutable receipt + one audit event on successful projection. Direct `tto_app` execute and direct CRUD remain revoked. No CF01 MEMBER role assignment, `member_source_snapshots`, shareholder account, shares, votes, payments, transfers or other projections created.
- Tests run only on disposable PG17 with synthetic actors/evidence and optional 4 OCI build smoke; no actual membership activation or external event delivery.

## Integration and acceptance gates
- Technical migration and source-consumer tests may be GREEN **only when exact SHA CI succeeds**. Any unexecuted subset remains PENDING.
- `MEMBER-AT-001..007` and `SHARE-AT-001..008` remain **NOT_RUN**. This projection alone does not satisfy source-approved membership import, account role activation, or legal acceptance.
- Dependent pre-MEMBER cooperative invitation contract [Issue #150](https://github.com/tajikinews-design/tto-national-platform-app/issues/150) remains design-only; no fake membership role or public tenant enumeration.
- Child07 [PR #143](https://github.com/tajikinews-design/tto-national-platform-app/pull/143) now has `mergeable=false` against latest PH05; migration 0020 and 0021–0023 require exact conflict analysis/rebase and all SQL/source tests before merging; **never force-merge**.
- NO main merge, registry push, manual deployment, real data import or actual share operations.
