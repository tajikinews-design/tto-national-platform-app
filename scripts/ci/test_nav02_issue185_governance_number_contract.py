"""Issue185 structural gates; separate live PostgreSQL/portal acceptance remains HOLD."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def read(p): return (R/p).read_text()
NUMBER=read("database/migrations/9999zb_nav02_member_numbers_cooperative_local.sql")
OFFICE=read("database/migrations/9999zc_nav02_office_holders_draft.sql")
API=read("services/api/src/module.ts")
BFF=read("apps/cooperative-management/app/api/commerce/nav02/officers/route.ts")
UI=read("apps/cooperative-management/app/c/[slug]/settings/officers.tsx")
ROUTE=read("apps/cooperative-management/app/c/[slug]/settings/[section]/page.tsx")
MENU=read("apps/cooperative-management/app/c/[slug]/settings/settings-shell.tsx")
class Issue185(unittest.TestCase):
 def test_number_never_contains_workspace_slug(self):
  self.assertNotIn("v_number:=p_slug||", NUMBER)
  self.assertEqual(NUMBER.count("v_number:=v_prefix||lpad"),1)
  self.assertEqual(NUMBER.count("v_number:=p_prefix||lpad"),1)
  self.assertIn("nav02_number_registry_per_coop_unique",NUMBER)
  self.assertIn("(order_id,member_number)",NUMBER)
  self.assertIn("nav02_member_number_history_member_number_key",NUMBER)
  self.assertIn("WHERE order_id=v_order AND member_number=v_number",NUMBER)
 def test_local_number_does_not_modify_existing_issued_values(self):
  self.assertNotIn("UPDATE tto.nav02_member_number_registry SET member_number",NUMBER)
  self.assertNotIn("UPDATE tto.nav02_member_number_current SET member_number",NUMBER)
  self.assertNotIn("DELETE FROM",NUMBER)
 def test_officer_tenant_fence_and_non_operational_state(self):
  self.assertIn("nav02_member_owner_order(p_slug)",OFFICE)
  self.assertIn("d.order_id=v_order",OFFICE)
  self.assertIn("FORCE ROW LEVEL SECURITY",OFFICE)
  self.assertIn("status='DRAFT_ONLY'",OFFICE)
  self.assertNotIn("OFFICIAL_APPROVED",OFFICE)
  self.assertIn("office_code='CEO'",OFFICE)
  self.assertIn("member_draft_id IS NULL",OFFICE)
 def test_roles_and_form(self):
  for role in ("BOARD_CHAIR","BOARD_VICE_CHAIR","CEO","BOARD_MEMBER",
   "BOARD_SECRETARY","AUDITOR_PRIMARY","AUDITOR_ALT1","AUDITOR_ALT2"):
   self.assertIn(role,OFFICE)
   self.assertIn(role,UI)
  for key in ("gazetteName","gazetteDate","gazetteIssue","noticeNumber","signingScope","signingAuthorized"):
   self.assertIn(key,UI)
  self.assertIn('section==="officers"',ROUTE)
  self.assertIn("/settings/officers",MENU)
 def test_bff_session_csrf_and_backend_check(self):
  self.assertIn('if(!token(r))return fail(401',BFF)
  self.assertIn('if(!origin)return fail(403',BFF)
  self.assertIn('OFFICER_SCOPE_DENIED',BFF)
  self.assertIn('this.db.sessionActor(auth)',API)
  self.assertIn('nav02_office_holder_draft_create(',API)
  self.assertIn('MEMBER_OFFICE_SOURCE_NOT_ELIGIBLE',API)
  self.assertIn('legalPowerGranted:false',API)
if __name__=="__main__": unittest.main()
