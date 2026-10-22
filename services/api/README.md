# CF-01/02/03 initial NestJS 11 API

Implemented: session-token hash resolution with server-side security epoch and revocation; transaction-local actor and Tenant GUCs; database safe-role assertion; authenticated tenant context and document metadata reads under RLS.

Not implemented: login/OTP issuance, JIT, legal authorization, uploads/virus scan/download, evidence sealing, retention policy or full audit pipeline. No real data or seeded tokens are included. These unfinished operations must fail closed.

Run with DATABASE_URL of a separate tto_app role (non-owner, no BYPASSRLS). Never connect this service as postgres/superuser. Health endpoint does not prove database success. Route GET /v1/tenants/:tenantId/context and /documents require a valid Bearer session issued by a future approved auth workflow.
