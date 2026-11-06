"""Exact v3 §51 source-to-runtime census. Structural evidence is NOT real UAT/legal signoff."""
from pathlib import Path
import json,re,unittest

ROOT=Path(__file__).resolve().parents[1]
M=json.loads((ROOT/"docs/analysis/PH12_SHARE_MARKET_V3_SECTION51_EXECUTION_CROSSWALK.json").read_text("utf-8"))
MODEL=(ROOT/"apps/shareholder/app/review/interactive/nav-03/market-flow-model.ts").read_text("utf-8")
API=(ROOT/"services/api/src/module.ts").read_text("utf-8")
M44=(ROOT/"database/migrations/0044_ph12_child06_child07_canonical_failclosed.sql").read_text("utf-8")
M20=(ROOT/"database/migrations/0020_ph06_member_share_synthetic_boundary.sql").read_text("utf-8")
PREFLIGHT=(ROOT/"services/api/src/share-market-v3-preflight.ts").read_text("utf-8")

FROZEN_LABELS=[
 "ثبت درخواست فروش","کنترل قابلیت فروش","بلوکه سهم","صف عرضه","نمایش ETA",
 "برنامه‌ریزی عرضه","تابلوی عرضه","درخواست خرید","رزرو سهم",
 "کنترل خودکار خریدار","بررسی تعاونی","تأیید هیئت‌مدیره",
 "تأیید اولیه معامله","تأیید ادامه توسط فروشنده","نمایش حساب بانکی تأییدشده",
 "پرداخت ثمن توسط خریدار به فروشنده","پرداخت هزینه‌های معامله",
 "اعلام پرداخت","تأیید وصول توسط فروشنده","تعیین وقت انتقال",
 "حضور و انجام تشریفات","ثبت دفتر سهام","تأیید نهایی",
 "Atomic Ownership Settlement","ثبت تاریخچه مالکیت","صدور سند معامله","COMPLETED"
]

class Section51ExecutionTruth(unittest.TestCase):
 def test_frozen_27_steps_exact_order_no_rewritten_product_flow(self):
  self.assertEqual(M["source"]["section"],"51. Workflow نهایی مرجع")
  self.assertEqual(M["source"]["name"],"TTO-SHARE-MARKET-SPEC v3.0")
  self.assertEqual([s["sourceLabel"] for s in M["steps"]],FROZEN_LABELS)
  self.assertEqual([s["step"] for s in M["steps"]],list(range(1,28)))

 def test_all_preview_codes_exist_but_preview_not_runtime(self):
  codes=set(re.findall(r'code:"([A-Z_]+)"',MODEL))
  self.assertEqual(len(re.findall(r'code:"([A-Z_]+)"',MODEL.split("export const BUY_STEPS",1)[1].split("export const SALE_MODE",1)[0])),21)
  self.assertEqual(len(re.findall(r'code:"([A-Z_]+)"',MODEL.split("export const SELL_STEPS",1)[1].split("export const BUY_STEPS",1)[0])),7)
  for row in M["steps"]:
   self.assertIn(row["uiPreviewCode"],codes,row["sourceLabel"])
   self.assertEqual(row["runtimeStatus"],"NOT_IMPLEMENTED_AS_REAL_END_TO_END_MARKET_WORKFLOW")
   self.assertEqual(row["independentBusinessUat"],"NOT_PROVEN")

 def test_contraints_payment_register_and_board_stay_explicit(self):
  invariants=set(M["nonNegotiable"])
  for value in ("NO_PLATFORM_CUSTODY_OR_WALLET","BUYER_PAYS_SELLER_DIRECTLY",
   "FEES_PAID_TO_COOPERATIVE_APPROVED_ACCOUNT","BOARD_APPROVAL_BEFORE_PAYMENT",
   "OFFICIAL_COOPERATIVE_SHARE_REGISTER_IS_ONLY_FINAL_LEGAL_OWNERSHIP_SOURCE",
   "REGISTER_RECORDED_AND_FINAL_RECHECK_REQUIRED_BEFORE_ATOMIC_MIRROR"):
   self.assertIn(value,invariants)
  steps=[x["canonicalControl"] for x in M["steps"]]
  self.assertLess(steps.index("BOARD_APPROVAL_PENDING"),steps.index("BUYER_TO_SELLER_DIRECT"))
  self.assertLess(steps.index("REGISTER_RECORDED"),steps.index("FINALIZING"))
  self.assertEqual(steps[-1],"COMPLETED")

 def test_staged_sql_and_real_api_are_not_accepted_market(self):
  self.assertIn("CREATE TABLE tto.child07_sell_orders",M44)
  self.assertIn("CREATE TABLE tto.child07_transfer_cases",M44)
  self.assertIn("CHECK(status IN('DRAFT','BLOCKED'))",M44)
  self.assertIn("ph06_try_finalize_transfer",M20)
  self.assertIn("SELECT false",M20)
  self.assertIn('@Get("tenants/:tenantId/me/trade-requests")',API)
  for path in ['@Post("share-offers")','@Post("market/offers/:id/buy")',
               '@Post("trades/:id/share-register")','@Post("trades/:id/final-approval")']:
   self.assertNotIn(path,API)
  self.assertEqual(M["summary"]["fullWorkflowProductionE2eAccepted"],0)
  self.assertIs(M["summary"]["liveTransferAuthorized"],False)

 def test_pure_preflight_has_no_authority_or_side_effect(self):
  for marker in ("reviewSellerPreflight","reviewBuyerPreflight","reviewOfficialRegisterFinalization",
   'liveOrderAuthorized: false','liveOwnershipTransferAuthorized: false',
   '"UNPAID_COMMITMENT_LEGAL_REVIEW"','"OFFICIAL_COOPERATIVE_REGISTER_NOT_VERIFIED"'):
   self.assertIn(marker,PREFLIGHT)
  for marker in ("INSERT INTO","UPDATE tto.","DELETE FROM","pg.query(","pool.query(",
                 "fetch(","wallet","transferFunds("):
   self.assertNotIn(marker,PREFLIGHT)
  self.assertNotIn("share-market-v3-preflight",API,"Pure guard must not be presented as wired production API")

 def test_project_legal_gates_are_not_autopromoted(self):
  self.assertEqual(M["scope"]["realTradeAuthorizations"],0)
  self.assertTrue(all(x["ownerLegalAuthorization"]=="NOT_APPROVED" for x in M["steps"]))

if __name__=="__main__":unittest.main()
