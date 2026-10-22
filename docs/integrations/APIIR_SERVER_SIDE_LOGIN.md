# API.ir SMSOTP server-side issuance — security constraints

- Additive `0005_cf01_smsotp_login.sql` extends approved CF-01 challenge with verified mobile/ratelimit/delivery attestation.
- `POST /v1/auth/challenges/request` accepts `{mobile}` and produces a generic response for unknown numbers. Real delivery is performed **only on Nest server**, never in Next.js client.
- API.ir Bearer token is injected via `APIIR_TOKEN` secret env. `AUTH_CHALLENGE_HMAC_SECRET` is independent and must be >=32 bytes; no token, OTP, mobile or credential in GitHub.
- A `SMSOTP_LOGIN` challenge cannot be consumed before provider accepted SMS. Legacy `LOGIN` seeded test challenges remain supported only for backwards-compatible internal test; public issuance exclusively uses `SMSOTP_LOGIN`.
- OTP attempt count and per-verified-mobile 15-minute limit: 3; missing CF-04 `auth_policy` means deny.
- Real provider credentials and test receiver are not connected to the Nest runtime yet; live SMS delivery remains NOT_TESTED. In GitHub CI a `NODE_ENV=test` plus explicit `TTO_MOCK_SMSOTP_PROVIDER=true` enables local synthetic provider only.
- Running external HTTP inside a DB transaction is intentionally avoided; pending challenge created and provider acceptance attested separately. If provider succeeds but DB update fails, session remains deny-by-default and retry requires a fresh challenge.
- Pending future production hardening: independent mobile enrollment/ownership verification, resilient asynchronous outbox (currently synchronous API.ir send), IP/device and cross-user throttling, national identity checks, HTTP body/content and cache controls, carrier receipts, telemetry without PII, and security review.
