"""Issue #154: exact source-lock regression guards, not canonical MEMBER-AT."""
import unittest
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"database/migrations/0023_cf02_child06_relationship_projector_lab.sql"
E2E=ROOT/"scripts/e2e-cf02-identity-authority.cjs"
class CF02Child06Projection(unittest.TestCase):
 def test_ownership_and_source_contract(self):
  b=json.loads((ROOT/"docs/architecture/PH02_23_DOMAIN_OWNERSHIP_EVENT_CONTRACT.json").read_text())
  domains=b["domains"]
  self.assertIn("COOPERATIVE_RELATIONSHIP_PROJECTED",next(x for x in domains if x["child"]=="CHILD-02")["event_contracts"])
  self.assertIn("MEMBERSHIP_APPROVED",next(x for x in domains if x["child"]=="CHILD-06")["event_contracts"])
  m=json.loads((ROOT/"docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json").read_text())
  self.assertEqual(next(x for x in m["children"] if x["id"]=="CHILD-06")["acceptance_run_status"],"NOT_RUN")
 def test_no_role_or_shares_and_both_gates(self):
  sql=SRC.read_text()
  for clause in ("cf02_relationship_projection_authorizations",
     "cf02_relationship_projection_rule_gates","enabled boolean NOT NULL DEFAULT false",
     "cf02_project_child06_relationship_event","tto.context_tenant_id()",
     "tto.has_tenant_role(p_tenant,'DOCUMENT_REVIEWER')","valid_identity_evidence",
     "MEMBERSHIP_APPROVED","SOURCE_RELATIONSHIP_INVALID",
     "SOURCE_DECISION_INVALID","ALREADY_PROJECTED",
     "STALE_OR_CONFLICTING_SOURCE_VERSION","SOURCE_VERSION_GAP",
     "LEGACY_OR_ACTIVE_PROJECTION_CONFLICT","FOR UPDATE",
     "cf02_relationship_projection_receipts","FORCE ROW LEVEL SECURITY",
     "COOPERATIVE_RELATIONSHIP_PROJECTED","FROM PUBLIC,tto_app"):
   self.assertIn(clause,sql)
  for disallowed in ("INSERT INTO tto.role_assignments","UPDATE tto.role_assignments",
   "INSERT INTO tto.member_source_snapshots","UPDATE tto.member_source_snapshots",
   "INSERT INTO tto.shareholder_source_accounts","INSERT INTO tto.shareholding_source_snapshots",
   "INSERT INTO tto.cooperative_relationships"):
   self.assertNotIn(disallowed,sql)
  self.assertNotIn("GRANT EXECUTE ON FUNCTION tto.cf02_project_child06_relationship_event",sql)
 def test_disposable_e2e_and_migrations_are_pinned(self):
  s=E2E.read_text()
  for text in ("has_function_privilege('tto_app'","projectAs(NATIONAL,A,projectionEventId)",
   "ALREADY_PROJECTED","ordinary applicant cannot run projector",
   "source-versioned reference","projection did not add a second MEMBER-role assignment",
   "revoked projector rule immediately fails closed"):
   self.assertIn(text,s)
  for f in (".github/workflows/tto-adaptive-ci.yml","scripts/ci/release-regression.sh"):
   self.assertIn(SRC.name,(ROOT/f).read_text())
if __name__=="__main__":unittest.main()
