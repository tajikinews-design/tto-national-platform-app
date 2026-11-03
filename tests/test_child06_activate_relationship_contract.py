"""Source-derived Child06 ActivateRelationship command boundary, not formal MEMBER-AT pass."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Child06Activation(unittest.TestCase):
 def test_separate_authority_and_source_version(self):
  sql=(ROOT/"database/migrations/0022_child06_activate_relationship.sql").read_text()
  for x in ("CREATE TABLE tto.cooperative_relationships","source_version bigint",
            "membership_activation_authorizations","membership_activation_rule_gates",
            "enabled boolean NOT NULL DEFAULT false","tto.activate_relationship(",
            "tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')",
            "rec.status<>'APPROVED'","actor=rec.submitted_by","actor=rec.decided_by",
            "p_evidence=rec.decision_ref","rec.version<>p_expected_version",
            "FOR UPDATE","ALREADY_ACTIVATED","CONFLICT_ACTIVE_RELATIONSHIP",
            "MEMBERSHIP_APPROVED","FORCE ROW LEVEL SECURITY"):
   self.assertIn(x,sql)
  for x in ("INSERT INTO tto.relationship_projections","UPDATE tto.relationship_projections",
            "INSERT INTO tto.role_assignments","UPDATE tto.role_assignments",
            "INSERT INTO tto.shareholder_source_accounts","INSERT INTO tto.shareholding_source_snapshots"):
   self.assertNotIn(x,sql)
 def test_api_preserves_bff_and_safe_activation(self):
  api=(ROOT/"services/api/src/module.ts").read_text()
  bff=(ROOT/"apps/cooperative-management/app/api/tenants/[tenantId]/membership-applications/[applicationId]/activate/route.ts").read_text()
  for x in ('@Post("tenants/:tenantId/membership-applications/:applicationId/activate")',
            "tto.activate_relationship($1,$2,$3,$4)","ConflictException","ForbiddenException"):
   self.assertIn(x,api)
  for x in ("membershipBff","activationEvidenceId","expectedVersion","validUuid"):
   self.assertIn(x,bff)
  for x in ("localStorage","sessionStorage","Authorization:","method:\"DELETE\""):
   self.assertNotIn(x,bff)
if __name__=="__main__":unittest.main()
