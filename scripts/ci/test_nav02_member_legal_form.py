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
  self.assertIn('profile.personType==="NATURAL"&&!/^09[0-9]{9}$/.test(profile.mobile)',form)
  self.assertIn('HOLDER_REPORTED',form)
  directory=read("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
  self.assertNotIn('membershipStatus!=="APPLICANT_UNVERIFIED"',directory)
  self.assertIn('item.shareholdingStatus==="HOLDER_REPORTED"',directory)
  self.assertIn('Boolean(item.capitalState)',directory)
  self.assertIn("شخص حقوقی در این فرم فقط به‌عنوان غیرعضو ثبت می‌شود",form)
  self.assertNotIn('title="وضعیت عضویت *"',form)
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
 def test_backend_readiness_is_exact_api_preview_only(self):
  route=read("apps/cooperative-management/app/api/internal/backend-ready/route.ts")
  self.assertIn('trustedPreviewApis=new Set',route)
  self.assertIn('"https://tto-api-preview-454wmjead-tajikinews-6739.vercel.app"',route)
  self.assertIn('"https://tto-api-preview-cdkii5hx1-tajikinews-6739.vercel.app"',route)
  self.assertIn('trustedPreviewApis.has(base)',route)
  self.assertNotIn('includes("vercel.app")',route)
 def test_preview_login_routes_only_to_tenant_scoped_authentication(self):
  frozen=read("apps/cooperative-management/app/login/page.tsx")
  entry=read("apps/cooperative-management/app/workspace-entry/page.tsx")
  public=read("apps/cooperative-management/app/site/page.tsx")
  proxy=read("apps/cooperative-management/proxy.ts")
  gate=read("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  backend=read("services/api/src/module.ts")
  self.assertIn("PortalPasswordLogin",frozen)
  self.assertIn('SLUG.test(slug)',entry)
  self.assertIn('redirect("/c/"+encodeURIComponent(slug))',entry)
  self.assertIn('name="workspace"',entry)
  self.assertIn('method="GET"',entry)
  self.assertIn('href="/workspace-entry"',public)
  root=read("apps/cooperative-management/app/page.tsx")
  self.assertIn('process.env.VERCEL_ENV==="preview"',root)
  self.assertIn('redirect("/workspace-entry")',root)
  self.assertIn('<PortalSessionGate surface="cooperative">',root)
  self.assertIn('path==="/login"',proxy)
  self.assertIn('"/api/commerce/password-login"',gate)
  self.assertIn('commercialOnly:true',backend)
  self.assertIn('TTO_PORTAL_PASSWORD_LOGIN_ENABLED',backend)
  self.assertIn('TTO_SECURE_REAL_DATA_STAGING_ENABLED',backend)
 def test_all_member_fields_editable_and_three_column_layout(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  css=read("apps/cooperative-management/app/member-intake.css")
  api=read("services/api/src/module.ts")
  sql=read("database/migrations/9999za_ph12_nav02_member_form_r3_edit_photo.sql")
  for old in ('readOnly={Boolean(editId)}','disabled={Boolean(editId)}',
              'readOnly={Boolean(editId)&&key==="nationalId"}',
              'if(editId&&photo){setError(true)'):
   self.assertNotIn(old,form)
  for key in ("fullName","fatherName","birthCertificate","birthDate","birthPlace",
              "mobile","telephone","postalCode","address","occupation","collectionName",
              "registrationNumber","economicCode","representativeName",
              "representativeNationalId","representativeMobile","membershipStatus",
              "shareholdingStatus","personType","group","nationalId"):
   self.assertIn(key,form)
  self.assertIn('repeat(3,minmax(0,1fr))',css)
  self.assertIn('.tto-nav02-member-layout .tto-nav02-field.wide{grid-column:1/-1}',css)
  self.assertIn('tto.nav02_member_edit_all_fields',api)
  self.assertIn('national_id_hmac=p_digest',sql)
  self.assertIn('identityVerification=identityChanged?"UNVERIFIED"',api)
  self.assertIn('MEMBER_IDENTIFIER_DUPLICATE',api)
  self.assertNotIn('IMMUTABLE_IDENTITY_REQUIRES_REVERIFICATION',api)
  self.assertIn('if(!editId){setProfile(initialProfile);setPersonalDataConfirmed(false);}',form)
  self.assertIn('setPhotoRetryId("");setPhoto(null);',form)
  self.assertIn('await refresh();',form)
  self.assertIn('profile.group])].map(g=>',form)
 def test_private_photos_render_in_all_views_and_are_replaceable(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  table=read("apps/cooperative-management/app/c/[slug]/members/shareholders-table.tsx")
  directory=read("apps/cooperative-management/app/c/[slug]/members/member-directory.tsx")
  case=read("apps/cooperative-management/app/c/[slug]/members/member-case.tsx")
  api=read("services/api/src/module.ts")
  sql=read("database/migrations/9999za_ph12_nav02_member_form_r3_edit_photo.sql")
  for source in (table,directory,case):
   self.assertIn('photoState==="READY_PRIVATE"',source)
   self.assertIn('/api/commerce/nav02/photo/view?slug=',source)
  self.assertIn('if(next==="profileEdit"){window.location.assign(',table)
  self.assertIn('setPhotoRetryId(editId)',form)
  self.assertIn('tto.nav02_member_photo_save',api)
  self.assertIn('ON CONFLICT(draft_id) DO UPDATE',sql)
  self.assertIn('tto.nav02_member_owner_order',sql)
  self.assertNotIn('TTO_NAV02_PRIVATE_PHOTO_RELEASE_ENABLED',api)
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
  # Owner requested the preview banner removed globally, not just on member add.
  self.assertNotIn("عملیات رسمی و مالی تا احراز اختیار قانونی مدیر غیرفعال است.",read("packages/ui/src/index.tsx"))
  self.assertIn('aria-label="مسیر صفحه"',read("packages/ui/src/index.tsx"))
 def test_photo_immediate_local_but_private_server(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  self.assertIn('URL.createObjectURL(photo)',form)
  self.assertIn('URL.revokeObjectURL(url)',form)
  side=read("apps/cooperative-management/app/c/[slug]/members/member-side-panel.tsx")
  self.assertIn('alt="پیش‌نمایش عکس پرسنلی انتخاب‌شده"',side)
  self.assertIn("onPhoto={setPhoto}",form)
  self.assertIn('async function savePhoto(',form)
  self.assertIn('createImageBitmap(file)',form)
  self.assertIn('canvas.toBlob(',form)
  self.assertNotIn('localStorage',form)
  photo=read("apps/cooperative-management/app/api/commerce/nav02/photo/route.ts")
  self.assertIn('visible:true',photo)
  self.assertIn('Authorization:"Bearer "+token',photo)
  viewer=read("apps/cooperative-management/app/api/commerce/nav02/photo/view/route.ts")
  self.assertIn('LOGIN_REQUIRED',viewer)
  self.assertIn('"Cache-Control":"private, no-store"',viewer)
if __name__=="__main__":unittest.main()
