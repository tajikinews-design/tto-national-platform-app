"""No intermediary sales, setup or owner pages after cooperative creation."""
import unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def src(p):return (R/p).read_text(encoding="utf-8")
class DirectDashboardEntry(unittest.TestCase):
 def test_checkout_redirects_to_same_origin_dashboard(self):
  text=src("apps/cooperative-management/app/subscribe/page.tsx")
  self.assertIn('window.location.replace("/c/"+encodeURIComponent(data.slug))',text)
  self.assertNotIn('window.location.replace("https://"+data.domain)',text)
 def test_owner_and_legal_manager_remain_separate(self):
  gate=src("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  for v in ['"/api/auth/password/session"','managerSession.workspaceSlug===slug',
   '"/api/auth/session"','"/api/commerce/workspaces"','x.slug===slug&&x.tenantActive===true',
   'activeId={moduleId} basePath={"/c/"+slug} demoOnly','<InlineFirstCredentials workspace={workspace}/>']:
   self.assertIn(v,gate)
  self.assertNotIn('window.location.replace("/owner/"',gate)
  self.assertNotIn('window.location.replace("/setup/"',gate)
 def test_wildcard_home_uses_scoped_gate(self):
  proxy=src("apps/cooperative-management/proxy.ts")
  self.assertIn('NextResponse.rewrite(new URL("/c/"+slug,request.url))',proxy)
  self.assertIn('path.startsWith("/c/"+slug+"/modules/")',proxy)
  self.assertIn('return unavailable(request)',proxy)
  ui=src("packages/ui/src/index.tsx")
  self.assertIn('basePath = ""',ui)
  self.assertIn('basePath+\u0060/modules/',ui)
  self.assertIn('demoOnly = false',ui)
  dashboard=src("packages/ui/src/approved-dashboard.tsx")
  self.assertIn('demoOnly?<strong>{x}</strong>',dashboard)
 def test_first_login_remains_private(self):
  api=src("apps/cooperative-management/app/api/commerce/workspaces/route.ts")
  self.assertIn('out.cookies.set("tto_session",""',api)
  self.assertIn('Authorization:"Bearer "+token',api)
  self.assertIn('CREDENTIAL_SETUP_FAILED',api)
if __name__=="__main__": unittest.main()
