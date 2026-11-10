"""NAV02 owner-review feedback, without deleting statutory membership facts."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
def src(path):return (ROOT/path).read_text(encoding="utf-8")
FORM=src("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
DIRECTORY=src("apps/cooperative-management/app/c/[slug]/members/member-directory.tsx")
CASE=src("apps/cooperative-management/app/c/[slug]/members/member-case.tsx")
SHARES=src("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
OFFICER=src("apps/cooperative-management/app/c/[slug]/settings/officers.tsx")
CSS=src("packages/ui/src/control-system.css")
OFCSS=src("apps/cooperative-management/app/management-settings.css")
EXCEL=src("apps/cooperative-management/app/c/[slug]/members/member-excel-panel.tsx")
ROUTE=src("apps/cooperative-management/app/api/commerce/nav02/route.ts")
EXPORT=src("apps/cooperative-management/app/api/commerce/nav02/workbook/route.ts")
NUMBER=src("apps/cooperative-management/lib/nav02-member-number.ts")
class Nav02Review(unittest.TestCase):
 def test_accordion_flows_and_officer_form_is_three_columns(self):
  self.assertIn(".tto-submenu-motion{position:static",CSS)
  self.assertIn(".nav-area nav{display:grid",CSS)
  self.assertIn("grid-template-columns:repeat(3,minmax(0,1fr))",OFCSS)
  self.assertIn("tto-officer-form",OFFICER)
 def test_status_removed_from_surfaces_not_backend_contract(self):
  for view in (FORM,DIRECTORY,CASE,SHARES):
   self.assertNotIn("وضعیت عضویت *",view)
  self.assertNotIn("<th>وضعیت عضویت</th>",DIRECTORY)
  self.assertNotIn('membershipStatus!=="APPLICANT_UNVERIFIED"',SHARES)
  self.assertIn('shareholdingStatus==="HOLDER_REPORTED"',SHARES)
  self.assertIn('membershipStatus:"APPLICANT_UNVERIFIED"',FORM)
 def test_legacy_slug_display_preserves_ledger(self):
  self.assertIn("value.startsWith(legacyPrefix)",NUMBER)
  self.assertIn("displayMemberNumber(slug,row.membershipNumber)",ROUTE)
  self.assertIn("displayMemberNumber(scopedSlug,o.membershipNumber)",EXPORT)
 def test_xlsx_download_cannot_save_json_error_as_xlsx(self):
  self.assertIn("new Uint8Array(bytes)",EXCEL)
  self.assertIn("signature[0]!==0x50||signature[1]!==0x4b",EXCEL)
  self.assertIn('fetch(url+"&mode="+mode',EXCEL)
  self.assertIn('download("export")',EXCEL)
  self.assertIn('download("sample")',EXCEL)
  self.assertIn("window.confirm",EXCEL)
  self.assertIn("member-profile",EXPORT)
 def test_officer_picker_does_not_depend_on_officer_api(self):
  self.assertIn("if(!mr.ok)",OFFICER)
  self.assertIn("setMembers(m.items.filter",OFFICER)
  self.assertIn("if(!or.ok)",OFFICER)
  self.assertLess(OFFICER.index("setMembers(m.items.filter"),OFFICER.index("if(!or.ok)"))
  self.assertIn("officerUnavailable",OFFICER)
if __name__=="__main__":unittest.main()
