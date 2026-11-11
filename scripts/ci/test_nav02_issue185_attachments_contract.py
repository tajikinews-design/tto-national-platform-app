"""Security contracts for owner-private scanned NAV02 attachments."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def src(p): return (R/p).read_text()
SCHEMA=src("database/migrations/9999ze_nav02_member_attachments_scanned.sql")
API=src("services/api/src/module.ts")
BFF=src("apps/cooperative-management/app/api/commerce/nav02/attachments/route.ts")
DL=src("apps/cooperative-management/app/api/commerce/nav02/attachments/download/route.ts")
FORM=src("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
PROXY=src("apps/cooperative-management/proxy.ts")
class Attachments(unittest.TestCase):
 def test_scanner_and_integrity_are_fail_closed(self):
  b=API.split('@Post("commerce/demo/nav02/attachments")',1)[1].split(
   '@Get("commerce/demo/nav02/attachments")',1)[0]
  self.assertIn("scanQuarantineBytes(bytes)",b)
  self.assertIn('scan.verdict!=="CLEAN"',b)
  self.assertIn("ATTACHMENT_SCANNER_UNAVAILABLE",b)
  self.assertIn("PRIVATE_READY",b)
  self.assertIn("aes-256-gcm",b)
  self.assertIn('TTO_NAV02_ATTACHMENT_KEY',b)
  self.assertIn("ATTACHMENT_SIGNATURE_INVALID",b)
  self.assertIn("bytes.fill(0)",b)
  self.assertIn("nav02_attachment_list($1,$2::uuid)",b)
  self.assertLess(b.index("nav02_attachment_list($1,$2::uuid)"),b.index("scanQuarantineBytes(bytes)"))
 def test_db_owner_scope_and_privacy(self):
  self.assertIn("tto.nav02_member_owner_order(p_slug)",SCHEMA)
  self.assertIn("d.order_id=v_order",SCHEMA)
  self.assertIn("FORCE ROW LEVEL SECURITY",SCHEMA)
  self.assertIn("ON DELETE CASCADE",SCHEMA)
  self.assertIn("REVOKE ALL ON tto.nav02_member_attachment_drafts FROM PUBLIC,tto_app",SCHEMA)
  self.assertIn("scan_verdict='CLEAN'",SCHEMA)
  self.assertIn("state='PRIVATE_READY'",SCHEMA)
 def test_browser_route_no_exposure(self):
  for v in ("ORIGIN_REQUIRED","ORIGIN_DENIED","ATTACHMENT_MALWARE_REJECTED",
            "ATTACHMENT_SCANNER_OR_STORAGE_UNAVAILABLE","trustedBackendHeaders(r)"):
   self.assertIn(v,BFF)
  self.assertIn('Content-Disposition',DL)
  self.assertIn("nosniff",DL)
  self.assertIn('application/octet-stream',DL)
  self.assertIn('"/api/commerce/nav02/attachments"',PROXY)
  self.assertIn('"/api/commerce/nav02/attachments/download"',PROXY)
 def test_form_unblocks_only_secure_uploads(self):
  self.assertIn('async function saveAttachment',FORM)
  self.assertIn('"/api/commerce/nav02/attachments"',FORM)
  self.assertIn('setEditId(id)',FORM)
  self.assertIn('setAttachment(null)',FORM)
  self.assertNotIn("ضمیمه انتخاب شده اما سرویس قرنطینه مدارک هنوز متصل نیست",FORM)
if __name__=="__main__":unittest.main()
