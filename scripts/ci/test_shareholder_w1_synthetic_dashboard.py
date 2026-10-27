"""W1 NAV01 synthetic review pilot — pure UI, zero operational permission."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/"apps/shareholder/app/review"
CLIENT=(REVIEW/"interactive/synthetic-dashboard.tsx").read_text("utf-8")
PAGE=(REVIEW/"interactive/page.tsx").read_text("utf-8")
CSS=(REVIEW/"interactive/interactive.css").read_text("utf-8")
LAYOUT=(REVIEW/"layout.tsx").read_text("utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text("utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text("utf-8")

class PhaseW1SyntheticDashboard(unittest.TestCase):
 def test_01_review_only_entry_and_noindex(self):
  self.assertIn('export default function ShareholderSyntheticPreview()',PAGE)
  self.assertIn('import "./interactive.css";',PAGE)
  self.assertIn('<SyntheticDashboard/>',PAGE)
  self.assertIn('robots:{index:false,follow:false',LAYOUT)
  self.assertIn('href="/review"',CLIENT)
  self.assertNotIn('apps/shareholder/app/api',PAGE)

 def test_02_no_external_io_or_personal_data_access(self):
  for token in ('fetch(', 'XMLHttpRequest', 'WebSocket(', 'axios',
                'sessionStorage', 'localStorage', 'document.cookie',
                'navigator.sendBeacon', 'process.env.', 'Authorization:',
                'POST(', 'DELETE(', 'PUT(', 'PATCH(', 'dangerouslySetInnerHTML'):
   with self.subTest(token=token):
    self.assertNotIn(token,CLIENT)
  for token in ('fetch(', 'process.env.', 'document.cookie'):
   self.assertNotIn(token,PAGE)

 def test_03_initial_view_must_fail_closed(self):
  self.assertIn('useState<PreviewState>("blocked")',CLIENT)
  self.assertIn('sample=state==="synthetic"',CLIENT)
  self.assertIn('sample?card.demoValue:"—"',CLIENT)
  self.assertIn('منبع تأیید نشده',CLIENT)
  self.assertIn('منبع در دسترس نیست',CLIENT)
  self.assertIn('نشست یا اختیار منقضی',CLIENT)
  self.assertIn('داده کاملاً مصنوعی',CLIENT)

 def test_04_four_modes_do_not_grant_actions(self):
  self.assertEqual(CLIENT.count('id:"blocked"'),1)
  self.assertEqual(CLIENT.count('id:"unavailable"'),1)
  self.assertEqual(CLIENT.count('id:"synthetic"'),1)
  self.assertEqual(CLIENT.count('id:"expired"'),1)
  self.assertIn('onClick={()=>setState(option.id)}',CLIENT)
  self.assertIn('aria-pressed={state===option.id}',CLIENT)
  self.assertIn('type="button"',CLIENT)
  self.assertIn('role="status"',CLIENT)
  self.assertNotIn('type="submit"',CLIENT)

 def test_05_fixture_identifiable_and_never_live(self):
  self.assertIn('۱۲۵ سهم — عدد ساختگی',CLIENT)
  self.assertIn('هیچ ارزش حقوقی ندارد',CLIENT)
  self.assertIn('نه سفارش، پرداخت یا انتقال',CLIENT)
  self.assertIn('فقط Fixture ثابت · نه سند رسمی',CLIENT)
  self.assertIn('هیچ داده تأییدشده‌ای دریافت نشده',CLIENT)
  self.assertNotIn('tenantId:',CLIENT)
  self.assertNotIn('partyId:',CLIENT)

 def test_06_shared_navigation_no_duplicate_lists(self):
  self.assertIn('NAV_IDS,shareholderNavigation',CLIENT)
  self.assertIn('shareholderNavigation.map(',CLIENT)
  self.assertIn('NAV_IDS[index].toLowerCase()',CLIENT)
  self.assertNotIn('const shareholderNavigation=',CLIENT)

 def test_07_readability_mobile_and_keyboard(self):
  for item in ('@media(max-width:640px)','@media(max-width:1020px)',
               ':focus-visible','grid-template-columns:1fr',
               'prefers-reduced-motion','direction:rtl'):
   self.assertIn(item,CSS)
  self.assertIn('aria-live="polite"',CLIENT)
  self.assertIn('dir="rtl"',CLIENT)

 def test_08_new_routes_are_in_parser_and_actual_next_smoke(self):
  self.assertIn('"apps/shareholder/app/review/interactive/page.tsx"',PARSER)
  self.assertIn('"apps/shareholder/app/review/interactive/synthetic-dashboard.tsx"',PARSER)
  self.assertIn('"/review/interactive"',SMOKE)
  self.assertIn('W1 synthetic preview legal boundary missing',SMOKE)
  self.assertIn('if(interactive.status!==200)',SMOKE)

if __name__=="__main__":
 unittest.main()
