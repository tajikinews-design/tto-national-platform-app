"""Unified NAV-02 routes replace obsolete browser-tab-memory prototype."""
import unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
def read(p):return (R/p).read_text(encoding="utf-8")
class MembersUnifiedContract(unittest.TestCase):
 def test_canonical_routes_and_redirect(self):
  page=read("apps/cooperative-management/app/c/[slug]/members/[section]/page.tsx")
  menu=read("packages/ui/src/index.tsx")
  proxy=read("apps/cooperative-management/proxy.ts")
  self.assertIn('if(section==="new")redirect(',page)
  self.assertIn('"list","archive","collections"',page)
  self.assertIn('nav02Content={sub==="shareholders"',page)
  self.assertIn('href={basePath+"/members/add"}',menu)
  self.assertIn('href={basePath+"/members/shares"}',menu)
  self.assertIn('href={basePath+"/members/shareholders"}',menu)
  self.assertIn('href={basePath+"/members/list"}',menu)
  self.assertIn('href={basePath+"/members/collections"}',menu)
  self.assertIn('href={basePath+"/members/archive"}',menu)
  self.assertIn('path==="/c/"+slug+"/members/add"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/new"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/shareholders"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/list"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/collections"',proxy)
  self.assertIn('if(activeId==="NAV-02")redirect(',read("apps/cooperative-management/app/c/[slug]/modules/[moduleId]/page.tsx"))
 def test_one_authoritative_draft_form(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('section==="add"',form)
  self.assertIn('"/api/commerce/nav02"',form)
  self.assertIn('credentials:"same-origin"',form)
  self.assertIn('URL.revokeObjectURL',form)
  self.assertNotIn('localStorage',form)
  self.assertNotIn('sessionStorage',form)
  self.assertFalse((R/"apps/cooperative-management/app/c/[slug]/members/draft-store.ts").exists())
  self.assertFalse((R/"apps/cooperative-management/app/c/[slug]/members/members-workspace.tsx").exists())
 def test_tenant_boundary_and_permission(self):
  gate=read("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  self.assertIn('workspace.staff!==true&&nav02Content',gate)
  self.assertIn('memberSection={memberSection}',gate)
  self.assertIn('found.staff===true',gate)
  self.assertIn('settingsSection!==undefined',gate)
 def test_fields_and_uniform_height(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  for field in ("fullName","group","nationalId","fatherName","birthCertificate","birthDate",
   "birthPlace","telephone","mobile","postalCode","address","initialShares",
   "subscribedShares","nominalRial","paidRial","paymentDate","receiptRef"):
   self.assertIn(field,form)
  self.assertIn('height:44px',read("apps/cooperative-management/app/member-intake.css"))
if __name__=="__main__":unittest.main()
