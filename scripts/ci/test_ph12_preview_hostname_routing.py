"""PREVIEW-only DNS-host routing test. No real customer, payment or DB writes."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def read(path):
 return (ROOT/path).read_text(encoding="utf-8")

class TestTtoHostRouting(unittest.TestCase):
 def test_main_domain_is_technical_test_portal_not_a_sales_site(self):
  proxy=read("apps/cooperative-management/proxy.ts")
  page=read("apps/cooperative-management/app/site/page.tsx")
  self.assertIn('const DOMAIN="ttoir.ir"',proxy)
  self.assertIn('new URL("/site",request.url)',proxy)
  self.assertIn('"development-test-only"',proxy)
  self.assertIn("PREVIEW-ONLY",proxy)
  self.assertIn("مرکز آزمون توسعه TTO",page)
  self.assertIn("فقط مسیرهای فنی را بررسی می‌کنیم",page)
  self.assertIn("بدون ثبت تجاری",page)
  self.assertIn("robots:{index:false,follow:false,noarchive:true}",page)
  self.assertNotIn("<PublicPlans",page)
  self.assertNotIn("قیمت‌گذاری",page)
 def test_wildcard_role_bound_routes_fail_closed(self):
  proxy=read("apps/cooperative-management/proxy.ts")
  for name in ["RESERVED","SLUG.test(slug)","SAFE_LOGIN_APIS","CONTEXT_API",
               'path==="/c/"+slug','return unavailable(request)',
               'NextResponse.rewrite(new URL("/c/"+slug,request.url))']:
   self.assertIn(name,proxy)
  self.assertIn("Other routes (including unscoped modules",proxy)
  self.assertIn('"api","admin","national","shareholder"',proxy)
  self.assertIn('matcher:["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]',proxy)
  workspace=read("apps/cooperative-management/app/c/[slug]/page.tsx")
  self.assertIn('workspaceSlug={slug}',workspace)
  self.assertIn('PortalSessionGate surface="cooperative"',workspace)
 def test_authorization_still_checks_tenant_context(self):
  gate=read("packages/ui/src/portal-session-gate.tsx")
  self.assertIn('/api/me/tenant-options',gate)
  self.assertIn('attested.workspaceSlug!==workspaceSlug',gate)
  self.assertIn('item.evidenceStatus==="ROLE_AUTHORITY_EVIDENCE"',gate)
  self.assertIn('context.tenantContextVerified!==true',gate)
  self.assertIn('context.tenantId!==attested.tenantId',gate)
  self.assertIn('if(!matching)',gate)
  self.assertIn('if(state!=="ready")',gate)
 def test_frozen_auth_untouched_by_test_site(self):
  manifest=read("docs/design/TTO-AUTH-UI-V1-FREEZE.json")
  self.assertIn('"freezeId": "TTO-AUTH-UI-V1"',manifest)
  self.assertIn('"UI_GREEN_APPROVED_FROZEN"',manifest)
  self.assertIn("apps/cooperative-management/app/subscribe/page.tsx",manifest)
 def test_no_actual_payment_or_legal_role_grant(self):
  order=read("apps/cooperative-management/app/api/commerce/route.ts")
  api=read("services/api/src/module.ts")
  self.assertIn('data.realPayment!==false',order)
  self.assertIn('data.managerRoleGranted!==false',order)
  self.assertIn('data.status!=="DEMO_AMOUNT_ATTESTED"',order)
  self.assertIn('process.env.VERCEL_ENV==="production"',api)

if __name__=="__main__":unittest.main()
