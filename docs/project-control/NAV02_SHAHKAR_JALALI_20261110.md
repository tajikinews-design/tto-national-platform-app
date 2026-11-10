# NAV02: Shahkar + Jalali and stable Vercel preview — 2026-11-10

Draft PR183 incremental changes. No real identity calls or personal data migrations performed.

**Shahkar**: Official api.ir OpenAPI https://s.api.ir/json specifies POST
`https://s.api.ir/api/sw1/Shahkar` with JSON `{nationalCode,mobile,isCompany:false}`
and authorized Bearer token. `{success:true,data:true}` = match;
`{success:true,data:false}` = mismatch; all other shapes/statuses must fail closed.
Do not show success UI or expose the provider's raw response. Real query occurs
strictly on API server inside membership save's tenant-authorized database transaction
AFTER the secure insert/ownership check, and failure rolls back the insert.
Never infer legal membership or voting rights from a match.

**Release gates**: `TTO_NAV02_SHAHKAR_ENABLED=true`,
`TTO_NAV02_MEMBER_INTAKE_ENABLED=true`, `TTO_NAV02_REAL_PII_ENABLED=true`,
`APIIR_TOKEN` with correct provider scope, valid session/tenant ownership, legal
purpose, data retention/security/privacy approvals. Not enabled in this PR.
Do not send real person data to Preview until independently authorized.
Service outage/permission error blocks registration (no false mismatch).
Do not store raw responses, identifiers or authorization secrets in logs.

**Dates**: Member birth-date UI is Persian/Jalali using ICU Intl for month
lengths and leap-year logic, persisted as YYYY/MM/DD in encrypted profile.
Explicit 2-column date+birthplace row with CSS grid. Capital payment date
in the separate shares workflow has unchanged storage contract.

**Vercel**: Branch alias
`https://tto-cooperative-preview-git-feat-nav02-m-0b1196-tajikinews-6739.vercel.app`
is fixed per Git branch and follows each successful branch deployment. Keep
Vercel SSO protection intact. Active same-origin login session remains
until its server-enforced expiry; refresh is enough for newly deployed UI.
Neither production nor main is changed.
