"""Phase4C actual Next↔Nest↔PG17↔Chromium security gate: static contracts only.
The real browser test is mandatory inside Docker Release and remains unverified
until its exact source SHA is observed in a Docker Desktop transcript.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
E2E=ROOT/"scripts/e2e-phase4c-real-session-browser.cjs"
RUNNER=ROOT/"scripts/ci/run-local-docker.ps1"
API=ROOT/"services/api/src/module.ts"
SESSION=ROOT/"apps/shareholder/app/api/auth/session/route.ts"
REPORT=ROOT/"docs/reports/SHAREHOLDER_LIVE_SESSION_PHASE4C_2026-10-26.md"

class LiveSessionPhase4C(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.e=E2E.read_text(encoding="utf-8")
        cls.r=RUNNER.read_text(encoding="utf-8-sig")
        cls.api=API.read_text(encoding="utf-8")
        cls.session=SESSION.read_text(encoding="utf-8")

    def test_real_browser_has_no_http_intercept(self):
        for invalid in ('context.route(', 'page.route(', 'route.fulfill(',
                        'realOtpProviderUsed:true', 'realSourcesApproved:true',
                        'APIIR_TOKEN=real', 'prod.supabase.com', 'VERCEL=1'):
            with self.subTest(forbidden=invalid):
                self.assertNotIn(invalid,self.e)
        for marker in ('browserNetworkMocking:false',
                       'realNextNestPostgres:true',
                       'syntheticActorsOnly:true',
                       'realOtpProviderUsed:false',
                       'realSourcesApproved:false',
                       'PHASE4C_DISPOSABLE_LOCAL_POSTGRES_ONLY',
                       'PHASE4C_EXTERNAL_SERVICE_ENV_FORBIDDEN'):
            self.assertIn(marker,self.e)

    def test_session_is_actual_db_session_not_locally_faked(self):
        for marker in ('tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)',
                       'createHash("sha256").update(token).digest()',
                       'await fetch(API+"/v1/auth/session"',
                       'await DB.connect()',
                       'await browser.newContext',
                       'context.addCookies',
                       'await page.goto(APP+"/modules/nav-04"',
                       'await page.evaluate(()=>window.dispatchEvent(new Event("focus")))',
                       'await page.locator("section.sw").waitFor({state:"detached"',
                       'await checkDead(s.token,'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.e)

    def test_four_real_security_transitions(self):
        for marker in ('real-out-of-band-revocation',
                       'UPDATE tto.user_sessions SET revoked_at=clock_timestamp()',
                       'real-database-expiration',
                       "expires_at=clock_timestamp()-interval '1 second'",
                       'security-epoch-revocation',
                       'security_epoch=security_epoch+1',
                       'real-session-logout-through-BFF',
                       'SELECT revoked_at IS NOT NULL AS revoked',
                       'browser-OTP-mock-provider-creates-real-PG-session',
                       'real Next verify delivered a Secure HttpOnly SameSite=Lax cookie',
                       'TTO_ENABLE_REAL_SMSOTP_DELIVERY:"false"',
                       'results.length===5&&passed===5'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.e)

    def test_expiry_and_revocation_close_all_owner_routes(self):
        for marker in ('/api/auth/session', '/api/me/tenant-options',
                       '/api/tenants/"+TENANT+"/context',
                       '/me/member-record','/me/shareholding',
                       '"trade-requests","notices"',
                       'label+" membership blocked"',
                       'label+" shareholding blocked"',
                       'label+" Nest rejects revoked bearer"',
                       'label+" tenant B denied"',
                       'no token in discovery',
                       'no owner PII in SSR'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.e)
        self.assertIn('/v1/auth/session',self.api)
        self.assertIn('tto.resolve_session',self.api)
        self.assertIn('cache:"no-store"',self.session)
        self.assertIn('if(upstream.status===401)return noSession(true)',self.session)

    def test_runner_has_no_host_db_and_only_release_integration(self):
        for marker in ('if ($Suite -eq "Release")',
                       'Phase4C real Chromium Next Nest PG17 session revoke/expiry E2E',
                       '"--network", ("container:" + $pgContainer)',
                       '"--security-opt", "no-new-privileges"',
                       'TEST_ADMIN_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/tto',
                       'TTO_PHASE4C_EXPECTED_SOURCE_SHA',
                       'mcr.microsoft.com/playwright:v1.56.1-noble',
                       'e2e-phase4c-real-session-browser.cjs',
                       '"--network", "none"', 'TTO_LOCAL_TEMP_CONTAINERS_AND_VOLUME_REMOVED=true'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.r)
        for invalid in ('docker compose','docker system prune',
                        '-e DATABASE_URL=postgresql://postgres@',
                        'https://api.supabase.com'):
            self.assertNotIn(invalid,self.r.lower())

    def test_document_requires_runtime_evidence(self):
        self.assertTrue(REPORT.exists())
        doc=REPORT.read_text(encoding="utf-8")
        self.assertIn("PENDING_LOCAL_DOCKER_RELEASE",doc)
        self.assertIn("REAL_OTP_PROVIDER_NOT_TESTED",doc)
        self.assertIn("NO_PRODUCTION_DATA",doc)

if __name__=="__main__":
    unittest.main()
