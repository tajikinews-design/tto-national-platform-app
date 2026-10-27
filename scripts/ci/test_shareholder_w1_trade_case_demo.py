"""NAV03 W1 static case-tracking preview: source-backed privacy/flow guardrails.

These tests verify design contracts only. No actual legal authorities, signatures,
recorded sales, payment settlements, user data, or mutable trade database.
"""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
R=ROOT/"apps/shareholder/app/review/interactive/nav-03"
FIX=(R/"case-demo/case-fixtures.ts").read_text("utf-8")
CLIENT=(R/"case-demo/synthetic-trade-case.tsx").read_text("utf-8")
PAGE=(R/"case-demo/page.tsx").read_text("utf-8")
CSS=(R/"case-demo/case.css").read_text("utf-8")
OVERVIEW=(R/"synthetic-share-market.tsx").read_text("utf-8")
AST=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text("utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text("utf-8")
LAYOUT=(ROOT/"apps/shareholder/app/review/layout.tsx").read_text("utf-8")
MODEL=(R/"market-flow-model.ts").read_text("utf-8")

class W1SyntheticCaseDetails(unittest.TestCase):
 def test_01_tenets_source_and_fixture_count(self):
  self.assertIn("TTO-SHARE-MARKET-SPEC v3.0",FIX+"\n"+MODEL)
  self.assertIn("§§24,27–28,36–42",FIX)
  self.assertEqual(len(re.findall(r'makeCase\(\{id:"DEMO-',FIX)),9)
  self.assertIn('const SAMPLE_DATE="۱۴۰۵/۰۸/۰۵ · زمان ساختگی"',FIX)
  self.assertIn('export const CASE_IDS=CASES.map',FIX)

 def test_02_buy_and_sell_examples_and_independence(self):
  for code in ("DEMO-SELL-QUEUED","DEMO-SELL-LISTED","DEMO-SELL-CANCELLED",
   "DEMO-BUY-BOARD","DEMO-BUY-PAID-REPORTED","DEMO-BUY-DISPUTED",
   "DEMO-BUY-CANCEL-REQUEST","DEMO-BUY-REGISTERED","DEMO-BUY-COMPLETED"):
   with self.subTest(case=code):self.assertIn(code,FIX)
  self.assertIn('type Filter="ALL"|PreviewFlow',CLIENT)
  self.assertIn('filter==="ALL"||item.flow===filter',CLIENT)
  self.assertIn('setSelectedId(item.id)',CLIENT)

 def test_03_canonical_model_not_duplicate_rules(self):
  self.assertIn('import {BUY_STEPS,SELL_STEPS',FIX)
  self.assertIn('steps.slice(0,config.completedCount)',FIX)
  self.assertIn('const canonicalSteps=',FIX)
  self.assertIn('statusCode:state.code',FIX)
  self.assertNotIn('fetch(',FIX+"\n"+CLIENT+"\n"+PAGE)

 def test_04_no_ownership_from_payment_or_register(self):
  self.assertIn('REGISTERED_NOT_FINAL',FIX)
  self.assertIn('NOT_TRANSFERRED',FIX)
  self.assertIn('SYNTHETIC_COMPLETED',FIX)
  self.assertIn('config.completedCount===BUY_STEPS.length',FIX)
  self.assertIn('config.completedCount>=18',FIX)
  self.assertIn('config.exception===undefined',FIX)
  self.assertIn('در نمونه، ثبت دفتر انجام شده؛ Finalization هنوز کامل نیست',FIX)
  self.assertIn('در سامانه واقعی: مالکیت فقط بعد از تمام گیت‌ها',CLIENT)
  self.assertIn('هیچ مالکیت واقعی جابه‌جا نشده',FIX)

 def test_05_reported_payment_still_requires_seller(self):
  self.assertIn('فقط اعلام پرداخت از سوی خریدار',FIX)
  self.assertIn('PAYMENT_REPORTED معادل PAYMENT_CONFIRMED نیست',FIX)
  self.assertIn('PAYMENT_REPORTED ≠ PAYMENT_CONFIRMED',CLIENT)
  self.assertIn('sellerConfirmationRef',FIX)
  self.assertIn('DEMO-SELLER-ACK (ساختگی)',FIX)
  self.assertIn('amount:"— (مبلغ واقعی یا سند بانکی وجود ندارد)"',FIX)

 def test_06_board_independent_records_are_mock_only(self):
  for word in ("DEMO-MEETING (غیرقابل استناد)","DEMO-RESOLUTION (بدون مصوبه واقعی)",
      "در انتظار تأیید مستقل","تأیید نشده؛ هیچ سند حقیقی بارگذاری نشده"):
   self.assertIn(word,FIX+"\n"+CLIENT)
  self.assertNotIn('signatureBytes',FIX+"\n"+CLIENT)
  self.assertNotIn('attachmentUrl',FIX+"\n"+CLIENT)

 def test_07_dispute_reason_codes_exact_and_block(self):
  codes=["PAYMENT_NOT_RECEIVED","PAYMENT_AMOUNT_MISMATCH","WRONG_BANK_ACCOUNT",
     "BUYER_NO_SHOW","SELLER_NO_SHOW","DOCUMENT_MISMATCH",
     "OWNERSHIP_CONFLICT","FEE_DISPUTE","OTHER"]
  for code in codes:self.assertIn('"'+code+'"',FIX)
  self.assertIn('exception:"PAYMENT_DISPUTED"',FIX)
  self.assertIn('اختلاف باز، Finalization را مسدود می‌کند',FIX)
  self.assertIn('disputed?"پرونده نمونه دارای اختلاف پرداخت باز است',CLIENT)

 def test_08_cancellation_boundary_and_correction_case(self):
  self.assertIn('exception:"CANCELLATION_REQUEST"',FIX)
  self.assertIn('exception:"CANCELLED"',FIX)
  self.assertIn('بعد از Reservation لغو مستقیم ممنوع است',FIX)
  self.assertIn('بعد از تکمیل: فقط Correction Case مستقل',FIX)
  self.assertIn('بعد از COMPLETED فقط Correction Case مستقل',FIX)
  self.assertIn('پایان مهلت تأیید خودکار ایجاد نمی‌کند',CLIENT)

 def test_09_audit_metadata_is_fictional_and_structured(self):
  for f in ('before:','after:','requestId:','reasonCode:','metadata:','at:','actor:'):
   self.assertIn(f,FIX)
  for f in ('before','after','request_id','reason_code','metadata'):
   self.assertIn(f,CLIENT)
  self.assertIn("SYNTHETIC_STAGE_EXAMPLE",FIX)
  self.assertIn("SYNTHETIC_EXCEPTION_ONLY",FIX)
  self.assertIn("Fixture ثابت طراحی است، نه Audit دائمی",CLIENT)

 def test_10_provenance_registry_is_not_real(self):
  for text in ("DEMO-REGISTER (غیرواقعی)","DEMO-PAGE","DEMO-ROW",
               "DEMO-VERIFIER (نمونه)","در دفتر واقعی ثبت نشده"):
   self.assertIn(text,FIX)
  self.assertIn('ثبت دفتر سهام بدون Final Approval',FIX)

 def test_11_no_operation_or_source_io(self):
  for label in ("fetch(","axios","XMLHttpRequest","WebSocket(","process.env.",
    "localStorage","sessionStorage","document.cookie","navigator.sendBeacon",
    "dangerouslySetInnerHTML","/api/","type=\"submit\"","<form","method=\"POST\"",
    "UPDATE share_holdings","setTimeout(","setInterval("):
   with self.subTest(label=label):
    self.assertNotIn(label,FIX+"\n"+CLIENT+"\n"+PAGE)
  self.assertIn('type="button" disabled aria-disabled="true"',CLIENT)
  self.assertIn('همه اقدامات مسدود هستند',CLIENT)

 def test_12_ui_accessibility_and_rtl(self):
  for text in ('dir="rtl"','aria-pressed={filter===value}','aria-pressed={selected.id===item.id}',
   'aria-live="polite"','role="status"','role="note"','type="button"'):
   self.assertIn(text,CLIENT)
  for text in (':focus-visible','@media(max-width:670px)',
      '@media(max-width:1050px)','prefers-reduced-motion','grid-template-columns:1fr'):
   self.assertIn(text,CSS)

 def test_13_review_only_noindex_and_previous_nav_preserved(self):
  self.assertIn('export const dynamic="force-static"',PAGE)
  self.assertIn('robots:{index:false,follow:false',LAYOUT)
  self.assertIn('href="/review/interactive/nav-03/case-demo"',OVERVIEW)
  self.assertIn('href="/review/interactive/nav-03"',CLIENT)
  self.assertIn('case-demo/synthetic-trade-case.tsx',AST)
  self.assertIn('case-demo/case-fixtures.ts',AST)
  self.assertIn('case-demo/page.tsx',AST)

 def test_14_next_http_smoke_requires_explicit_fictional_content(self):
  self.assertIn('"/review/interactive/nav-03/case-demo"',SMOKE)
  self.assertIn('caseRes.status!==200',SMOKE)
  self.assertIn('caseHtml.includes(marker)',SMOKE)
  self.assertIn('DEMO-BUY-COMPLETED',SMOKE)
  self.assertIn('مالکیت منتقل نشده است',SMOKE)
  self.assertIn('هیچ پرونده واقعی خوانده یا ذخیره نمی‌شود',SMOKE)

if __name__=="__main__":
 unittest.main()
