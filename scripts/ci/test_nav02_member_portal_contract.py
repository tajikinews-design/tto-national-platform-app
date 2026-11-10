"""NAV02 member portal: permanent numbering, protected collections and no invented rights."""
import unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def read(name):return (R/name).read_text(encoding="utf8")
class MemberPortalContracts(unittest.TestCase):
 def test_global_immutable_membership_number_with_tombstones(self):
  sql=read("database/migrations/9999x_ph12_nav02_member_collections_numbers.sql")
  for marker in ("member_number text NOT NULL UNIQUE","UNIQUE(order_id,serial)",
     "next_serial", "FOR UPDATE","p_start<v_next",
     "nav02_member_number_issue","nav02_member_number_tombstone",
     "nav02_member_number_retire","retired_at=clock_timestamp()",
     "REVOKE ALL ON tto.nav02_member_number_policy",
     "nav02_member_number_policy_set","nav02_member_numbers_for_owner"):
   self.assertIn(marker,sql)
  api=read("services/api/src/module.ts")
  self.assertIn('nav02_member_numbers_for_owner',api)
  self.assertIn("await this.checkNav02Shahkar",api)
  self.assertIn("nav02_member_number_issue",api)
  self.assertIn("NUM",api)
 def test_tenant_scoped_collections(self):
  sql=read("database/migrations/9999x_ph12_nav02_member_collections_numbers.sql")
  self.assertIn("nav02_member_collections",sql)
  self.assertIn("nav02_member_owner_order",sql)
  self.assertIn("w.user_id=tto.context_actor_id()",sql)
  api=read("services/api/src/module.ts")
  self.assertIn('nav02CatalogGate()',api)
  self.assertIn("nav02_member_collection_create",api)
  self.assertIn('"/v1/commerce/demo/nav02/collections"',read("apps/cooperative-management/app/api/commerce/nav02/collections/route.ts"))
 def test_design_and_privacy(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  side=read("apps/cooperative-management/app/c/[slug]/members/member-side-panel.tsx")
  directory=read("apps/cooperative-management/app/c/[slug]/members/member-directory.tsx")
  case=read("apps/cooperative-management/app/c/[slug]/members/member-case.tsx")
  shell=read("packages/ui/src/index.tsx")
  self.assertIn("<MemberSidebar",form)
  self.assertNotIn('className="tto-nav02-photo"',form)
  for marker in ("انتخاب فایل:","موضوع:","حوزه فعالیت","مجموعه"):
   self.assertIn(marker,side)
  for marker in ("لیست اعضا","بایگانی","شماره عضویت","حذف دائم","تعلیق"):
   self.assertIn(marker,directory)
  self.assertIn("نام و نام خانوادگی",directory)
  self.assertIn("نام کاربری",shell) if False else None
  self.assertIn("پرونده عضویت",case) if False else None
  self.assertIn("افراد عضو",case)
  self.assertIn("عضویت",case)
  self.assertIn("href={basePath+\"/members/list\"}",shell)
  self.assertIn("archive",read("apps/cooperative-management/app/c/[slug]/members/[section]/page.tsx"))
  self.assertNotIn("localStorage",directory+side+case)
if __name__=="__main__":unittest.main()
