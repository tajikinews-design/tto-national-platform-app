"""NAV02 legal applicant form contract: never misclassify applicant as registered member."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def read(p):return (R/p).read_text(encoding="utf-8")
class MemberFormLegal(unittest.TestCase):
 def test_natural_person_only_and_distinct_nonmember_shareholder(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('const TITLES=["آقا","خانم"]',form)
  self.assertIn("افزودن اعضا",form)
  self.assertIn("APPLICANT_UNVERIFIED",form)
  self.assertIn('personType:"NATURAL"',form)
  self.assertIn('shareholdingStatus:"NONE_UNVERIFIED"',form)
  self.assertIn('visibleItems=items.filter',form)
  directory=read("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
  self.assertIn('membershipStatus!=="APPLICANT_UNVERIFIED"',directory)
  self.assertIn("سهامدار حقیقی یا حقوقی غیرعضو",form)
  self.assertNotIn("فقط داده ساختگی مجاز است",form)
  self.assertNotIn("عکس پرسنلی ساختگی",form)
 def test_checksum_both_sides_and_clear_errors(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  api=read("services/api/src/module.ts")
  for term in ("validIranianNationalId","remainder<2","aria-invalid","role=\"alert\""):
   self.assertIn(term,form)
  for term in ("private validNationalCode","rest<2","INVALID_MEMBER_APPLICATION"):
   self.assertIn(term,api)
  self.assertIn('toLatinDigits(value)',form)
 def test_or_rule_attestation_and_fail_closed_storage(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  api=read("services/api/src/module.ts")
  bff=read("apps/cooperative-management/app/api/commerce/nav02/route.ts")
  for term in ("bornInCounty","residentInCounty","employedInCounty","informationConfirmed","membershipStatus"):
   for text in (form,api,bff):self.assertIn(term,text)
  self.assertIn('includes("yes")',bff)
  self.assertIn('includes("yes")',api)
  self.assertIn('TTO_NAV02_MEMBER_INTAKE_ENABLED',api)
  self.assertIn('TTO_NAV02_REAL_PII_ENABLED',api)
  self.assertIn('createCipheriv("aes-256-gcm",key,iv)',api)
  self.assertIn('memberSection!=="add"',read("packages/ui/src/index.tsx"))
 def test_photo_immediate_local_but_private_server(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('URL.createObjectURL(photo)',form)
  self.assertIn('URL.revokeObjectURL(url)',form)
  self.assertIn('alt="نمایش فوری عکس انتخاب‌شده"',form)
  self.assertIn('quarantinePhoto(',form)
  self.assertNotIn('localStorage',form)
  photo=read("apps/cooperative-management/app/api/commerce/nav02/photo/route.ts")
  self.assertIn('visible:false,scanned:false',photo)
if __name__=="__main__":unittest.main()
