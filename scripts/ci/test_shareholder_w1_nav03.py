"""W1 NAV03: v3.0-spec-aligned educational market flow, no live orders."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
WEB=ROOT/"apps/shareholder/app/review/interactive"
DIR=WEB/"nav-03"
MODEL=(DIR/"market-flow-model.ts").read_text("utf-8")
CLIENT=(DIR/"synthetic-share-market.tsx").read_text("utf-8")
PAGE=(DIR/"page.tsx").read_text("utf-8")
CSS=(DIR/"market.css").read_text("utf-8")
REVIEW_LAYOUT=(ROOT/"apps/shareholder/app/review/layout.tsx").read_text("utf-8")
NAV02=(WEB/"nav-02/synthetic-membership-holdings.tsx").read_text("utf-8")
AST=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text("utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text("utf-8")

def steps(model: str, start: str, end: str):
    return re.findall(r'code:"([A-Z_]+)"',model.split(start,1)[1].split(end,1)[0])

class NAV03MarketSpec(unittest.TestCase):
 def test_01_spec_version_and_stage_inventory(self):
    self.assertIn('TTO-SHARE-MARKET-SPEC v3.0',MODEL)
    self.assertEqual(len(steps(MODEL,"export const SELL_STEPS","export const BUY_STEPS")),7)
    self.assertEqual(len(steps(MODEL,"export const BUY_STEPS","export const SALE_MODE")),21)
    self.assertIn('export const SALE_MODE="FULL_OFFER"',MODEL)
    self.assertNotIn('sale_mode="PARTIAL_MATCH"',MODEL)
 def test_02_sale_order_queue_pricing_listing(self):
    sale=steps(MODEL,"export const SELL_STEPS","export const BUY_STEPS")
    self.assertEqual(sale,[
     "SELL_REQUEST_SUBMITTED","SELL_ELIGIBILITY_REVIEW","SHARES_LOCKED",
     "MARKET_QUEUE","MARKET_SCHEDULED","PRICING_RULE_REVIEW","LISTED"])
    for needle in ('FIFO','ETA','ACTIVE_PRICING_RULE','no_legal_hold',
                   'available_shares','no_conflicting_lock'):
      self.assertIn(needle,MODEL)
 def test_03_21_trade_states_exact_reference_order(self):
    trade=steps(MODEL,"export const BUY_STEPS","export const SALE_MODE")
    self.assertEqual(trade,[
     "BUY_REQUESTED","SHARES_RESERVED","AUTO_VALIDATION","COOP_REVIEW",
     "BOARD_APPROVAL_PENDING","PRE_APPROVED","SELLER_CONTINUATION_PENDING",
     "PAYMENT_PENDING","PAYMENT_REPORTED","PAYMENT_CONFIRMATION_PENDING",
     "PAYMENT_CONFIRMED","FEES_RESOLUTION_PENDING","READY_FOR_TRANSFER",
     "APPOINTMENT_PENDING","APPOINTMENT_SET","TRANSFER_FORMALITIES",
     "REGISTER_ENTRY_PENDING","REGISTER_RECORDED","FINAL_APPROVAL_PENDING",
     "FINALIZING","COMPLETED"])
 def test_04_buyer_seller_flows_independent_local_preview(self):
    for line in (
     'const [flow,setFlow]=useState<PreviewFlow>("SELL")',
     'const [saleStage,setSaleStage]=useState(0)',
     'const [purchaseStage,setPurchaseStage]=useState(0)',
     'flow==="SELL"?SELL_STEPS:BUY_STEPS',
     'flow==="SELL"?setSaleStage:setPurchaseStage',
     'onClick={()=>choose(index)}',
     'aria-pressed={flow==="SELL"}',
     'aria-pressed={flow==="BUY"}'
    ):self.assertIn(line,CLIENT)
    self.assertNotIn('setSaleStage(purchaseStage)',CLIENT)
    self.assertNotIn('setPurchaseStage(saleStage)',CLIENT)
 def test_05_no_real_submit_or_ownership_change(self):
    for token in ('fetch(', 'axios', 'XMLHttpRequest','WebSocket',
                  'navigator.sendBeacon','localStorage','sessionStorage',
                  'document.cookie','process.env.','/api/','method="POST"',
                  'type="submit"','<form','createTransaction(',
                  'transaction.commit','UPDATE share_ownership_ledger',
                  'dangerouslySetInnerHTML'):
      with self.subTest(token=token):
       self.assertNotIn(token,CLIENT)
    self.assertIn('type="button" disabled aria-disabled="true"',CLIENT)
    self.assertIn('ثبت درخواست خرید',CLIENT)
    self.assertIn('ثبت درخواست فروش',CLIENT)
    self.assertIn('هیچ درخواست واقعی ثبت نمی‌شود',CLIENT)
 def test_06_owner_legal_effect_separation(self):
    for token in ('BOARD','SELLER','BUYER','COOPERATIVE','SYSTEM',
                  'OWNER_LABEL[current.owner]','وضعیت اثر حقوقی',
                  'هیچ انتقال واقعی رخ نداده','مالکیت منتقل نشده',
                  'پرداخت یا تأیید وصول انتقال نیست',
                  'REGISTER_RECORDED','FINALIZING','ROLLBACK'):
      self.assertIn(token,MODEL+"\n"+CLIENT)
    self.assertNotIn('window.location.assign',CLIENT)
 def test_07_mvp_money_bounds_and_coop_fees(self):
    self.assertIn('خریدار ← فروشنده',CLIENT)
    self.assertIn('پلتفرم کیف پول',CLIENT)
    self.assertIn('مرجع مجاز تعاونی',CLIENT)
    self.assertIn('ثمن مستقیم خریدار→فروشنده',MODEL)
    self.assertIn('PAYMENT_REPORTED',MODEL)
    self.assertIn('PAYMENT_CONFIRMED',MODEL)
 def test_08_rules_legal_help_and_forbidden_hardcode(self):
    for token in ('⚖ راهنمای قانونی این صفحه','TTO-SHARE-MARKET-SPEC v3.0',
                  'COOP_APPROVED_POLICY','ACTIVE_PRICING_RULE',
                  'LEGAL_GATE-CAPITAL-COMMITMENT-PRICE','قیمت دلخواه',
                  'نیازمند تأیید مستقل','ثبت دفتر سهام'):
      self.assertIn(token,CLIENT+"\n"+MODEL)
    self.assertNotIn('REAL_VALUE + BANK_INTEREST',CLIENT+"\n"+MODEL)
    self.assertNotIn('unit_price: 100000',CLIENT+"\n"+MODEL)
 def test_09_sell_input_trade_receipt_data_required(self):
    for token in ('نوع درخواست','تعداد سهم مورد درخواست','شیوه عرضه',
                  'پذیرش سیاست بازار','قیمت هر سهم','آگهی عرضه مرجع',
                  'نوع خریدار','سقف مالکیت','مبلغ کل و کارمزدها',
                  'رسید','tracking_number','board_approval_reference',
                  'register_number','ruleset_version'):
      self.assertIn(token,CLIENT+"\n"+MODEL)
    self.assertIn('حساب بانکی فروشنده","—',CLIENT)
 def test_10_scenarios_and_exception_review(self):
    for code in ('REJECTED','CANCELLED','EXPIRED','SUSPENDED',
                 'PAYMENT_DISPUTED','TRANSFER_DISPUTED','LEGAL_REVIEW_REQUIRED',
                 'MANUAL_REVIEW_REQUIRED'):
       self.assertIn('"'+code+'"',CLIENT)
    self.assertIn('درخواست لغو',CLIENT)
    self.assertIn('تأیید خودکار وصول',CLIENT)
    self.assertIn('dispute',MODEL.lower())
 def test_11_noindex_and_real_next_http_smoke(self):
    self.assertIn('export const dynamic="force-static"',PAGE)
    self.assertIn('robots:{index:false,follow:false',REVIEW_LAYOUT)
    self.assertIn('href="/review/interactive/nav-03"',NAV02)
    self.assertIn('"apps/shareholder/app/review/interactive/nav-03/page.tsx"',AST)
    self.assertIn('"apps/shareholder/app/review/interactive/nav-03/synthetic-share-market.tsx"',AST)
    self.assertIn('"/review/interactive/nav-03"',SMOKE)
    self.assertIn('if(nav03.status!==200)',SMOKE)
    self.assertIn('nav03html.includes(text)',SMOKE)
 def test_12_accessibility_rtl_and_responsive(self):
    for token in ('dir="rtl"','aria-live="polite"','aria-pressed={flow===',
                  'aria-current={index===active?"step":undefined}',
                  'role="status"','<details className="w1m-legal"',
                  'aria-label={"مراحل "'):
       self.assertIn(token,CLIENT)
    for token in (':focus-visible','@media(max-width:630px)',
                  '@media(max-width:950px)','grid-template-columns:1fr',
                  'prefers-reduced-motion'):
       self.assertIn(token,CSS)

if __name__=="__main__":unittest.main()
