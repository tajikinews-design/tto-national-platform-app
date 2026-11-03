"""New Child06 applications must follow source ownership and remain non-operational."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class MembershipApplicationContract(unittest.TestCase):
 def test_schema_version_sod_and_immutability(self):
  src=(ROOT/"database/migrations/0021_child06_membership_application_review.sql").read_text()
  for marker in ("tto.membership_applications", "evidence_refs uuid[]",
                 "membership_one_pending_per_tenant_party", "p_expected_version",
                 "FOR UPDATE", "ALREADY_APPLIED", "tto.child06_review_authorized",
                 "tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')",
                 "a.approved_by<>a.reviewer_id", "tto.valid_identity_evidence",
                 "tto.membership_application_outbox", "FORCE ROW LEVEL SECURITY",
                 "tto.deny_evidence_mutation", "tto.append_actor_audit",
                 "tto.identity_link_cases", "c.status='APPROVED'"):
   self.assertIn(marker,src)
  for forbidden in ("INSERT INTO tto.relationship_projections",
                    "UPDATE tto.relationship_projections",
                    "INSERT INTO tto.role_assignments",
                    "INSERT INTO tto.shareholder_source_accounts",
                    "INSERT INTO tto.shareholding_source_snapshots"):
   self.assertNotIn(forbidden,src)
 def test_nest_routes_real_actor_tenant_and_source_commands(self):
  src=(ROOT/"services/api/src/module.ts").read_text()
  for marker in ('@Post("tenants/:tenantId/membership-applications")',
                 '@Post("tenants/:tenantId/membership-applications/:applicationId/decision")',
                 'tto.submit_membership_application($1,$2,$3)',
                 'tto.record_membership_decision($1,$2,$3,$4,$5)',
                 'this.db.inTenant(actor,tenant', 'tto.list_pending_membership_applications'):
   self.assertIn(marker,src)
 def test_exact_approved_source_owner_and_unfinished_acceptance(self):
  import json
  mapping=json.loads((ROOT/"docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json").read_text())
  child=next(x for x in mapping["children"] if x["id"]=="CHILD-06")
  self.assertIn("SubmitMembershipApplication",child["canonical_commands"])
  self.assertIn("RecordMembershipDecision",child["canonical_commands"])
  self.assertEqual(child["acceptance_run_status"],"NOT_RUN")
  self.assertEqual(child["source_contract"],"TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION")
if __name__=="__main__":
 unittest.main()
