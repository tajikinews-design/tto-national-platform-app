"""Regression: customer demo purchase -> wildcard -> OTP -> mandatory credentials -> scoped owner UI.
No real SMS, payment, customer record, or privileged role is created by these checks.
"""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def src(p):return (ROOT/p).read_text(encoding="utf-8")

class CooperativeOnboardingFlow(unittest.TestCase):
 def test_payment_step_remains_simulated(self):
  order=src("apps/cooperative-management/app/subscribe/page.tsx")
  confirm=src("apps/cooperative-management/app/api/commerce/route.ts")
  self.assertIn('mode="order"',order)
  self.assertIn('نام دلخواه تعاونی نمونه',order)
  self.assertIn('ساخت خودکار و یکتا پس از تأیید',order)
  self.assertIn('id="order-slug"',order)
  self.assertIn('form.slug?form.slug+".ttoir.ir"',order)
  self.assertNotIn('id="order-amount"',order)
  self.assertIn('"/v1/commerce/demo/confirm"',confirm)
  self.assertIn('data.realPayment!==false',confirm)
  self.assertIn('data.managerRoleGranted!==false',confirm)
  self.assertIn('"/v1/commerce/demo/notify"',confirm)
  self.assertIn('data.smsStatus="QUEUED"',confirm)
 def test_otp_success_goes_to_workspace_automatically(self):
  otp=src("packages/ui/src/otp-login.tsx")
  self.assertIn('window.location.replace(target)',otp)
  self.assertIn('target=postLoginRedirect==="/"?"/entry":postLoginRedirect',otp)
  self.assertIn('surface!=="cooperative"',otp)
  self.assertIn('if(!resp.ok)throw Error("INVALID")',otp)
  self.assertIn('setVerified(true)',otp)
  self.assertIn('postLoginRedirect={workspaceSlug?',src("packages/ui/src/portal-password-login.tsx"))
 def test_entry_uses_real_owner_scope_and_rejects_guessing(self):
  entry=src("apps/cooperative-management/app/entry/page.tsx")
  gate=src("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  for x in ['"/api/auth/password/session"','evidence.authenticated===true','"/api/auth/session"','"/api/commerce/workspaces"','window.location.replace("/c/"+','tenantActive===true']:
   self.assertIn(x,entry)
  for x in ['"/api/auth/password/session"','managerSession.workspaceSlug===slug',
    '"/api/commerce/workspaces"','x.slug===slug&&x.tenantActive===true',
    'found.credentialsReady===true','"/setup/"','"/owner/"']:
   self.assertIn(x,gate)
  self.assertIn('manager={<PortalSessionGate',src("apps/cooperative-management/app/c/[slug]/page.tsx"))
 def test_first_login_is_owner_scoped_and_password_mandatory(self):
  setup=src("apps/cooperative-management/app/setup/[slug]/setup-client.tsx")
  for x in ['"/api/auth/session"','"/api/commerce/workspaces"',
    'x.slug===slug&&x.tenantActive===true','minLength={14}',
    '"/api/commerce/workspaces",{','data.changed!==true',
    '"/customer-login?slug="','credentialsReady===true']:
   self.assertIn(x,setup)
  self.assertIn('out.cookies.set("tto_session",""',src("apps/cooperative-management/app/api/commerce/workspaces/route.ts"))
  password_login=src("apps/cooperative-management/app/customer-login/page.tsx")
  self.assertIn('window.location.replace("/owner/"+encodeURIComponent(slug))',password_login)
  self.assertNotIn('"/settings/subscription");',password_login)
  owner=src("apps/cooperative-management/app/owner/[slug]/owner-client.tsx")
  self.assertIn('x.slug===slug&&x.tenantActive===true',owner)
  self.assertIn('item.credentialsReady!==true',owner)
  self.assertIn('مدیریت قانونی تعاونی: فعال نشده',owner)
 def test_legal_manager_context_stays_strictly_separate(self):
  gate=src("packages/ui/src/portal-session-gate.tsx")
  self.assertIn('attested.workspaceSlug!==workspaceSlug',gate)
  self.assertIn('item.evidenceStatus==="ROLE_AUTHORITY_EVIDENCE"',gate)
  self.assertIn('context.tenantContextVerified!==true',gate)
  self.assertIn('context.tenantId!==attested.tenantId',gate)
 def test_wildcard_routes_do_not_open_public_commerce(self):
  proxy=src("apps/cooperative-management/proxy.ts")
  for x in [
   'if(path==="/setup/"+slug||path==="/owner/"+slug)',
   'if(path==="/customer-login"||path==="/settings/subscription")',
   '"/api/commerce/workspaces", "/api/commerce/password-login", "/api/commerce/subscriptions"',
   'return unavailable(request)', 'RESERVED.has(slug)'
  ]:self.assertIn(x,proxy)
  self.assertNotIn('"/api/commerce/demo/confirm"',proxy)
  self.assertNotIn('"/api/commerce/notify"',proxy)
 def test_frozen_ui_amendment_is_recorded(self):
  m=src("docs/design/TTO-AUTH-UI-V1-FREEZE.json")
  self.assertIn('"TTO-AUTH-UI-V1-WORKFLOW-01"',m)
  self.assertIn('"TTO-CHECKOUT-DEMO-V3"',m)
  self.assertIn('"currentFingerprint": "9a482c8e9c514fd735c44e32dca6c09f14507a27"',m)
  self.assertIn('"releaseStatus": "PRODUCTION_HOLD"',m)

if __name__=="__main__":unittest.main()
