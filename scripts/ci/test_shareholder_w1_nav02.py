"""W1 NAV02: independent Child06 membership and Child07 holdings synthetic-only review."""
from pathlib import Path
import unittest
import re

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/"apps/shareholder/app/review"
PAGE=(REVIEW/"interactive/nav-02/page.tsx").read_text("utf-8")
CLIENT=(REVIEW/"interactive/nav-02/synthetic-membership-holdings.tsx").read_text("utf-8")
CSS=(REVIEW/"interactive/nav-02/membership.css").read_text("utf-8")
NAV01=(REVIEW/"interactive/synthetic-dashboard.tsx").read_text("utf-8")
LAYOUT=(REVIEW/"layout.tsx").read_text("utf-8")
PARSER=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text("utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text("utf-8")
CONTRACT=(ROOT/"docs/contracts/shareholder-source-readiness-phase4d-v1.json").read_text("utf-8")

class SyntheticNav02(unittest.TestCase):
 def test_01_review_only_noindex_and_static_page(self):
  self.assertIn('export const dynamic="force-static"',PAGE)
  self.assertIn('SyntheticMembershipHoldings',PAGE)
  self.assertIn('robots:{index:false,follow:false',LAYOUT)
  self.assertIn('href="/review/interactive"',CLIENT)
  self.assertNotIn('redirect(',PAGE)
  self.assertNotIn('/api/',PAGE)

 def test_02_independent_child06_child07_local_state(self):
  for marker in (
   'const [membershipState,setMembershipState]=useState<DomainState>("blocked")',
   'const [holdingState,setHoldingState]=useState<DomainState>("blocked")',
   'state={membershipState} onStateChange={setMembershipState}',
   'state={holdingState} onStateChange={setHoldingState}',
   'domain="CHILD06_MEMBERSHIP"',
   'domain="CHILD07_HOLDINGS"'
  ):self.assertIn(marker,CLIENT)
  self.assertNotIn('setHoldingState(option.id)',CLIENT)
  self.assertNotIn('setMembershipState(option.id)',CLIENT)

 def test_03_all_seven_states_per_source(self):
  self.assertEqual(len(re.findall(r'^ \{id:"(?:blocked|loading|missing|denied|unavailable|expired|verified)"',CLIENT,re.M)),7)
  for state in ('blocked','loading','missing','denied','unavailable','expired','verified'):
   self.assertIn('id:"'+state+'"',CLIENT)
  self.assertIn('STATES.map(option=>',CLIENT)
  self.assertIn('onClick={()=>onStateChange(option.id)}',CLIENT)
  self.assertIn('aria-pressed={state===option.id}',CLIENT)

 def test_04_fail_closed_unknown_never_zero(self):
  self.assertIn('const isMock=state==="verified"',CLIENT)
  self.assertIn('isMock?field.value:"—"',CLIENT)
  self.assertIn('isMock?sourceLabel:"—"',CLIENT)
  self.assertIn('isMock?versionLabel:"—"',CLIENT)
  self.assertIn('isMock?asOfLabel:"—"',CLIENT)
  self.assertIn('این وضعیت معادل عدم عضویت یا صفر سهم نیست',CLIENT)
  self.assertIn('مقدار نامعلوم به معنی صفر',CLIENT)

 def test_05_member_data_and_authority_separate(self):
  for marker in ('وضعیت عضویت','نوع عضو','تاریخ ثبت عضویت','مرجع ثبت',
                 'دفتر عضویت ساختگی','TEST-ONLY-CHILD06'):
   self.assertIn(marker,CLIENT)
  self.assertIn("const MEMBER_FIELDS",CLIENT)
  self.assertIn('نسخه ۳ — ساختگی',CLIENT)
  self.assertIn('۹ کنترل Child06',CLIENT)

 def test_06_ledger_data_and_authority_separate(self):
  for marker in ('تعداد سهام','وضعیت دارایی','تاریخ آخرین تأیید دفتر',
                 'مرجع دفتر سهام','۱۲۵ سهم — عدد کاملاً فرضی','TEST-ONLY-CHILD07'):
   self.assertIn(marker,CLIENT)
  self.assertIn("const HOLDING_FIELDS",CLIENT)
  self.assertIn('نسخه ۵ — ساختگی',CLIENT)
  self.assertIn('۱۰ کنترل مستقل Child07',CLIENT)
  self.assertNotIn('walletBalance',CLIENT)

 def test_07_no_network_session_cookie_document_storage_or_writes(self):
  for marker in ('fetch(', 'XMLHttpRequest','WebSocket(', 'axios(',
                 'localStorage','sessionStorage','document.cookie',
                 'navigator.sendBeacon','Authorization:', 'process.env.',
                 'POST(', 'PUT(', 'PATCH(', 'DELETE(', 'dangerouslySetInnerHTML',
                 '<form','type="submit"','/api/'):
   with self.subTest(marker=marker):
    self.assertNotIn(marker,CLIENT)
  for marker in ('fetch(', 'process.env.', '/api/'):
   self.assertNotIn(marker,PAGE)

 def test_08_accessible_rtl_and_mobile(self):
  for marker in ('dir="rtl"','role="group"','role="status"','aria-live="polite"',
                 'aria-pressed={state===option.id}','aria-labelledby='):
   self.assertIn(marker,CLIENT)
  for marker in (':focus-visible','@media(max-width:640px)',
                 '@media(max-width:1000px)','grid-template-columns:1fr',
                 'prefers-reduced-motion'):
   self.assertIn(marker,CSS)

 def test_09_no_claim_of_legitimate_source_or_real_ownership(self):
  self.assertIn('اطلاعات کاملاً ساختگی',CLIENT)
  self.assertIn('نمونه تأییدشده ساختگی',CLIENT)
  self.assertIn('مبنای مجوز واقعی',CLIENT)
  self.assertIn('در انتظار تأیید مستقل قانونی',CLIENT)
  self.assertIn('هیچ امکان ثبت درخواست خرید، فروش، انتقال، پرداخت',CLIENT)
  self.assertIn('"approvalState": "NO_LIVE_SOURCE_APPROVAL"',CONTRACT)

 def test_10_ast_parser_next_smoke_and_navigation(self):
  self.assertIn('"apps/shareholder/app/review/interactive/nav-02/page.tsx"',PARSER)
  self.assertIn('"apps/shareholder/app/review/interactive/nav-02/synthetic-membership-holdings.tsx"',PARSER)
  self.assertIn('"/review/interactive/nav-02"',SMOKE)
  self.assertIn('if(nav02.status!==200)',SMOKE)
  self.assertIn('nav02html.includes("CHILD06_MEMBERSHIP")',SMOKE)
  self.assertIn('nav02html.includes("CHILD07_HOLDINGS")',SMOKE)
  self.assertIn('href="/review/interactive/nav-02"',NAV01)
  self.assertIn('<dl className={"w1n-details"',CLIENT)

if __name__=="__main__":unittest.main()
