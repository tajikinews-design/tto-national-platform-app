"""TTO demo workspace registration regression: customer name, server slug, verified
mobile, no client payment, and Vercel-to-Vercel signed identity.
These source contracts do not create a workspace or send any SMS.
"""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def source(p):return (ROOT/p).read_text(encoding="utf-8")

class DemoWorkspaceNameFirst(unittest.TestCase):
 def test_bff_forwards_provenance_on_catalog_get(self):
  bff=source("apps/cooperative-management/app/api/commerce/route.ts")
  catalog=bff.split("export async function GET",1)[1].split("export async function POST",1)[0]
  self.assertIn('headers:{...trustedBackendHeaders(req)}',catalog)
  self.assertIn('"/v1/commerce/demo/plans"',catalog)
  self.assertIn('realPaymentEnabled',source("apps/cooperative-management/app/subscribe/page.tsx"))
 def test_form_does_not_require_preset_slug_or_second_mobile(self):
  page=source("apps/cooperative-management/app/subscribe/page.tsx")
  self.assertIn('name:"",planCode:""',page)
  self.assertIn('body:JSON.stringify({name:form.name.trim(),planCode:form.planCode})',page)
  for absent in ('id="order-slug"','id="order-mobile"','id="order-amount"','amountIrr:',
                 'slug:""','mobile:""'):
   self.assertNotIn(absent,page)
  for present in ('نام دلخواه تعاونی نمونه','نشانی اختصاصی و یکتا',
                  'authenticated!==true','/api/auth/session',
                  'href={"https://"+result.domain+"/login"}'):
   self.assertIn(present,page)
 def test_bff_rejects_user_manipulation(self):
  bff=source("apps/cooperative-management/app/api/commerce/route.ts")
  self.assertIn('Object.keys(o).some(key=>!["name","planCode"].includes(key))',bff)
  self.assertIn('body:JSON.stringify({name:o.name,planCode:o.planCode})',bff)
  self.assertIn('data.realPayment!==false',bff)
  self.assertIn('data.managerRoleGranted!==false',bff)
  self.assertIn('data.status!=="DEMO_AMOUNT_ATTESTED"',bff)
 def test_backend_generates_slug_and_reads_verified_mobile(self):
  svc=source("services/api/src/module.ts")
  block=svc.split('@Post("commerce/demo/confirm")',1)[1].split('@Get("commerce/demo/my-subscriptions")',1)[0]
  self.assertIn("generateDemoWorkspaceSlug(name)",block)
  self.assertIn('verified_mobile_identifiers WHERE user_id=$1 AND revoked_at IS NULL',block)
  self.assertIn('new ForbiddenException("VERIFIED_MOBILE_REQUIRED")',block)
  self.assertIn("Object.keys(input).some",block)
  self.assertIn("[slug,name,input.planCode,1,mobile]",block)
  self.assertIn('RANDOM_SLUG_COLLISION_RETRY',block)
  self.assertIn('process.env.VERCEL_ENV==="production"',block)
 def test_slug_is_random_server_side_not_preset(self):
  slug=source("services/api/src/commerce-demo-slug.ts")
  self.assertIn('randomBytes(7).toString("hex")',slug)
  self.assertIn('name.normalize("NFKC")',slug)
  self.assertIn("replace(/[^a-z0-9]+/g",slug)
  self.assertNotIn('Math.random()',slug)
  self.assertNotIn('Date.now()',slug)
 def test_checkout_approval_record(self):
  record=source("docs/design/TTO-AUTH-UI-V1-FREEZE.json")
  self.assertIn('"TTO-CHECKOUT-DEMO-V2"',record)
  self.assertIn('"PRODUCTION_HOLD"',record)

if __name__=="__main__":unittest.main()
