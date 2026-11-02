"""Guard the existing Child06/Child07 shareholder read-only surface; source tests remain authoritative."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/"apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx"
class ReadOnlySourceScreen(unittest.TestCase):
 def test_reuses_existing_view_not_parallel_duplicate(self):
  self.assertTrue(PAGE.is_file())
  self.assertFalse((ROOT/"apps/shareholder/app/my-records/page.tsx").exists())
 def test_only_reads_existing_private_bff_routes(self):
  text=PAGE.read_text(encoding="utf-8")
  for needle in ('"member-record"','"shareholding"','credentials:"same-origin"','cache:"no-store"','redirect:"error"','AbortController','controller.signal.aborted'):
   self.assertIn(needle,text)
  for forbidden in ('localStorage','sessionStorage','Authorization:', 'method:"POST"','method:"PUT"','method:"DELETE"','PAYMENT_VERIFIED','FinalizeTransfer'):
   self.assertNotIn(forbidden,text)
 def test_independently_validates_source_payload(self):
  text=PAGE.read_text(encoding="utf-8")
  for value in ("memberRecord","holdingRecord",'r.membershipStatus==="ACTIVE"',"SHARE_QTY.test(r.shareQuantity)","Number.isSafeInteger(r.ledgerVersion)","Number.isSafeInteger(r.sourceVersion)","r.status!==200","error(\"session-required\")"):
   self.assertIn(value,text)
  self.assertIn("نبود اطلاعات به معنی صفر سهم نیست",text)
  self.assertIn("تعداد سهام ثبت‌شده: {holding.record.shareQuantity}",text)
 def test_synthetic_pg_e2e_proves_zero_vs_unavailable_and_revocation(self):
  e2e=(ROOT/"scripts/e2e-cf02-identity-authority.cjs").read_text(encoding="utf-8")
  for phrase in ('"revoked BFF holdings session blocked"','"source revocation hides shares immediately"','"cross cooperative holdings read denied"','"shareholding no-cache"','"0"','"37"'):
   self.assertIn(phrase,e2e)
if __name__=="__main__":
 unittest.main()
