"""Phase-2 source-gated read models: reviewable, offline safety contracts."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
UI=(ROOT/"packages/ui/src/shareholder-workspace.tsx").read_text(encoding="utf-8")
READ=(ROOT/"packages/ui/src/shareholder-read-models.tsx").read_text(encoding="utf-8")
NEST=(ROOT/"services/api/src/module.ts").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")

class SourceGatedReadModelsTests(unittest.TestCase):
    def test_bff_deny_default_even_with_opaque_cookie(self):
        for domain in ("trade-requests", "notices"):
            with self.subTest(domain=domain):
                route=(ROOT/f"apps/shareholder/app/api/tenants/[tenantId]/me/{domain}/route.ts").read_text(encoding="utf-8")
                for marker in (
                    'export async function GET(', 'UUID.test(tenantId)',
                    'request.cookies.get("tto_session")?.value',
                    'TOKEN.test(token)', 'deny(401,"SESSION_REQUIRED")',
                    'verifySessionTenantForClosedRead(request,tenantId,token)',
                    'return deny(rejected.status,rejected.code)',
                    '"Cache-Control":"private, no-store"', '"Vary":"Cookie"',
                    '"X-Content-Type-Options":"nosniff"'
                ):
                    self.assertIn(marker,route)
                self.assertLess(route.index('request.cookies.get'),route.index('verifySessionTenantForClosedRead(request,'))
                for prohibited in ('process.env.', 'request.headers.get("authorization")',
                                   'fetch(', 'items:[]', 'available:true', 'POST(', 'wallet'):
                    self.assertNotIn(prohibited,route)

    def test_candidate_gate_checks_revocable_nest_session_without_source_activation(self):
        gate=(ROOT/"apps/shareholder/lib/source-read-access.ts").read_text(encoding="utf-8")
        for token in (
            '"/v1/tenants/"+tenantId+"/context"', 'Authorization:`Bearer ${token}`',
            'trustedBackendHeaders(request)', 'response.status===401',
            'response.status===403||response.status===404',
            'response.status!==200', 'scoped.tenant_id!==tenantId',
            'scoped.status!=="ACTIVE"', 'return DENIED',
            'return UNAVAILABLE', 'cache:"no-store"', 'redirect:"error"',
            'AbortSignal.timeout(9500)', 'LOOPBACK.test(base??"")'
        ):
            with self.subTest(token=token):self.assertIn(token,gate)
        for prohibited in ("available:true", "walletBalance", "process.env.TTO_ENABLE",
                           "request.headers.get(\"authorization\")", "sourceDomain"):
            self.assertNotIn(prohibited,gate)

    def test_nest_candidate_routes_never_emit_data(self):
        for method,path in (
            ("ownTradeRequests", "tenants/:tenantId/me/trade-requests"),
            ("ownPublishedNotices", "tenants/:tenantId/me/notices")
        ):
            with self.subTest(path=path):
                self.assertIn(f'@Get("{path}")',NEST)
                head=NEST.index(f'async {method}(')
                body=NEST[head:NEST.index("  }",head)]
                self.assertIn('await this.db.sessionActor(auth)',body)
                self.assertIn('throw new ForbiddenException("Source or permission not approved")',body)
                self.assertNotIn('return {items:',body)
                self.assertIn('new ParseUUIDPipe()',body)

    def test_ui_lists_require_verified_source_and_classified_records(self):
        for marker in (
            'domain==="trade-requests"?"CHILD07":"CHILD09"',
            'v.available!==true','v.approvalRef','UUID.test(v.approvalRef)',
            'VERSION(v.sourceVersion)','ISO(v.sourceAsOf)',
            'v.items.length>20','ids.has(id)','isTrade(item)','isNotice(item)',
            'v.audienceApproved===true','VERSION(v.publicationVersion)',
            'VERSION(v.eventVersion)', 'response.status===401',
            'response.status===403||response.status===404',
            'tenantId===result.tenantId','controller.signal.aborted',
            'credentials:"same-origin"','cache:"no-store"',
            'status:"verified"', 'result.items.length===0',
            'فهرست خالی را به‌صورت صریح', 'ثبت‌شده در مرجع',
            'نتیجه حقوقی معامله', 'role="status"',
        ):
            with self.subTest(marker=marker):self.assertIn(marker,READ)
        for bad in ('localStorage','sessionStorage','document.cookie',
                    'Authorization:','method:"POST"', 'dangerouslySetInnerHTML',
                    'Math.random()', 'fakeOrders', 'shareQuantity:"0"'):
            self.assertNotIn(bad,READ)

    def test_ui_mounts_separate_gates_only_when_scope_verified(self):
        self.assertIn('import {ShareholderReadModels}',UI)
        self.assertIn('tenantId={verified?selected:""} domain="trade-requests"',UI)
        self.assertIn('tenantId={verified?selected:""} domain="notices"',UI)
        self.assertIn('ثبت و پیگیری غیرفعال',UI)
        self.assertIn('هیچ سفارش',UI)
        self.assertIn('کیف پول نقدی',UI)
        self.assertIn('مرجع ثبت و پیگیری هنوز متصل نیست',UI)

    def test_runtime_and_prebuild_cover_new_routes(self):
        self.assertIn('"packages/ui/src/shareholder-read-models.tsx"',PARSER)
        self.assertIn('["trade-requests","notices"]',SMOKE)
        self.assertIn('disabled.code!=="SOURCE_OR_PERMISSION_NOT_APPROVED"',SMOKE)
        self.assertIn('spoofed.status!==401',SMOKE)
        self.assertIn('cookie.status!==403',SMOKE)
        self.assertIn('malformed.status!==400',SMOKE)

if __name__=="__main__":
    unittest.main()
