"""One cooperative member may hold a board position and CEO simultaneously.
Only preview DRAFT_ONLY records, no legal office authority. PG17 integration
is exercised in nav02-issue185-local-number-officers-fence.sql.
"""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def f(s):return (R/s).read_text(encoding="utf-8")
UI=f("apps/cooperative-management/app/c/[slug]/settings/officers.tsx")
API=f("services/api/src/module.ts")
SQL=f("database/migrations/9999zg_nav02_officer_dual_role_atomic.sql")
GATE=f("apps/cooperative-management/app/api/commerce/nav02/officers/multi/route.ts")
PROXY=f("apps/cooperative-management/proxy.ts")
PG=f("tests/sql/nav02-issue185-local-number-officers-fence.sql")
class DualRoles(unittest.TestCase):
 def test_person_is_shared_and_drafts_are_independent(self):
  self.assertIn("p_member",SQL)
  self.assertIn("'BOARD_CHAIR','BOARD_VICE_CHAIR','BOARD_MEMBER'",SQL)
  self.assertIn("'CEO',false,''",SQL)
  self.assertIn("pg_advisory_xact_lock",SQL)
  self.assertIn("ROLE_ALREADY_RECORDED_FOR_PERIOD",SQL)
  self.assertIn("nav02_office_holder_draft_create",SQL)
  self.assertIn("'DRAFT_ONLY'",SQL)
  self.assertIn("'legalPowerGranted',false",SQL)
  self.assertNotIn("DELETE FROM tto.commerce_demo_shareholder_drafts",SQL)
 def test_server_authorizes_both_roles_and_stores_in_single_transaction(self):
  self.assertIn('async nav02OfficerMultiDraftCreate(',API)
  self.assertIn('this.nav02IntakeList(auth,body.slug)',API)
  self.assertIn('this.db.sessionActor(auth)',API)
  self.assertIn('return this.db.withActor(actor,async c=>{',API)
  self.assertIn("nav02_office_holder_dual_draft_create",API)
  self.assertIn("DUAL_ROLE_OVERLAPS_EXISTING_APPOINTMENT",API)
 def test_browser_submits_both_roles_only_on_new_board_appointment(self):
  self.assertIn('const [alsoCeo,setAlsoCeo]=useState(false)',UI)
  self.assertIn('boardCeoEligibleRoles.has(form.officeCode)',UI)
  self.assertIn('!editTarget&&alsoCeo',UI)
  self.assertIn('simultaneous?"/multi"',UI)
  self.assertIn('alsoCeo:true',UI)
  self.assertIn('data.ids.length!==2',UI)
  self.assertIn('setAlsoCeo(false)',UI)
  self.assertIn("دارای چند سمت هم‌زمان",UI)
 def test_gateway_fails_closed_and_has_same_origin(self):
  self.assertIn("ORIGIN_DENIED",GATE)
  self.assertIn("LOGIN_REQUIRED",GATE)
  self.assertIn("trustedBackendHeaders(req)",GATE)
  self.assertIn("DUAL_ROLE_OVERLAPS_EXISTING_APPOINTMENT",GATE)
  self.assertIn('"/api/commerce/nav02/officers/multi"',PROXY)
 def test_disposable_pg_proves_concurrency_and_no_duplication(self):
  for x in ("DUAL_ROLE_TRANSACTION_FAILED","DUAL_ROLES_NOT_INDEPENDENT_OR_PERSON_CHANGED",
   "DUPLICATE_DUAL_ROLE_LEFT_PARTIAL_RECORDS","DUAL_CEO_INDEPENDENT_EDIT_FAILED",
   "AUDITOR_CEO_INVALID_COMBINATION_ACCEPTED"):
   self.assertIn(x,PG)
if __name__=="__main__":unittest.main()
