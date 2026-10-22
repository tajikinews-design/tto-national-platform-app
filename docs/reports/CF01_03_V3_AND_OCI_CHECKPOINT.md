# TTO CF01–03 and OCI checkpoint — 2026-10-22

## Result and provenance

Reference GitHub: `tajikinews-design/tto-national-platform`, immutable **15** originals, pinned `5eb6be8edfbb61f2eca740a42c30f572b493f023`. This report is in application feature branch `fix/cf01-03-logout-and-verification`, on top of PR #4 and without changing `main`.

**A later pre-existing v2 branch was found on inspection; no duplicate implementation was initiated.** Its earlier HTTP workflow initially failed `POST /v1/auth/logout` (400 vs 204, run 39767264468), later fixed in branch head `70405711...` and all its jobs became green. This follow-on PR #5 makes the test request framing explicitly carry an empty JSON body and independently passed again.

## Verified latest CI evidence (synthetic ephemeral tests only)

| Test | Evidence | Current status |
|---|---|---|
| Node 22, pnpm frozen lockfile, Next.js/Nest build & TypeScript | [39767709136](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709136) | PASS |
| PostgreSQL 17 RLS + CF01–03 v2/v3 domain test | [39767709208](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709208) | PASS |
| Nest real HTTP integration, including JIT/roles/doc/tenant/logout | [39767709294](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709294) | **19/19 HTTP cases PASS** |
| Four OCI Docker images built, three Next runtime smoke checks, API fails closed without DB | [39767709076](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709076) | PASS |
| Existing foundational tests | [39767709122](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709122) | PASS |
| Role/JIT/session and tenant lifecycle SQL tests | [39767709058](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709058) | PASS |

## Implementation slice

**CF-01:** OTP challenge HMAC verification and session issuance/revocation; stored role assignments, authority-referenced role granting/revoking and version checking; purpose-bounded JIT request/approval, independent approval, session security epoch, denial of unrestricted national access.

**CF-02:** tenant lifecycle transition rules, immutable tenant identifiers, controlled Party alias merge (without membership/share transfer), RLS and tenant selector constraints.

**CF-03:** file metadata, scanner attestation as separate restricted principal (not an actual AV engine), same-tenant document/file version validation, restricted document publication and legal hold with audited metadata, append-only audit access controls.

**Dependency reproducibility:** `pnpm-lock.yaml` committed and frozen install verified; OCI images are provider-independent and succeed in CI. **Docker image smoke on GitHub does not establish compatibility with a live ArvanCloud tenant/account.**

## Important remaining requirements (NOT COMPLETE)

- OTP provider integration, delivery receipts and production-grade anti-abuse/rate limits, session/role lifecycle coverage with independent security review.
- Object storage and real streamed upload, external antivirus/quarantine scanning, immutable published-document seal and durable audit/evidence pipeline under failure.
- Child-22 approved retention/legal hold disposition governance.
- Comprehensive test coverage across **all approved source acceptance tests**, especially concurrent Party merge, JIT escalation, external identity, retry and data retention rules.
- ArvanCloud actual access, registry, runtime variables/secrets, PostgreSQL backup/restore, S3 endpoint support and DNS remain **unverified**. All Production provisioning and deployment are **NOT AUTHORIZED**.
- Vercel protected internal Preview remains separate, NOT DEPLOYED.

## Next safe engineering gates

1. Independent security review of SQL security-definer functions, spoofable GUC assumptions, role bypass and immutable audit ownership; expand concurrency/authorization negatives.
2. Implement provider abstraction for OTP delivery, object storage and scanner attestation (real integrations only with credentials and approved providers), with synthetic fixtures in CI.
3. Implement measured failure tests for missing audit, held-file retention, concurrent login challenge verification.
4. Verify ArvanCloud *current* platform compatibility with authorized account/environment before claiming production readiness.
5. Keep all PRs in draft until reviewed, no merge or deployment.

**Honest phase status:** successful foundation evidence; overall CF01/02/03 remain **IN_PROGRESS**.
