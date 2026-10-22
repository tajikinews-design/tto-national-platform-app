# ArvanCloud portable deployment design — NOT DEPLOYED

This directory is an **unapplied Kubernetes/CaaS review template**, not proof of access to ArvanCloud, deployment or a completed production compatibility assessment.

## Scope

- 4 OCI images: 3 Next.js 16 Node runtimes, 1 NestJS 11 Fastify API.
- Registry host `registry.example.invalid` and image tag `REPLACE_WITH_APPROVED_DIGEST` are deliberately unusable placeholders. No image has been pushed to an ArvanCloud registry.
- Kubernetes Deployment/Service manifests express only portable core `apps/v1` and `v1` resources. An account-specific deployment may use an approved ArvanCloud service product or managed Kubernetes features; test the actual APIs/quotas before deployment.
- No ingress, public endpoints, namespaced secrets, storage credentials or production data are supplied. No cluster changes are authorized.
- API secret references `tto-api-runtime.database-url` and `challenge-hmac-secret` are **names only**, no values committed. Provision via approved secrets management after explicit written owner approval.
- `/health` checks the Nest process, while `/ready` checks the nonprivileged PostgreSQL connection. Neither proves business authorization nor upstream OTP/scanner/object-storage availability.
- App containers use default `node` user (non-root) and do not need Kubernetes service-account tokens.
- Profiles/probe timings/resources are initial assumptions, **not ArvanCloud-verified sizing**.

## Evidence already available

- GitHub Actions built all 4 OCI Docker images and smoke-tested all three Next.js HTTP responses and API safe startup without database credentials: run [39767709076](https://github.com/tajikinews-design/tto-national-platform-app/actions/runs/39767709076).
- PostgreSQL 17 SQL/tenant isolation and real Nest HTTP workflows validated on isolated ephemeral GitHub runners.

## Before `PRODUCTION_COMPATIBILITY=GREEN`

1. Check ArvanCloud account/project and available CaaS/managed Kubernetes product, namespace, registry/image-pull/ingress, legal location and regional DNS.
2. Confirm OCI registry supports digest-pinned images and pull policy; verify VPC/network routing to PostgreSQL and S3-compatible storage.
3. Verify configuration/secret injection, pod security admission, nonroot UID, ephemeral disk and quotas.
4. Implement real object storage and AV scanning, upload size ceilings, evidence versioning and durable audit failure behavior.
5. Establish independent database backups, restore exercises, RPO/RTO and migration rollback with documented test evidence.
6. Execute a **non-production** account-specific dry-run only with explicit authorization; record tool versions, CLI output, deployment SHA and rollback.
7. Separate owner's written Production approval needed for any live infrastructure, domain, customer data or commerce.
