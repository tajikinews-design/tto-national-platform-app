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
  self.assertIn("nav:has(> .tto-animated-tree)",CSS)
  self.assertIn("flex-direction:column!important",CSS)
  self.assertIn(".tto-submenu-motion[hidden]{display:none!important}",CSS)
  self.assertIn("grid-template-rows:none!important",CSS)
  self.assertIn("display:block!important;visibility:visible",CSS)
  self.assertIn("hidden={!expanded}",src("packages/ui/src/animated-sidebar-group.tsx"))
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
 def test_officers_use_persian_calendar_and_iso_storage_boundary(self):
  picker=src("apps/cooperative-management/app/c/[slug]/members/jalali-birth-picker.tsx")
  self.assertEqual(OFFICER.count("<JalaliDatePicker"),3)
  self.assertNotIn('type="date"',OFFICER)
  self.assertNotIn("میلادی موقت",OFFICER)
  self.assertIn('minDate={form.startDate}',OFFICER)
  self.assertIn('jalaliToGregorianISO(form.startDate)',OFFICER)
  self.assertIn('jalaliToGregorianISO(form.endDate)',OFFICER)
  self.assertIn('jalaliToGregorianISO(form.gazetteDate)',OFFICER)
  self.assertIn('gregorianISOToJalali(value.slice(0,10))',OFFICER)
  self.assertIn('displayJalaliDate(item.startDate)',OFFICER)
  self.assertIn('displayJalaliDate(item.endDate)',OFFICER)
  self.assertIn("export function JalaliDatePicker(",picker)
  self.assertIn("allowFuture",picker)
  self.assertIn("outsideRange(day)",picker)
  self.assertIn("gregorianISOToJalali",picker)
 def test_member_combobox_server_query_without_separate_search(self):
  picker=src("apps/cooperative-management/app/c/[slug]/settings/officer-member-picker.tsx")
  search=src("apps/cooperative-management/app/api/commerce/nav02/officers/member-search/route.ts")
  backend=src("services/api/src/module.ts")
  proxy=src("apps/cooperative-management/proxy.ts")
  self.assertIn("<OfficerMemberPicker",OFFICER)
  self.assertNotIn("جست‌وجو در فهرست اعضا",OFFICER)
  self.assertIn('role="combobox"',picker)
  self.assertIn('role="listbox"',picker)
  self.assertIn("encodeURIComponent(q)",picker)
  self.assertIn("ctrl.abort()",picker)
  self.assertIn("member-search",search)
  self.assertIn("trustedBackendHeaders(req)",search)
  self.assertIn("member-search",backend)
  self.assertIn("this.nav02IntakeList(auth,slug)",backend)
  self.assertIn("eligible.slice(0,20)",backend)
  self.assertIn("/api/commerce/nav02/officers/member-search",proxy)
  self.assertIn("officerUnavailable",OFFICER)
 def test_four_fields_per_row_and_visible_governance_actions(self):
  self.assertIn("tto-officer-gazette-row",OFFICER)
  self.assertIn("grid-template-columns:repeat(4,minmax(0,1fr))",OFCSS)
  for key in ("gazetteName","gazetteDate","gazetteIssue","noticeNumber"):
   self.assertIn(key,OFFICER)
  for key in ("نام و نام خانوادگی","حدود امضا","تاریخ شروع سمت","تاریخ پایان سمت"):
   self.assertIn(key,OFFICER)
  for name in ('name="edit"','name="history"','name="delete"','name="download"'):
   self.assertIn(name,OFFICER)
  self.assertIn('value={form.ceoSource}',OFFICER)
  self.assertIn("وضعیت عضویت",OFFICER)
 def test_scanned_officer_documents_and_owner_audit_are_protected(self):
  sql=src("database/migrations/9999zf_nav02_officer_documents_archive.sql")
  api=src("services/api/src/module.ts")
  post=src("apps/cooperative-management/app/api/commerce/nav02/officers/documents/route.ts")
  download=src("apps/cooperative-management/app/api/commerce/nav02/officers/documents/download/route.ts")
  archive=src("apps/cooperative-management/app/api/commerce/nav02/officers/archive/route.ts")
  for term in ("FORCE ROW LEVEL SECURITY","scan_verdict='CLEAN'","nav02_member_owner_order(p_slug)",
               "ARCHIVE_DRAFT_WITH_AUDIT_ACKNOWLEDGED","nav02_office_holder_revision_audit",
               "nav02_officer_document_fetch_owner"):
   self.assertIn(term,sql)
  for term in ("scanQuarantineBytes(bytes)","ATTACHMENT_KEY","createCipheriv(\"aes-256-gcm\"",
               "OFFICER_DOCUMENT_MALWARE_REJECTED","OFFICER_DOCUMENT_INTEGRITY_INVALID"):
   self.assertIn(term,api)
  for text in (post,archive):
   self.assertIn("ORIGIN_REQUIRED",text)
   self.assertIn("trustedBackendHeaders(req)",text)
  self.assertIn('Content-Disposition',download)
  self.assertIn('application/octet-stream',download)
  self.assertIn("saveDocument(file,storedId)",OFFICER)
  self.assertIn("downloadDocument(item.id,doc)",OFFICER)
  self.assertIn("archiveTarget",OFFICER)

 def test_inline_shahkar_and_no_global_preview_banner(self):
  nav=src("packages/ui/src/index.tsx")
  motion=src("packages/ui/src/animated-sidebar-group.tsx")
  style=src("apps/cooperative-management/app/member-intake.css")
  self.assertNotIn("استعلام شاهکار در فرم ثبت عضو",FORM)
  self.assertNotIn("پس از واردکردن کد ملی و شماره همراه",FORM)
  self.assertEqual(FORM.count('className="tto-shahkar-inline"'),2)
  self.assertIn('aria-label={identityChecking?',FORM)
  self.assertIn('onClick={()=>void verifyIdentity()}',FORM)
  self.assertIn('identityVerified||identityChecking',FORM)
  self.assertIn(".tto-shahkar-inline>.tto-shahkar-icon:focus-visible",style)
  self.assertNotIn("عملیات رسمی و مالی تا احراز اختیار قانونی مدیر غیرفعال است.",nav)
  self.assertIn('aria-label="مسیر صفحه"',nav)
  self.assertIn("setExpanded(active)",motion)
  self.assertIn("setExpanded(v=>!v)",motion)
  self.assertIn('e.key==="Escape"',motion)

if __name__=="__main__":unittest.main()
