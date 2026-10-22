# ArvanCloud Production compatibility — design/dry-run only (NOT DEPLOYED)

Decision: Owner explicitly requires all eventual Production to be on ArvanCloud, separate from Vercel Hobby synthetic internal preview. Current work **only creates portable OCI images**, no cloud connection or secrets.

## Portable build evidence

- Three separate Next.js 16 Docker images, one NestJS 11/Fastify API image, pinned `pnpm-lock.yaml` and Docker build CI.
- Docker images have explicit NODE_ENV/PORT, nonroot runtime user, independent environment injection, no Vercel environment-specific runtime features.
- Each runtime must be tested with an isolated PostgreSQL 17 database, injected runtime secrets, an approved S3-compatible bucket and a scanner before Production release.

## Arvan account validation still required

- Official active region/CaaS cluster and resource quotas, image registry credentials and reachability, network/IAM constraints, container health probes/ingress/TLS/rollbacks and horizontal scaling, object-store API, PostgreSQL backup encryption/restore, legal data locality.
- Current publicly available ArvanCloud PaaS example repo is archived and not authoritative to current account capabilities: https://github.com/arvancloud/paas-examples
- No live ArvanCloud APIs called and no Production environment/provisioning/migration/rollout authorized. OCI build success alone proves only a portable image build, not successful operation on ArvanCloud.

## Approved future production safety gate

Require a separate owner-approved cloud access scope, explicit dry-run manifest and secret policy, private image registry, zero real-data migration until restore tests pass, and manual authorization for every Production deployment. No Deployment workflow/action exists in this repository.
