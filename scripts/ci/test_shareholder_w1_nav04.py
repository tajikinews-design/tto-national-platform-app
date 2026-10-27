"""NAV04 review-only assembly/election UI source-contract checks (NO real votes)."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/"apps/shareholder/app/review/interactive/nav-04"
FIX=(DIR/"assembly-fixtures.ts").read_text("utf-8")
UI=(DIR/"synthetic-assemblies.tsx").read_text("utf-8")
CSS=(DIR/"assemblies.css").read_text("utf-8")
PAGE=(DIR/"page.tsx").read_text("utf-8")
LAYOUT=(ROOT/"apps/shareholder/app/review/layout.tsx").read_text("utf-8")
DASH=(ROOT/"apps/shareholder/app/review/interactive/synthetic-dashboard.tsx").read_text("utf-8")
AST=(ROOT/"scripts/ci/verify-shareholder-tsx.cjs").read_text("utf-8")
SMOKE=(ROOT/"scripts/smoke-next-otp.mjs").read_text("utf-8")
PROTECTED=(ROOT/"packages/ui/src/shareholder-section-config.ts").read_text("utf-8")

class Nav04SyntheticAssemblies(unittest.TestCase):
 def test_01_source_denied_by_default(self):
  self.assertIn('useState<DemoSourceState>("UNVERIFIED")',UI)
  self.assertIn('const fake=mode==="DEMO_CONTENT"',UI)
  self.assertIn('{fake?<div className="w1a-content">',UI)
  self.assertIn('SOURCE_UNAVAILABLE',FIX+"\n"+UI)
  self.assertIn('مرجع رسمی هنوز تأیید نشده',UI)
  self.assertIn('نبود داده به معنی نبود مجمع یا انتخابات نیست',UI)
 def test_02_six_explicitly_fictional_records(self):
  self.assertEqual(len(re.findall(r'id:"DEMO-ASM-',FIX)),6)
  for typ in ('INVITATION','MINUTES','ELECTION_INFO','RESULT'):
   self.assertIn('"'+typ+'"',FIX)
  self.assertIn('داده کاملاً مصنوعی',UI)
  self.assertIn('DEMO-V1',FIX)
 def test_03_no_law_or_voting_eligibility_inferred(self):
  self.assertIn('legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false',FIX)
  self.assertEqual(FIX.count('legalReadiness:false,canVote:false'),6)
  for x in ('صلاحیت دعوت‌کننده','میزان حق رأی','نصاب','تعیین شود'):
   self.assertIn(x,UI)
  self.assertIn('اهلیت رأی‌دهنده، نوع رأی، نصاب',UI)
  self.assertIn('مجمع عمومی عادی سالیانه',FIX)
  self.assertIn('مجمع عمومی فوق‌العاده',FIX)
 def test_04_documents_are_metadata_only(self):
  self.assertIn('mockOnly:true,downloadEnabled:false',FIX)
  self.assertIn('بدون متن سند',FIX)
  self.assertIn('هیچ سند، امضا، تصویر یا لینک دانلود واقعی وجود ندارد',UI)
  self.assertNotIn('<a href={doc.',UI)
  self.assertNotIn('attachmentUrl',FIX)
 def test_05_no_mutating_buttons_or_real_providers(self):
  for forbidden in ('fetch(', 'axios','XMLHttpRequest','WebSocket(', 'localStorage',
    'sessionStorage','document.cookie','navigator.sendBeacon','process.env.',
    'submit(', 'method="POST"','/api/','<form','type="submit"','dangerouslySetInnerHTML'):
   with self.subTest(forbidden=forbidden):
    self.assertNotIn(forbidden,UI+"\n"+PAGE+"\n"+FIX)
  self.assertIn('ثبت رأی (غیرفعال)',UI)
  self.assertIn('تأیید حضور (غیرفعال)',UI)
  self.assertIn('انتشار نتیجه (غیرفعال)',UI)
  self.assertIn('disabled aria-disabled="true"',UI)
 def test_06_filter_switch_and_selection_only_affects_local_react(self):
  for token in ('const [filter,setFilter]=useState<Filter>("ALL")',
   'const [selectedId,setSelectedId]=useState(ASSEMBLY_FIXTURES[0].id)',
   'setSelectedId(record.id)', 'onClick={()=>selectFilter(tab.value)}',
   'aria-pressed={current.id===record.id}','aria-pressed={mode===item.id}'):
   self.assertIn(token,UI)
  self.assertIn('filter==="ALL"||record.recordType===filter',UI)
 def test_07_fixed_source_policy_and_protected_runtime_not_changed(self):
  self.assertIn('NAV-04',PROTECTED)
  self.assertIn('این پنل سامانه رسمی رأی‌گیری نیست',PROTECTED)
  self.assertIn('REFERENCE_REVIEW_GATES',UI)
  self.assertIn('تأیید مرجع قانونی دعوت',FIX)
  self.assertIn('حق رأی',UI)
 def test_08_review_only_route_and_navigation(self):
  self.assertIn('export const dynamic="force-static"',PAGE)
  self.assertIn('robots:{index:false,follow:false',LAYOUT)
  self.assertIn('index===3?"/review/interactive/nav-04"',DASH)
  for path in ('nav-04/page.tsx','nav-04/synthetic-assemblies.tsx','nav-04/assembly-fixtures.ts'):
   self.assertIn(path,AST)
  self.assertIn('"/review/interactive/nav-04"',SMOKE)
 def test_09_accessibility_and_mobile(self):
  for word in ('dir="rtl"','aria-live="polite"','role="status"',
    'aria-pressed={filter===tab.value}', 'role="group"'):
   self.assertIn(word,UI)
  for css in (':focus-visible','@media(max-width:680px)','@media(max-width:1050px)',
   'grid-template-columns:1fr','prefers-reduced-motion'):
   self.assertIn(css,CSS)
 def test_10_real_next_ssr_has_no_source_approval(self):
  self.assertIn('if(asm.status!==200)',SMOKE)
  self.assertIn('مجامع عمومی و انتخابات تعاونی',UI)
  self.assertIn('مرجع رسمی هنوز تأیید نشده',UI)
  self.assertIn('هیچ حق رأی',UI)
  self.assertNotIn('approvedSourceId=',UI)
 def test_11_no_real_election_person_or_party(self):
  for forbidden in ('nationalId','mobileNumber','partyId','tenantId','phoneNumber',
    'candidateFullName','ballotId','voteCount','quorumNumber'):
   with self.subTest(forbidden=forbidden):self.assertNotIn(forbidden,FIX+"\n"+UI)
  self.assertIn('هیچ نامزد یا رأی‌دهنده واقعی وجود ندارد',FIX)
if __name__=="__main__":unittest.main()
