"""NAV02 preview-only forms: traceability and no-PII-network safety guards."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(path):return (ROOT/path).read_text(encoding="utf-8")
class MembersDraftFormContracts(unittest.TestCase):
 def test_independent_routes_and_approved_shell(self):
  page=read("apps/cooperative-management/app/c/[slug]/members/[section]/page.tsx")
  shell=read("packages/ui/src/index.tsx")
  entry=read("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  for anchor in ('section!=="add"&&section!=="shares"','moduleId="NAV-02"','<CooperativeEntryGate',
    'ownerMembers={content}','<PortalSessionGate','<PortalShell'):
   self.assertIn(anchor,page)
  for anchor in ('href={basePath+"/members/add"}','href={basePath+"/members/shares"}',
    'membersSection==="add"','membersSection==="shares"','className="tto-settings-tree"'):
   self.assertIn(anchor,shell)
  for anchor in ('workspace.staff!==true?ownerMembers','NAV-02','membersSection={membersSection}'):
   self.assertIn(anchor,entry)
  self.assertIn('if(activeId==="NAV-02")redirect(',read("apps/cooperative-management/app/c/[slug]/modules/[moduleId]/page.tsx"))
 def test_all_requested_person_and_share_fields(self):
  ui=read("apps/cooperative-management/app/c/[slug]/members/members-workspace.tsx")
  for title in ("آقا","خانم","شرکت","سازمان","اداره"):
   self.assertIn(title,ui)
  for field in ('member-title','member-full-name','member-group','member-national',
                'member-father','member-birth-id','member-birth-date',
                'member-birthplace','member-telephone','member-mobile',
                'member-postal','member-address','member-photo','member-search',
                'share-initial','share-committed','share-face','share-paid',
                'share-date','share-ref'):
   self.assertIn(field,ui)
  self.assertIn('positiveInteger(',ui)
  self.assertIn('validPersianDate(',ui)
  self.assertIn('input type="checkbox"',ui)
 def test_browser_only_storage_without_api_traffic(self):
  files=["apps/cooperative-management/app/c/[slug]/members/members-workspace.tsx",
  "apps/cooperative-management/app/c/[slug]/members/draft-store.ts"]
  for f in files:
   s=read(f)
   for token in ("localStorage","sessionStorage","indexedDB","fetch(","XMLHttpRequest",
                 "navigator.sendBeacon","FormData(", "tto.share_ownership_ledger"):
    self.assertNotIn(token,s,msg=f+" accidentally includes "+token)
  store=read(files[1])
  for token in ('const buckets=new Map','export function clearDrafts','personId',
                'function bucket(slug:string)'):
   self.assertIn(token,store)
  self.assertIn('URL.revokeObjectURL',read(files[0]))
 def test_no_wildcard_bypass_and_uniform_fields(self):
  proxy=read("apps/cooperative-management/proxy.ts")
  self.assertIn('path==="/c/"+slug+"/members/add"',proxy)
  self.assertIn('path==="/c/"+slug+"/members/shares"',proxy)
  self.assertNotIn('"/api/members"',proxy)
  style=read("apps/cooperative-management/app/management-settings.css")
  self.assertIn('height:var(--tto-field-height)',style)
  self.assertIn('.tto-members-warning',style)
  self.assertIn('.tto-members-page',style)
if __name__=="__main__":unittest.main()
