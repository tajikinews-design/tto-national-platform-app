"""NAV02 management extension contract. Source checks do NOT replace PG17 or owner browser UAT."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def src(p):return (ROOT/p).read_text(encoding="utf-8")
class Nav02Management(unittest.TestCase):
 def test_third_submenu_and_canonical_route(self):
  ui=src("packages/ui/src/index.tsx")
  page=src("apps/cooperative-management/app/c/[slug]/members/[section]/page.tsx")
  proxy=src("apps/cooperative-management/proxy.ts")
  for x in ('href={basePath+"/members/shareholders"}','memberSection==="shareholders"','♧</span> سهامداران'):
   self.assertIn(x,ui)
  self.assertIn('<ShareholdersTable slug={slug}/>',page)
  self.assertIn('"/api/commerce/nav02/manage"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/shareholders"',proxy)
 def test_all_ten_columns_and_real_actions_in_table(self):
  ui=src("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
  for x in ("عکس بندانگشتی","عنوان","نام و نام خانوادگی","گروه","تعداد سهام",
    "سهام در تعهد","مبلغ پرداختی","مبلغ در تعهد","وضعیت سهام","عملیات مدیریتی",
    "profileEdit","capitalEdit","suspend","resume","delete","audit",
    '"DELETE_SYNTHETIC_DRAFT"','confirmation!=="حذف دائم"',
    'credentials:"same-origin"','fetch("/api/commerce/nav02/manage"'):
   self.assertIn(x,ui)
  self.assertIn('BigInt(item.subscribedShares)*BigInt(item.nominalRial)',ui)
  self.assertNotIn('localStorage',ui)
  self.assertNotIn('window.confirm',ui)
  self.assertIn('قرنطینه',ui)
  self.assertNotIn('photoUrl',ui)
 def test_audit_no_plaintext_and_preview_only(self):
  sql=src("database/migrations/9999w_ph12_nav02_shareholder_management.sql")
  for x in ("commerce_demo_nav02_management_audit","FORCE ROW LEVEL SECURITY",
    "PREVIEW_OWNER_REQUIRED","tto.context_actor_id()","STALE_NAV02_DRAFT",
    "FOR UPDATE OF w,d","record_version","CHECK (management_state IN",
    "commerce_demo_nav02_edit_profile_secure","commerce_demo_nav02_edit_capital_secure",
    "commerce_demo_nav02_change_state","commerce_demo_nav02_delete_unverified",
    "DELETE FROM tto.commerce_demo_share_capital_drafts","ON DELETE CASCADE",
    "commerce_demo_nav02_audit","nav02_guard_capital_insert",
    "nav02_guard_photo_insert","photo_state","::text AS nominal_value_rial"):
   self.assertIn(x,sql)
  self.assertNotIn("GRANT SELECT ON tto.commerce_demo_nav02_management_audit",sql)
  self.assertNotIn("UPDATE tto.ph06_",sql)
  self.assertNotIn("INSERT INTO tto.ph06_",sql)
  self.assertNotIn("TRANSFERRED",sql)
 def test_bff_and_api_never_expose_sensitive_identity(self):
  api=src("services/api/src/module.ts")
  bff=src("apps/cooperative-management/app/api/commerce/nav02/manage/route.ts")
  for x in ('@Post("commerce/demo/nav02/manage")','@Get("commerce/demo/nav02/manage")',
    '"commerce/demo/nav02"', 'TTO_ISOLATED_DEMO_DB','PREVIEW_ONLY',
    'TTO_NAV02_REAL_PII_ENABLED','SYNTHETIC_PROFILE_REQUIRED',
    'this.db.withActor(actor,async c=>','createCipheriv("aes-256-gcm",key,iv)',
    '"SELECT tto.commerce_demo_nav02_profile_for_edit($1,$2::uuid) AS profile"',
    '"SELECT tto.commerce_demo_nav02_delete_unverified($1,$2::uuid,$3,$4) AS record"',
    'managementState:p.managementState','photoState:p.photoState'):
   self.assertIn(x,api)
  for x in ('ORIGIN_REQUIRED','ORIGIN_DENIED','LOGIN_REQUIRED','BODY_TOO_LARGE',
    'private, no-store','Authorization:"Bearer "+tk','STALE_VERSION','PREVIEW_ONLY'):
   self.assertIn(x,bff)
  self.assertNotIn('set-cookie',bff)
 def test_pg17_fence_is_disposable_only(self):
  workflow=src(".github/workflows/nav02-management-pg17.yml")
  sql=src("tests/sql/nav02-shareholder-draft-management-fence.sql")
  for x in ('postgres:17','nav02-shareholder-draft-management-fence.sql','NO DEPLOY',
    'NAV02_PG17_SYNTHETIC_MANAGEMENT_ROLLBACK_PASS'):
   self.assertIn(x,workflow)
  for x in ('SET LOCAL ROLE tto_app','ROLLBACK','CROSS_TENANT_READ_LEAK',
    'STALE_VERSION_ALLOWED','SUSPENDED_EDIT_ALLOWED','NAV02_CASCADE_ERASURE_NONPII_AUDIT_PASS'):
   self.assertIn(x,sql)
if __name__=="__main__":unittest.main()
