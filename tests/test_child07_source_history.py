"""Guard first live-code *read-only* source snapshot history against scope expansion."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class Child07SnapshotHistory(unittest.TestCase):
 def test_private_pg_history_definer_reuses_current_entitlement(self):
  sql=(ROOT/"database/migrations/0020_child07_approved_snapshot_history.sql").read_text()
  for s in ("SECURITY DEFINER", "tto.my_shareholding_from_source(p_tenant)",
            "p_tenant=tto.context_tenant_id()", "l.user_id=tto.context_actor_id()",
            "s.source_ref=a.source_ref", "LIMIT 20", "GRANT EXECUTE", "TO tto_app"):
   self.assertIn(s,sql)
  for s in ("INSERT INTO", "UPDATE tto.", "DELETE FROM", "FinalizeTransfer", "PAYMENT_VERIFIED"):
   self.assertNotIn(s,sql)
 def test_api_and_bff_are_get_only_and_failclosed(self):
  api=(ROOT/"services/api/src/module.ts").read_text()
  bff=(ROOT/"apps/shareholder/app/api/tenants/[tenantId]/me/shareholding-history/route.ts").read_text()
  self.assertIn('@Get("tenants/:tenantId/me/shareholding-history")',api)
  self.assertIn("my_shareholding_history_from_source",api)
  for s in ('export async function GET','credentials' if False else 'tto_session',
            'method:"GET"','cache:"no-store"','SOURCE_OR_PERMISSION_NOT_APPROVED',
            "record.items.length>20","clean.length>0"):
   self.assertIn(s,bff)
  for s in ('method:"POST"', 'method:"DELETE"', "localStorage", "sessionStorage"):
   self.assertNotIn(s,bff)
 def test_render_never_infers_transaction_history_and_prevents_stale_tenant(self):
  page=(ROOT/"apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx").read_text()
  for s in ("shareholding-history","loadedTenantId===tenantId?history",
            "snapshots.record.items[0].ledgerVersion===h.record.ledgerVersion",
            "دفتر معاملات یا سوابق انتقال سهام نیستند"):
   self.assertIn(s,page)
 def test_real_pg_e2e_covers_authority_and_zero(self):
  e=(ROOT/"scripts/e2e-cf02-identity-authority.cjs").read_text()
  for s in ("signed 0 before 37 history","cross cooperative source history denied",
            "source revocation hides snapshot history immediately",
            "expired approval blocks history",
            "history depends on active Child06 source"):
   self.assertIn(s,e)
if __name__=="__main__":
 unittest.main()
