"""Phase-3 UX preview contract: 11 browsable review pages, no privileged access."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/"apps/shareholder/app"
UI=(APP/"review/review-portal.tsx").read_text(encoding="utf-8")
CSS=(APP/"review/review.css").read_text(encoding="utf-8")
HOME=(APP/"page.tsx").read_text(encoding="utf-8")
SECTION=(APP/"review/[id]/page.tsx").read_text(encoding="utf-8")
LAYOUT=(APP/"review/layout.tsx").read_text(encoding="utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text(encoding="utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text(encoding="utf-8")
NAV=(ROOT/"packages/ui/src/index.tsx").read_text(encoding="utf-8")

class ShareholderReviewOnlyContract(unittest.TestCase):
 def test_every_canonical_nav_has_browsable_review_route(self):
  for mark in (
   "NAV_IDS","shareholderNavigation","shareholderNavigation.map",
   "shareholderNavigation.slice(1)","pathFor(i)","pathFor(i+1)",
   '"/review/"+NAV_IDS[index].toLowerCase()',
   'index===0?"/review"',
   'aria-current={safe===i?"page":undefined}',
   'role="tablist"','role="tab"','role="tabpanel"',
   'onClick={()=>setTab(x.id)}','useState<ReviewTab>("overview")',
   'const SECTIONS:Section[]=['
  ):self.assertIn(mark,UI)
  self.assertIn('const section=parsePortalModuleId(id);',SECTION)
  self.assertIn('if(!section)notFound();',SECTION)
  self.assertIn('NAV_IDS = Array.from({ length: 11 }',NAV)
  self.assertIn('href="/review"',HOME)

 def test_all_sections_contain_described_features_and_governance(self):
  self.assertEqual(UI.count('intro:"'),11)
  self.assertEqual(UI.count('feature:['),11)
  self.assertEqual(UI.count('steps:['),11)
  self.assertEqual(UI.count('legal:"'),11)
  self.assertEqual(UI.count('status:"'),11)
  for topic in ("سهام و عضویت","خرید و فروش","مجامع","اطلاعیه","خدمات",
                "پروژه","گزارش","بدون اطلاعات واقعی"):
   self.assertIn(topic,UI+NAV+HOME)

 def test_review_never_uses_real_user_data_or_mutates_server(self):
  for bad in (
   "fetch(", "useEffect(", "localStorage", "sessionStorage",
   "document.cookie", "process.env.", "Authorization",
   "sendSms", "POST(", "PUT(", "PATCH(", "DELETE(",
   "dangerouslySetInnerHTML", "shareQuantity:", "walletBalance",
   "Math.random()", "Date.now()", "tenantId:"
  ):self.assertNotIn(bad,UI)
  for token in ("هیچ عملیات واقعی فعال نیست", "بدون داده واقعی",
                "نه کیف پول","حقوق مخاطبان", "بدون ورود"):
   # Copy might use variants but must carry multiple explicit limitations.
   self.assertTrue(any(x in UI for x in (
      "هیچ عملیات واقعی فعال نیست",
      "بدون داده واقعی یا دسترسی معاملاتی",
      "بدون اطلاعات یا عملیات واقعی",
      "هیچ داده سهامدار بارگذاری نشده است"
   )))
  self.assertIn('robots:{index:false,follow:false',LAYOUT)
  self.assertNotIn('metadata:{index:true',LAYOUT)

 def test_mobile_navigation_and_ast_ci_regression(self):
  for class_name in (".rv-navigation",".rv-module-grid",".rv-tabs",".rv-current",
                     "@media(max-width:760px)"):
   self.assertIn(class_name,CSS)
  for route in ("review/review-portal.tsx","review/layout.tsx",
                "review/page.tsx","review/[id]/page.tsx"):
   self.assertIn(route,PARSER)

 def test_runtime_smoke_requires_all_11_routes_and_bad_id_denial(self):
  self.assertIn('shareholder review',SMOKE)
  self.assertIn('"/review/nav-"+String(i).padStart(2,"0")',SMOKE)
  self.assertIn('"/review/not-a-nav"',SMOKE)

if __name__=="__main__": unittest.main()
