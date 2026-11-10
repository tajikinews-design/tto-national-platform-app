"""NAV02 legal applicant form contract: never misclassify applicant as registered member."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def read(p):return (R/p).read_text(encoding="utf-8")
class MemberFormLegal(unittest.TestCase):
 def test_natural_members_and_legal_nonmembers_are_distinguished(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('const TITLES=["آقا","خانم"]',form)
  self.assertIn("ثبت عضو",form)
  self.assertIn("APPLICANT_UNVERIFIED",form)
  self.assertIn("MemberSidebar",form)
  self.assertNotIn('className="tto-nav02-photo"',form)
  self.assertIn('collectionName',form)
  self.assertIn('occupation',form)
  self.assertIn("JalaliBirthDatePicker",form)
  self.assertIn("tto-nav02-birth-row",form)
  self.assertIn('personType:"NATURAL"',form)
  self.assertIn('shareholdingStatus:"NONE_UNVERIFIED"',form)
  self.assertIn('const visibleItems=items;',form)
  self.assertIn('profile.personType==="LEGAL"',form)
  self.assertIn('registrationNumber',form)
  self.assertIn('economicCode',form)
  self.assertIn('representativeNationalId',form)
  self.assertIn('NON_MEMBER_REPORTED',form)
  self.assertIn('HOLDER_REPORTED',form)
  directory=read("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
  self.assertIn('membershipStatus!=="APPLICANT_UNVERIFIED"',directory)
  self.assertIn("شخص حقوقی در این فرم فقط به‌عنوان غیرعضو ثبت می‌شود",form)
  self.assertIn('const MEMBER_STATES=',form)
  self.assertIn('const SHARE_STATES=',form)
  self.assertNotIn("فقط داده ساختگی مجاز است",form)
  self.assertNotIn("عکس پرسنلی ساختگی",form)
 def test_server_enforces_legal_person_nonmember_and_reported_states(self):
  api=read("services/api/src/module.ts")
  bff=read("apps/cooperative-management/app/api/commerce/nav02/route.ts")
  for text in (api,bff):
   for term in ("legalProfile","registrationNumber","economicCode","representativeNationalId",
                "NON_MEMBER_REPORTED","TRANSFER_PENDING_REPORTED"):
    self.assertIn(term,text)
  self.assertIn('fields.membershipStatus!=="NON_MEMBER_REPORTED"',api)
  self.assertIn("this.checkNav02Shahkar",api)
  self.assertIn('identityVerification',api)
 def test_governance_actions_are_versioned_and_not_legal_admission(self):
  directory=read("apps/cooperative-management/app/c/[slug]/members/member-directory.tsx")
  case=read("apps/cooperative-management/app/c/[slug]/members/member-case.tsx")
  sql=read("database/migrations/9999z_ph12_nav02_member_governance_r2.sql")
  for term in ("REISSUE_ALL_MEMBERS_ACKNOWLEDGED","p_expected","REISSUE_SET_CHANGED",
               "nav02_member_number_history","nav02_member_number_current",
               "nav02_member_end_requests","PENDING_LEGAL_REVIEW"):
   self.assertIn(term,sql)
  self.assertIn("reissueAcknowledged",directory)
  self.assertIn("issuedCount>0",directory)
  self.assertIn("archiveCollection",directory)
  self.assertIn("FULL_SHARE_TRANSFER",case)
  self.assertIn("فقط به‌عنوان غیرعضو",read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx"))
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
  self.assertIn('nav02_member_number_issue',api)
  self.assertIn('checkNav02Shahkar',api)
  self.assertIn('createCipheriv("aes-256-gcm",key,iv)',api)
  self.assertIn('memberSection!=="add"',read("packages/ui/src/index.tsx"))
 def test_photo_immediate_local_but_private_server(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('URL.createObjectURL(photo)',form)
  self.assertIn('URL.revokeObjectURL(url)',form)
  side=read("apps/cooperative-management/app/c/[slug]/members/member-side-panel.tsx")
  self.assertIn('alt="پیش‌نمایش عکس پرسنلی انتخاب‌شده"',side)
  self.assertIn("onPhoto={setPhoto}",form)
  self.assertIn('quarantinePhoto(',form)
  self.assertNotIn('localStorage',form)
  photo=read("apps/cooperative-management/app/api/commerce/nav02/photo/route.ts")
  self.assertIn('visible:false,scanned:false',photo)
if __name__=="__main__":unittest.main()
