"""NAV02 preview intake contract. Does not submit any personal identifiers."""
import unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def src(p):return (R/p).read_text(encoding="utf-8")
class Nav02IntakeContract(unittest.TestCase):
 def test_ui_preserves_two_distinct_submenus(self):
  page=src("apps/cooperative-management/app/c/[slug]/members/[section]/page.tsx")
  nav=src("packages/ui/src/index.tsx")
  route=src("apps/cooperative-management/app/c/[slug]/modules/[moduleId]/page.tsx")
  for marker in ('"new"','"shares"','moduleId="NAV-02"','nav02Content={<MemberDraftForms'):
   self.assertIn(marker,page)
  for marker in ('href={basePath+"/members/new"}','href={basePath+"/members/shares"}',
                 'memberSection','surface==="cooperative"&&i===1'):
   self.assertIn(marker,nav)
  self.assertIn('if(activeId==="NAV-02")redirect(',route)
 def test_all_declared_fields_are_present(self):
  form=src("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  for name in ("title","fullName","group","nationalId","fatherName","birthCertificate",
               "birthDate","birthPlace","telephone","mobile","postalCode","address",
               "initialShares","subscribedShares","nominalRial","paidRial","paymentDate","receiptRef"):
   self.assertIn('"'+name+'"',form)
  for title in ("آقا","خانم","شرکت","سازمان","اداره"):
   self.assertIn('"'+title+'"',form)
 def test_staging_db_never_mutates_legal_ledger(self):
  sql=src("database/migrations/9999t_ph12_nav02_shareholder_intake_drafts.sql")
  for marker in ("DRAFT_UNVERIFIED","DECLARED_UNVERIFIED","SECURITY DEFINER",
       "tto.context_actor_id()","REVOKE ALL ON",
       "GRANT EXECUTE ON","ALTER TABLE tto.commerce_demo_shareholder_drafts ENABLE ROW LEVEL SECURITY",
       "ALTER TABLE tto.commerce_demo_share_capital_drafts FORCE ROW LEVEL SECURITY",
       "CHECK(photo_ref IS NULL)","UNIQUE(order_id,national_identifier)"):
   self.assertIn(marker,sql)
  self.assertNotIn("GRANT SELECT ON tto.commerce_demo_shareholder_drafts",sql)
  self.assertNotIn("UPDATE tto.ph06_",sql)
  self.assertNotIn("INSERT INTO tto.ph06_",sql)
  self.assertNotIn("TRANSFERRED",sql)
 def test_owner_only_backend_and_same_origin_bff(self):
  api=src("services/api/src/module.ts")
  bff=src("apps/cooperative-management/app/api/commerce/nav02/route.ts")
  proxy=src("apps/cooperative-management/proxy.ts")
  for marker in ('"commerce/demo/nav02"','TTO_ISOLATED_DEMO_DB',
   '"SELECT tto.commerce_demo_nav02_list($1) AS items"',
   '"SELECT tto.commerce_demo_nav02_add($1,$2::jsonb) AS record"',
   '"SELECT tto.commerce_demo_nav02_capital($1,$2::uuid,$3::jsonb) AS record"'):
   self.assertIn(marker,api)
  for marker in ('same-origin','ORIGIN_DENIED','PREVIEW_ONLY',
    '/v1/commerce/demo/nav02','Cache-Control','BODY_TOO_LARGE','DUPLICATE_DRAFT'):
   self.assertIn(marker,bff)
  self.assertIn('"/api/commerce/nav02"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/new"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/shares"',proxy)
  gate=src("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  self.assertIn('workspace.staff!==true&&nav02Content',gate)
 def test_photo_protected_no_storage_bypass(self):
  form=src("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn("URL.createObjectURL(photo)",form)
  self.assertIn('photo){setError(true)',form)
  self.assertIn("فقط از داده‌های ساختگی استفاده کنید",form)
  self.assertNotIn('FormData(',form)
if __name__=="__main__":unittest.main()
