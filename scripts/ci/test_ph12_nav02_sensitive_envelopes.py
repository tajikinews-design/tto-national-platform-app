"""PII-at-rest guard: only encrypted identities/receipts in NAV02 preview storage."""
import unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def source(p):return (R/p).read_text(encoding="utf-8")
class Nav02SensitiveEncryption(unittest.TestCase):
 def test_database_rejects_cleartext_and_enforces_rls(self):
  sql=source("database/migrations/9999v_ph12_nav02_sensitive_profile_envelopes.sql")
  for marker in ("NAV02_NONEMPTY_PII_MIGRATION_REQUIRES_MANUAL_REVIEW",
   "nav02_plain_identity_always_empty","national_identifier IS NULL",
   "father_name IS NULL","mobile IS NULL","address IS NULL",
   "nav02_receipt_never_plaintext","declared_receipt_ref IS NULL",
   "national_id_hmac bytea NOT NULL","UNIQUE(order_id,national_id_hmac)",
   "encrypted_profile bytea NOT NULL","encrypted_receipt_ref bytea NOT NULL",
   "REVOKE ALL ON tto.commerce_demo_nav02_sensitive_profiles",
   "FORCE ROW LEVEL SECURITY","REVOKE EXECUTE ON FUNCTION",
   "commerce_demo_nav02_add_secure","commerce_demo_nav02_list_secure",
   "commerce_demo_nav02_capital_secure","tto.context_actor_id()"):
   self.assertIn(marker,sql)
  self.assertNotIn("GRANT SELECT ON tto.commerce_demo_nav02_sensitive_profiles",sql)
 def test_backend_encrypts_and_decrypts_only_for_owner(self):
  api=source("services/api/src/module.ts")
  for marker in ('TTO_NAV02_PII_KEY','TTO_NAV02_REAL_PII_ENABLED',
   'createCipheriv("aes-256-gcm",key,iv)','createDecipheriv("aes-256-gcm",key,',
   'cipher.setAAD(Buffer.from(slug+":profile:v1","utf8"))',
   'createHmac("sha256",hmacKey).update(fields.nationalId)',
   'this.db.sessionActor(auth)','this.db.withActor(actor,async c=>',
   '"SELECT tto.commerce_demo_nav02_list_secure($1) AS items"',
   '"SELECT tto.commerce_demo_nav02_add_secure($1,$2,$3,$4,$5,$6) AS record"',
   '"SELECT tto.commerce_demo_nav02_capital_secure($1,$2::uuid,$3::jsonb,$4,$5,$6) AS record"'):
   self.assertIn(marker,api)
  block=api[api.index('@Get("commerce/demo/nav02")'):api.index('NAV02 photo upload')]
  self.assertNotIn('console.log',block)
  self.assertNotIn('return {items:protectedRows}',block)
  self.assertIn('identifierMask:"***"',block)
 def test_real_member_intake_stays_fail_closed_without_signed_approval(self):
  ui=source("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('personalDataConfirmed',ui)
  for term in ("bornInCounty","residentInCounty","employedInCounty","validIranianNationalId"):
   self.assertIn(term,ui)
  api=source("services/api/src/module.ts")
  for term in ("APIIR_TOKEN","SHAHKAR_NOT_CONFIGURED",
               "SHAHKAR_UNAVAILABLE","SYNTHETIC_ONLY","nav02_member_number_issue",
               "nav02_member_edit_all_fields",'identityVerification=identityChanged?"UNVERIFIED"'):
   self.assertIn(term,api)
if __name__=="__main__":unittest.main()
