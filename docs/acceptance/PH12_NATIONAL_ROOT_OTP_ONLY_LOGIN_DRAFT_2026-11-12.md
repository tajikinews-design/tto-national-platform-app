# PH12 National-root OTP-only login — Preview candidate
Status: DRAFT / NOT ACTIVATED (2026-11-12).

Owner requirement: everyday national-root login via OTP to an already verified number, with no password. No real phone, national ID, SMS code, signing key, or credential is committed.

Implemented code:
- National login UI uses mobile + six-digit OTP instead of the disabled OTP tab.
- Protected same-origin request calls the pre-existing /v1/auth/challenges/request endpoint and its provider/SQL abuse controls.
- Verification calls /v1/auth/challenges/verify, then MUST revalidate the freshly issued token against the independent /v1/national/root/session endpoint.
- Cookie is set only for a DB-backed authenticated national root with mustChangeCredentials=false. No ordinary account OTP becomes a national administrator.
- Cookie is Secure, HttpOnly, SameSite=Lax and restricted to 900 seconds.
- Feature switch TTO_NATIONAL_ROOT_OTP_LOGIN_ENABLED=true is required, and protected Preview environment is mandatory.

Blocking work:
1. Test OTP issuance/consumption on disposable PG17 for EXISTING national root, including the isolated-demo proof write. Do not skip the root role check if it fails.
2. Verify and bind the owner's phone via private independent PH12 authority/OTP ceremony, not by a static allowlist or self-declaration.
3. Run exact-head CI plus authenticated browser UAT, wrong-user denial, replay/expiry, sessions/logout.
4. Independently authorize backup and Preview-only DB migrations. No real account, hosted DB, or Vercel configuration is changed here.
5. Draft only: no merge, production deploy, SSO weakening, finances, share transfers, or legal acceptance.
