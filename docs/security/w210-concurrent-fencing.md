# W2.10 — concurrent trust commit fencing (synthetic)

Baseline: W2.9 exact SHA `3318c087c60cae8c8f02770d0fbcaf8e5cb5ca75`.

An in-process fixture prepares a ticket against an exact W2.8 authority epoch/head. Its final simulated commit rechecks the live authority head and current key-validity callback in the same synchronous test boundary; a changed epoch, revoked role, outage or missing ticket denies and never records a synthetic commit. Tickets are single-use and cleared upon restart. Any positive result explicitly carries `canGrantPermission:false`.

**Security limits:** Event-loop serialization is not a distributed transaction. The authority can change after the synthetic commit returns; real safety requires co-locating revocation ordering and the actual effect in a linearizable transactional domain or a correctly enforced fencing token. This fixture provides no cross-process synchronization, real durable log, replica coordination, consensus, trusted external time or production access. It must not be connected to actual share transfers, payments or routes. Remain Draft, no Docker, PostgreSQL, OCI, merge or deploy.

Acceptance: exact-HEAD successful GitHub Actions, all preceding W2 tests green, eight W2.10 Node subtests, and six Docker/SQL/OCI steps skipped.