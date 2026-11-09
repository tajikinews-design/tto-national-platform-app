"""Preview customer-selected subdomains and server fallback. Source tests never send SMS or create an order."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def source(p):return (ROOT/p).read_text(encoding="utf-8")
class DemoWorkspaceNameFirst(unittest.TestCase):
 def test_catalog_has_vercel_identity(self):
  b=source("apps/cooperative-management/app/api/commerce/route.ts")
  self.assertIn('headers:{...trustedBackendHeaders(req)}',b)
  self.assertIn('"/v1/commerce/demo/plans"',b)
 def test_optional_customer_selected_subdomain(self):
  s=source("apps/cooperative-management/app/subscribe/page.tsx")
  for v in ('name:"",slug:"",planCode:""','id="order-slug"','slugValid',
            'نام زیردامنه اختصاصی (اختیاری)',
            'form.slug?form.slug+".ttoir.ir"',
            '...(form.slug?{slug:form.slug}:{})','/api/auth/session'):
   self.assertIn(v,s)
  for v in ('id="order-mobile"','id="order-amount"','amountIrr:'):
   self.assertNotIn(v,s)
 def test_bff_validates_fields_and_rejects_injection(self):
  s=source("apps/cooperative-management/app/api/commerce/route.ts")
  for v in ('Object.keys(o).some(key=>!["name","planCode","slug"].includes(key))',
            'slugFormat.test(o.slug)','reservedSlugs.has(o.slug)',
            '...(typeof o.slug==="string"?{slug:o.slug}:{})',
            'data.realPayment!==false','data.managerRoleGranted!==false'):
   self.assertIn(v,s)
 def test_backend_validates_chosen_slug_or_generates_random_one(self):
  a=source("services/api/src/module.ts")
  b=a.split('@Post("commerce/demo/confirm")',1)[1].split('@Get("commerce/demo/my-subscriptions")',1)[0]
  for v in ('generateDemoWorkspaceSlug(name)',
            'typeof input.slug==="string"?input.slug:generateDemoWorkspaceSlug(name)',
            'reserved.has(input.slug)','"WORKSPACE_ADDRESS_TAKEN"',
            'verified_mobile_identifiers WHERE user_id=$1 AND revoked_at IS NULL',
            'new ForbiddenException("VERIFIED_MOBILE_REQUIRED")',
            '[slug,name,input.planCode,1,mobile]',
            'RANDOM_SLUG_COLLISION_RETRY','process.env.VERCEL_ENV==="production"'):
   self.assertIn(v,b)
  helper=source("services/api/src/commerce-demo-slug.ts")
  self.assertIn('randomBytes(7).toString("hex")',helper)
  self.assertNotIn('Math.random()',helper)
 def test_db_unique_constraint_and_no_payment(self):
  migration=source("database/migrations/9999n_ph10_commerce_demo_checkout.sql")
  self.assertIn('slug text NOT NULL UNIQUE',migration)
  self.assertIn('no_real_payment_claim',migration)
  self.assertIn('TTO-CHECKOUT-DEMO-V3',source("docs/design/TTO-AUTH-UI-V1-FREEZE.json"))
if __name__=="__main__":unittest.main()
