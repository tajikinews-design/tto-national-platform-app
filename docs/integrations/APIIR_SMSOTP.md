# API.ir SmsOTP integration — provider contract (not live-sent)

Source: https://s.api.ir/scalar/v1#tag/.../POST/api/sw1/smsotp and API.ir official Python SDK. Endpoint: `POST https://s.api.ir/api/sw1/SmsOTP`. Header `Authorization: Bearer ${APIIR_TOKEN}`; JSON `{code,mobile,template}`. Template defaults to `1`. **Never put the token, OTP, or subscriber phone in GitHub.**

- Adapter: `services/workers/src/apiir-smsotp.cjs`. Tests: `services/workers/test/apiir-smsotp.test.cjs`.
- Tests use offline fake fetch and synthetic numbers; no real SMS, charged API calls or customer data.
- Provider `success:true` is accepted for submission, not verified delivery. Real delivery and provider balance/throughput require separate controlled testing.
- User-facing challenge issuance is intentionally disabled in Nest API. **Before enabling**: implement authenticated/anti-enumeration challenge creation, authorized identifier binding, hashed verifier storage, multi-level throttling, delivery receipts, idempotent queue retries, trusted mobile verification, expiration and fraud telemetry; use CF-01 legal/role policies.
- Configure `APIIR_TOKEN` as secret manager value only; no .env commit, no CI log.
- Real external call is **NOT_TESTED** because no authorized API.ir credentials or approved destination number are connected. Provider fake test does not satisfy live connectivity.
