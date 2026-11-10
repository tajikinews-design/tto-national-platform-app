"""Preview photo quarantine contracts. No identities or real photo bytes are used."""
import unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def read(p):return (R/p).read_text(encoding="utf-8")
class PhotoQuarantineContract(unittest.TestCase):
 def test_no_read_or_release(self):
  sql=read("database/migrations/9999u_ph12_nav02_private_photo_quarantine.sql")
  for term in ("FORCE ROW LEVEL SECURITY","REVOKE ALL ON tto.commerce_demo_nav02_photo_quarantine",
   "GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_quarantine_photo",
   "scan_status text NOT NULL DEFAULT 'QUARANTINED' CHECK(scan_status='QUARANTINED')",
   "disclosure_status text NOT NULL DEFAULT 'BLOCKED' CHECK(disclosure_status='BLOCKED')",
   "encrypted_bytes bytea NOT NULL","expires_at timestamptz",
   "tto.context_actor_id()","FOR UPDATE OF w"):
   self.assertIn(term,sql)
  self.assertNotIn("GRANT SELECT ON tto.commerce_demo_nav02_photo_quarantine",sql)
  self.assertNotIn("photo_ref =",sql)
 def test_server_side_crypto_and_real_bytes_not_logged(self):
  backend=read("services/api/src/module.ts")
  for term in ('@Post("commerce/demo/nav02/photo")','TTO_NAV02_PHOTO_KEY',
   'createCipheriv("aes-256-gcm",key,iv)','cipher.setAAD',
   'const sha=createHash("sha256").update(raw).digest()','raw.fill(0)',
   'raw.length>716800','PHOTO_SIGNATURE_MISMATCH','TTO_ISOLATED_DEMO_DB'):
   self.assertIn(term,backend)
  method=backend[backend.index('@Post("commerce/demo/nav02/photo")'):backend.index('@Get("commerce/demo/team")')]
  self.assertNotIn('createDecipheriv(',method)
  self.assertNotIn('console.log',method)
 def test_bff_failclosed(self):
  edge=read("apps/cooperative-management/app/api/commerce/nav02/photo/route.ts")
  for term in ('ORIGIN_REQUIRED','ORIGIN_DENIED','LOGIN_REQUIRED','ORIGIN_REQUIRED',
   'BODY_TOO_LARGE','private, no-store','dataBase64','1040000',
   '/v1/commerce/demo/nav02/photo','status:"READY_PRIVATE",visible:true'):
   self.assertIn(term,edge)
  proxy=read("apps/cooperative-management/proxy.ts")
  self.assertIn('"/api/commerce/nav02/photo"',proxy)
 def test_photo_opt_in_and_partial_failure_not_duplicated(self):
  ui=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  for term in ('personalDataConfirmed','photoRetryId','savePhoto(','"/api/commerce/nav02/photo"',
   'تأیید می‌کنم','URL.revokeObjectURL','normalized.size>716800',
   'createImageBitmap(file)','canvas.toBlob('):
   self.assertIn(term,ui)
  self.assertNotIn('localStorage',ui)
  self.assertNotIn('window.sessionStorage',ui)
if __name__=="__main__":unittest.main()
