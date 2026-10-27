"""W1 NAV04 synthetic-only assemblies and elections review contract."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/"apps/shareholder/app/review/interactive/nav-04"
MODEL=(DIR/"governance-fixtures.ts").read_text("utf-8")
CLIENT=(DIR/"synthetic-governance.tsx").read_text("utf-8")
PAGE=(DIR/"page.tsx").read_text("utf-8")
CSS=(DIR/"governance.css").read_text("utf-8")
PARENT=(ROOT/"apps/shareholder/app/review/layout.tsx").read_text("utf-8")
DASH=(ROOT/"apps/shareholder/app/review/interactive/synthetic-dashboard.tsx").read_text("utf-8")
AST=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text("utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text("utf-8")

class NAV04SyntheticGovernance(unittest.TestCase):
 def test_01_provenance_and_no_fictional_company_impersonation(self):
  self.assertIn('DEMO-ISSUER — مرجع فرضی',MODEL)
  self.assertIn('تعاونی فرضی — بدون شناسه ثبتی',MODEL)
  self.assertIn('تاریخ کاملاً فرضی',MODEL)
  self.assertIn('فاقد اعتبار قانونی',CLIENT)
  self.assertIn('DEMO',CLIENT)
 def test_02_five_distinct_assemblies_and_elections(self):
  self.assertEqual(len(re.findall(r'\bid:"DEMO-(?:ASM|ELEC)-',MODEL)),5)
  self.assertIn('id:"DEMO-ASM-INVITE-01"',MODEL)
  self.assertIn('id:"DEMO-ASM-MINUTES-02"',MODEL)
  self.assertIn('id:"DEMO-ASM-POSTPONED-03"',MODEL)
  self.assertIn('id:"DEMO-ELEC-BOARD-01"',MODEL)
  self.assertIn('id:"DEMO-ELEC-INSPECTOR-02"',MODEL)
 def test_03_initially_denied_and_requires_explicit_mock_toggle(self):
  self.assertIn('const [mode,setMode]=useState<Mode>("BLOCKED")',CLIENT)
  self.assertIn('mode==="DEMO"?',CLIENT)
  self.assertIn('aria-pressed={mode==="BLOCKED"}',CLIENT)
  self.assertIn('aria-pressed={mode==="DEMO"}',CLIENT)
  self.assertIn('اطلاعات رسمی هنوز قابل نمایش نیست',CLIENT)
  self.assertIn('وضعیت نامشخص مجمع به معنی برگزارنشدن جلسه',CLIENT)
 def test_04_independent_assembly_and_election_context(self):
  self.assertIn('useState<AssemblyKind>("ASSEMBLY")',CLIENT)
  self.assertIn('record.kind===kind',CLIENT)
  self.assertIn('setKind(newKind)',CLIENT)
  self.assertIn('setActiveId(first.id)',CLIENT)
  self.assertIn('kind==="ASSEMBLY"?"نمونه‌های مجامع":"نمونه‌های انتخابات"',CLIENT)
 def test_05_no_live_voting_or_polling(self):
  for value in ('fetch(', 'axios(', 'XMLHttpRequest', 'WebSocket(',
   'navigator.sendBeacon','localStorage','sessionStorage','document.cookie',
   '/api/','process.env.','type="submit"','<form','method="POST"',
   'uploadFile','postVote','submitBallot','dangerouslySetInnerHTML'):
   with self.subTest(value=value):
    self.assertNotIn(value,CLIENT+"\n"+MODEL+"\n"+PAGE)
  self.assertIn('electionSubmission:"DISABLED"',MODEL)
  self.assertIn('ballots:"DISABLED"',MODEL)
 def test_06_document_download_and_authenticity_denied(self):
  self.assertIn('documentDownload:"DISABLED"',MODEL)
  self.assertIn('minutesAuthenticity:"NOT_VERIFIED"',MODEL)
  self.assertIn('type="button" disabled aria-disabled="true"',CLIENT)
  self.assertIn('فایل، لینک دانلود، امضا یا مرجع قانونی بارگذاری نشده است',CLIENT)
  self.assertIn('فایل و امضای حقیقی وجود ندارد',MODEL)
 def test_07_membership_is_not_voting_rights(self):
  self.assertIn('votingEligibility:"NOT_EVALUATED"',MODEL)
  self.assertIn('memberVotingPower:"NOT_CALCULATED"',MODEL)
  self.assertIn('عضویت Child06 یا تعداد سهم Child07 به‌تنهایی مجوز رأی‌دادن',CLIENT)
  self.assertIn('صلاحیت رأی و حق رأی',CLIENT)
  self.assertIn('نصاب قانونی جلسه',CLIENT)
  self.assertIn('— (منبع رسمی تأیید نشده)',MODEL)
 def test_08_official_publisher_and_election_results_blocked(self):
  self.assertIn('assemblyPublisher:"BLOCKED"',MODEL)
  self.assertIn('electionResultAuthority:"BLOCKED"',MODEL)
  self.assertIn('recipientEligibility:"UNKNOWN"',MODEL)
  self.assertIn('هیچ رأی، شمارش آرا یا نتیجه انتخاباتی واقعی وجود ندارد',MODEL)
  self.assertIn('هیچ نام منتخب، رأی یا شمارش معتبری',MODEL)
 def test_09_fictional_records_and_separate_document_status(self):
  for val in ('دعوت‌نامه ساختگی','دستور جلسه ساختگی',
   'صورت‌جلسه نمونه بدون امضا','اطلاعیه تعویق فرضی',
   'سابقه انتخاباتی ساختگی','DEMO-v1 (فاقد اعتبار)'):
   self.assertIn(val,MODEL)
  for status in ('DEMO_PUBLISHED','REVIEW_PENDING','POSTPONED','ARCHIVED'):
   self.assertIn(status,MODEL)
  self.assertIn('GOVERNANCE_FIXTURES.filter',CLIENT)
 def test_10_a11y_rtl_mobile_and_separation_from_real_api(self):
  for val in ('dir="rtl"','role="group"','aria-live="polite"',
   'aria-pressed={active.id===item.id}','role="status"',
   'type="button"','aria-labelledby="w1a-detail-title"'):
   self.assertIn(val,CLIENT)
  for val in (':focus-visible','@media(max-width:660px)',
   '@media(max-width:1070px)','prefers-reduced-motion',
   'grid-template-columns:1fr'):
   self.assertIn(val,CSS)
 def test_11_review_routing_AST_and_actual_http_smoke(self):
  self.assertIn('export const dynamic="force-static"',PAGE)
  self.assertIn('robots:{index:false,follow:false',PARENT)
  self.assertIn('href="/review/interactive/nav-04"',DASH)
  self.assertIn('"apps/shareholder/app/review/interactive/nav-04/page.tsx"',AST)
  self.assertIn('"apps/shareholder/app/review/interactive/nav-04/synthetic-governance.tsx"',AST)
  self.assertIn('"apps/shareholder/app/review/interactive/nav-04/governance-fixtures.ts"',AST)
  self.assertIn('"/review/interactive/nav-04"',SMOKE)
  self.assertIn('nav04.status!==200',SMOKE)
 def test_12_governance_not_a_live_management_system(self):
  self.assertIn('این صفحه سامانه رأی‌گیری یا رسیدگی به انتخابات نیست',CLIENT)
  self.assertIn('هیچ داده واقعی تعاونی',CLIENT)
  self.assertIn('مرجع مستقل تأیید نشده',CLIENT)
  self.assertIn('هیچ دعوت‌نامه، رأی یا صورت‌جلسه رسمی منتشر نشده',CLIENT)
  self.assertNotIn('COUNT_VOTES',CLIENT+"\n"+MODEL)
if __name__=="__main__":unittest.main()
