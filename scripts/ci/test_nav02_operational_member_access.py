"""No fabricated-member-only gates: authorized real identity edits stay encrypted.

This source test complements the API TypeScript build and PostgreSQL17 safety
suite; it does not claim a live Shahkar verification or lawful production
acceptance without an authenticated owner end-to-end exercise.
"""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def src(path):return (ROOT/path).read_text(encoding="utf8")
class OperationalMemberAccess(unittest.TestCase):
 def test_actual_registration_not_blocked_by_test_only_flags(self):
  api=src("services/api/src/module.ts")
  shahkar=api[api.index("private async checkNav02Shahkar("):api.index("private validJalaliBirthDate(")]
  self.assertNotIn("TTO_NAV02_SHAHKAR_ENABLED",shahkar)
  self.assertNotIn("TTO_NAV02_REAL_PII_ENABLED",shahkar)
  self.assertNotIn("VERCEL_ENV",shahkar)
  self.assertIn("APIIR_TOKEN",shahkar)
  self.assertIn("SHAHKAR_UNAVAILABLE",shahkar)
  self.assertIn('result.success===true&&result.data===false',shahkar)
  intake=api[api.index('@Post("commerce/demo/nav02")'):api.index('@Get("commerce/demo/nav02/manage")')]
  self.assertNotIn("REAL_MEMBER_INTAKE_NOT_APPROVED",intake)
  self.assertNotIn('TTO_NAV02_MEMBER_INTAKE_ENABLED',intake)
  self.assertIn('nav02_member_number_issue',intake)
  self.assertIn("this.checkNav02Shahkar",intake)
  self.assertIn("COLLECTION_NOT_REGISTERED",intake)
 def test_edit_roundtrip_real_fields_stays_authenticated_and_audited(self):
  api=src("services/api/src/module.ts")
  block=api[api.index('@Get("commerce/demo/nav02/member-profile")'):api.index('@Get("commerce/demo/nav02")')]
  for term in ("this.db.sessionActor(auth)","this.db.withActor(actor,async c=>",
   "commerce_demo_nav02_profile_for_edit","commerce_demo_nav02_edit_profile_secure",
   "IMMUTABLE_IDENTITY_REQUIRES_REVERIFICATION","STALE_MEMBER_VERSION",
   "this.checkNav02Shahkar","createCipheriv","createDecipheriv",
   "membershipStatus", "shareholdingStatus"):
   self.assertIn(term,block)
  self.assertNotIn("console.log",block)
  self.assertNotIn("SYNTHETIC_PROFILE_REQUIRED",block)
  frontend=src("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  bff=src("apps/cooperative-management/app/api/commerce/nav02/member-profile/route.ts")
  proxy=src("apps/cooperative-management/proxy.ts")
  for s in ('editVersion', 'setProfile(clean as', '"\/api\/commerce\/nav02\/member-profile"'):
   # Actual string escaping is not required outside regex in the TS source.
   self.assertIn(s.replace("\\/","/"),frontend)
  for s in ('private, no-store','ORIGIN_DENIED','LOGIN_REQUIRED',
   'STALE_MEMBER_RECORD','Authorization:"Bearer "+tk'):
   self.assertIn(s,bff)
  self.assertIn('"/api/commerce/nav02/member-profile"',proxy)
 def test_real_operational_management_routes_require_identity_not_mock_env(self):
  api=src("services/api/src/module.ts")
  begin=api.index('@Get("commerce/demo/nav02/manage")')
  end=api.index('@Get("commerce/demo/team")',begin)
  block=api[begin:end]
  self.assertIn("this.db.sessionActor(auth)",block)
  self.assertIn("this.db.withActor(actor,async c=>",block)
  self.assertNotIn("PREVIEW_ONLY",block)
  self.assertNotIn("TTO_ISOLATED_DEMO_DB",block)
  self.assertIn("commerce_demo_nav02_audit",block)
  self.assertIn("commerce_demo_nav02_change_state",block)
  self.assertIn("commerce_demo_nav02_delete_unverified",block)
 def test_legal_membership_and_share_ledger_remain_distinct(self):
  api=src("services/api/src/module.ts")
  self.assertIn('APPLICANT_UNVERIFIED',api)
  self.assertIn('NONE_UNVERIFIED',api)
  self.assertIn('legalRightsGranted',src("database/migrations/9999v_ph12_nav02_sensitive_profile_envelopes.sql"))
if __name__=="__main__":unittest.main()
