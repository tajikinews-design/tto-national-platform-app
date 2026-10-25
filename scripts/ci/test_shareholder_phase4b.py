"""Phase 4B - offline session privacy regression guards.

These source-contract checks run inside the existing disposable Docker Release
suite. They are not a substitute for authenticated browser/E2E observations.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
LOGIN=ROOT/"packages/ui/src/otp-login.tsx"
WORKSPACE=ROOT/"packages/ui/src/shareholder-workspace.tsx"
READ=ROOT/"packages/ui/src/shareholder-read-models.tsx"
API=ROOT/"apps/shareholder/app/api/auth/session/route.ts"
REPORT=ROOT/"docs/reports/SHAREHOLDER_SESSION_PRIVACY_PHASE4B_2026-10-25.md"

class SessionPrivacyPhase4B(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.login=LOGIN.read_text(encoding="utf-8")
        cls.workspace=WORKSPACE.read_text(encoding="utf-8")
        cls.read=READ.read_text(encoding="utf-8")
        cls.api=API.read_text(encoding="utf-8")

    def test_periodic_revalidation_only_for_authenticated_shareholder(self):
        for expected in (
            'if(!enabled||!verified||surface!=="shareholder")return;',
            'fetch("/api/auth/session"',
            'method:"GET",credentials:"same-origin",cache:"no-store"',
            'window.setInterval(()=>{void revalidate();},60000)',
            'window.addEventListener("focus",onFocus)',
            'document.addEventListener("visibilitychange",onVisible)',
            'document.visibilityState!=="visible"',
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected,self.login)

    def test_poll_cleanup_does_not_leak_listeners_or_stale_fetches(self):
        for expected in ('let active=true','let inFlight=false',
                         'controller?.abort()','window.clearInterval(periodic)',
                         'window.removeEventListener("focus",onFocus)',
                         'document.removeEventListener("visibilitychange",onVisible)',
                         'if(!active||next.signal.aborted)return'):
            with self.subTest(expected=expected):
                self.assertIn(expected,self.login)
        self.assertIn('[enabled,verified,surface,invalidateSession]',self.login)

    def test_client_only_accepts_explicit_authenticated_boolean(self):
        self.assertIn('typeof (data as {authenticated?:unknown}).authenticated!=="boolean"',self.login)
        self.assertIn('(data as {authenticated:boolean}).authenticated!==true',self.login)
        self.assertIn('if(!response.ok)throw Error("SESSION_CHECK_UNAVAILABLE")',self.login)
        self.assertIn('setVerified(false);setCheckFailed(true)',self.login)
        self.assertIn('invalidateSession()',self.login)

    def test_session_loss_unmounts_private_workspace(self):
        self.assertIn('const invalidateSession=useCallback',self.login)
        self.assertIn('setVerified(false);setCheckFailed(false)',self.login)
        self.assertIn('onSessionInvalidated={invalidateSession}',self.login)
        self.assertIn('verified?<div>',self.login)
        self.assertIn('setRequestId("");setCode("")',self.login)

    def test_all_owner_reads_401_invalidate_parent(self):
        self.assertIn('if(response.status===401)throw Error("SESSION_EXPIRED")',self.workspace)
        self.assertIn('if(error instanceof Error&&error.message==="SESSION_EXPIRED")onSessionInvalidated?.()',self.workspace)
        self.assertIn('if(error instanceof Error&&error.message==="SESSION_EXPIRED"){',self.workspace)
        self.assertIn('onSessionInvalidated?.();return;',self.workspace)
        self.assertIn('if(response.status===401){',self.read)
        self.assertIn('if(!controller.signal.aborted)onSessionInvalidated?.()',self.read)
        self.assertIn('onSessionInvalidated={onSessionInvalidated}',self.workspace)

    def test_other_scopes_and_source_rules_are_unchanged(self):
        for marker in ('result.tenantContextVerified!==true',
                       'result.tenantId!==tenantId',
                       'pending.current?.abort()','sequence.current===generation',
                       'return "—"','ناموجود به معنی صفر نیست',
                       'if(view==="section")return;', 'پرداخت مستقیم خریدار به فروشنده'):
            with self.subTest(marker=marker):
                self.assertIn(marker,self.workspace)
        self.assertIn('domain="trade-requests"',self.workspace)
        self.assertIn('domain="notices"',self.workspace)

    def test_server_authority_remains_pg_backed_and_nostore(self):
        for marker in ('/v1/auth/session', 'upstream.status===401',
                       'cache:"no-store"', 'redirect:"error"',
                       'AbortSignal.timeout(9500)', 'authenticated:true',
                       'Cache-Control','Vary'):
            self.assertIn(marker,self.api)

    def test_no_credential_or_authorization_shortcut_added_to_client(self):
        for client in (self.login,self.workspace,self.read):
            for forbidden in ('document.cookie','localStorage','sessionStorage',
                              'dangerouslySetInnerHTML','process.env.APIIR'):
                self.assertNotIn(forbidden,client)
        self.assertNotIn('Authorization:',self.login)
        self.assertNotIn('Authorization:',self.workspace)
        self.assertNotIn('Authorization:',self.read)

    def test_review_checkpoint_is_present(self):
        self.assertTrue(REPORT.is_file())
        self.assertIn('PENDING_LOCAL_DOCKER',REPORT.read_text(encoding="utf-8"))

if __name__=="__main__":
    unittest.main()
