"""Source-locked UI continuity guards; not original MEMBER-AT acceptance."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
SH=ROOT/"apps/shareholder/app/tenants/[tenantId]/membership-application/page.tsx"
CM=ROOT/"apps/cooperative-management/app/tenants/[tenantId]/membership-applications/page.tsx"
PICKER=ROOT/"packages/ui/src/tenant-scope-picker.tsx"
RECORDS=ROOT/"apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx"
E2E=ROOT/"scripts/e2e-cf02-identity-authority.cjs"
class Child06ActualPortalForms(unittest.TestCase):
 def test_reuse_both_existing_portals_not_a_parallel_registration_service(self):
  self.assertTrue(SH.is_file())
  self.assertTrue(CM.is_file())
  self.assertIn('surface==="cooperative"',PICKER.read_text())
  self.assertIn('/membership-applications',PICKER.read_text())
  self.assertIn('/membership-application',RECORDS.read_text())
  source=json.loads((ROOT/"docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json").read_text())
  child=next(x for x in source["children"] if x["id"]=="CHILD-06")
  self.assertEqual(child["source_contract"],"TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION")
  self.assertEqual(child["acceptance_run_status"],"NOT_RUN")
 def test_security_of_applicant_screen(self):
  text=SH.read_text()
  for value in ("useParams","recordTenant===tenantId","read.current?.abort()",
      'credentials:"same-origin"','cache:"no-store"', "redirect:\"error\"",
      "partyId,evidenceId", "درخواست عضویت", "عضویت هنوز فعال نشده"):
   self.assertIn(value,text)
  for denied in ("localStorage","sessionStorage", "Authorization:", "setMemberRole", "shareQuantity"):
   self.assertNotIn(denied,text)
 def test_manager_guarded_queue_and_explicit_versioned_decision(self):
  text=CM.read_text()
  for value in ("loadedTenant===tenantId","active.current?.abort()",
      "expectedVersion:item.version","decisionEvidenceId:id",
      'credentials:"same-origin"','cache:"no-store"',"window.confirm",
      "res.status===409","void refresh()","درخواست‌های عضویت"):
   self.assertIn(value,text)
  for denied in ("localStorage","sessionStorage","Authorization:", "ActivateRelationship"):
   # The legal command name may appear ONLY in explanatory copy, never as an invoked route.
   if denied=="ActivateRelationship":
    self.assertNotIn('/ActivateRelationship',text)
   else:self.assertNotIn(denied,text)
 def test_synthetic_browser_probes_are_explicit(self):
  text=E2E.read_text()
  for value in ("TTO_CHILD06_REAL_BROWSER_FORMS_","شناسه سند و شاهد معتبر",
       "عضویت هنوز فعال نشده است", "no horizontal overflow",
       "browser manager approval persisted once and advanced version"):
   self.assertIn(value,text)
if __name__=="__main__":
 unittest.main()
