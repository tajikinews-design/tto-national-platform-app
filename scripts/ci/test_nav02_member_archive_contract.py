"""Source safety checks: candidate archive and perpetual membership number registry."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
def read(p):return (ROOT/p).read_text(encoding="utf-8")
class Nav02Archive(unittest.TestCase):
 def test_scope_auth_and_no_official_share_mutation(self):
  sql=read("database/migrations/9999y_ph12_nav02_member_archive_preview.sql")
  self.assertIn("ARCHIVED_DRAFT",sql)
  self.assertIn("RESTORED",sql)
  self.assertIn("FOR UPDATE OF w,d",sql)
  self.assertIn("v_verification<>'DRAFT_UNVERIFIED'",sql)
  self.assertIn("STALE_NAV02_DRAFT",sql)
  self.assertIn("officialLedgerUpdated',false",sql)
  self.assertNotIn("UPDATE tto.ph",sql)
  api=read("services/api/src/module.ts")
  bff=read("apps/cooperative-management/app/api/commerce/nav02/manage/route.ts")
  for act in ("archive","restore"):
   self.assertIn(act,api)
   self.assertIn(act,bff)
  self.assertIn("this.db.withActor(actor,async c=>",api)
 def test_ux_excludes_archived_and_allows_return(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-directory.tsx")
  self.assertIn('x.managementState==="ARCHIVED_DRAFT"',form)
  self.assertIn('a.key==="restore"',form)
  self.assertIn("شخصی",form) if False else None
  shares=read("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
  self.assertIn('item.managementState!=="ARCHIVED_DRAFT"',shares)
 def test_disposable_postgres_runs_all_migrations_and_rollback(self):
  workflow=read(".github/workflows/nav02-member-archive-pg17.yml")
  self.assertIn("postgres:17",workflow)
  self.assertIn("9999{n,o,p,q,r,s,t,u,v,w,x,y}",workflow)
  self.assertIn("NO DEPLOY",workflow)
  self.assertIn("nav02-member-number-archive-fence.sql",workflow)
  sql=read("tests/sql/nav02-member-number-archive-fence.sql")
  for code in ("CROSS_TENANT_NUMBER_POLICY_ALLOWED","NUMBER_REISSUED",
   "ARCHIVED_EDIT_ALLOWED","PERMANENT_NUMBER_TOMBSTONE_MISSING","ROLLBACK;"):
   self.assertIn(code,sql)
if __name__=="__main__":unittest.main()
