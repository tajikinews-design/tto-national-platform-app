#!/usr/bin/env python3
"""Exact-run traceability for three real portal browser source slices."""
import json,os,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MAP=[
 ("shareholder","NAV-06","LEARN-AT-001","MEMBER"),
 ("shareholder","NAV-07","MKT-AT-006","MEMBER"),
 ("shareholder","NAV-08","PROJ-AT-005","MEMBER"),
 ("shareholder","NAV-10","IMPACT-AT-004","MEMBER"),
 ("cooperative-management","NAV-04","COMM-AT-005","COOPERATIVE_MANAGER"),
 ("cooperative-management","NAV-05","SUP-AT-001","COOPERATIVE_MANAGER"),
 ("cooperative-management","NAV-07","MKT-AT-006","COOPERATIVE_MANAGER"),
 ("cooperative-management","NAV-08","PROJ-AT-005","COOPERATIVE_MANAGER"),
 ("cooperative-management","NAV-09","TRN-AT-006","COOPERATIVE_MANAGER"),
 ("cooperative-management","NAV-10","GRC-AT-001","COOPERATIVE_MANAGER"),
 ("national-admin","NAV-09","CORE-DOC-AT-008","JIT_OPERATOR")]
ROLES=("SHAREHOLDER_MEMBER","COOP_MANAGER","COOP_MEMBER",
       "NATIONAL_OPERATOR","NATIONAL_MEMBER","NATIONAL_MANAGER")
NEEDED=(
 "PH10_ROLE_BROWSER_MANAGER_MEMBER_ENROLLMENT_DENIED_PASS",
 "PH10_ROLE_BROWSER_ALL_THREE_PORTAL_ANON_BFF_DENIES_PASS",
 "PH10_BROWSER_LEARN_AT001_ENROLLED_NOT_COURSE_COMPLETED_PASS",
 "PH10_SHAREHOLDER_BROWSER_ENROLLMENT_RELOAD_PERSISTENCE_PASS",
 "PH09_REAL_NEST_GRC_MANAGER_NO_WHISTLEBLOWER_HTTP_PASS",
 "PH10_GRC_AT001_BFF_MANAGER_BLOCK_MEMBER_ANON_FOREIGN_DENIED_PASS",
 "PH10_BROWSER_GRC_AT001_MANAGER_CLICK_BFF_NEST_PG17_BLOCK_NO_MUTATION_PASS",
 "PH10_NATIONAL_JIT_INDEPENDENT_ROLE_TENANT_CLASSIFICATION_PASS")
def check_sources():
 source={x["id"]:x for x in json.loads((ROOT/"docs/analysis/PH10_OFFICIAL_155_SCENARIOS.json").read_text())["cases"]}
 assert len(source)==155
 assert len(MAP)==len(set((p,n) for p,n,_,_ in MAP))==11
 for portal,nav,id,role in MAP:
  assert source[id]["sourceScenario"] and source[id]["sourceExpected"]
  route=(ROOT/"apps"/portal/"app/api/tenants/[tenantId]/ph10/[moduleId]/route.ts").read_text()
  assert ('"'+nav+'":{path:' in route or (portal=="national-admin" and 'moduleId!=="NAV-09"' in route))
 return source
def make(log,sha,run):
 assert re.fullmatch("[a-f0-9]{40}",sha) and run.isdigit()
 source=check_sources()
 lines={x.strip() for x in log.splitlines()}
 markers=["PH10_ROLE_BROWSER_"+r+"_SOURCE_SCOPE_PASS" for r in ROLES]
 markers+=["PH10_ROLE_BROWSER_"+r+"_FOREIGN_TENANT_DENIED_PASS" for r in ("SHAREHOLDER_MEMBER","COOP_MANAGER","NATIONAL_OPERATOR")]
 markers+=list(NEEDED)
 for marker in markers: assert marker in lines, "BROWSER_PROOF_MISSING:"+marker
 rows=[]
 for portal,nav,id,role in MAP:
  actual=(portal,nav) in {("shareholder","NAV-06"),("cooperative-management","NAV-10"),("national-admin","NAV-09")}
  command=(portal,nav)==("shareholder","NAV-06")
  policy=(portal,nav)==("cooperative-management","NAV-10")
  rows.append(dict(portal=portal,navId=nav,role=role,sourceAcceptanceId=id,
   originalScenario=source[id]["sourceScenario"],
   originalExpected=source[id]["sourceExpected"],
   evidenceScope="SCOPED_REAL_CHROMIUM_COMMAND_PG17" if command else
    "SCOPED_REAL_CHROMIUM_GRC_POLICY_BLOCK_PG17_NO_MUTATION" if policy else
    "RELATED_CHROMIUM_READ_ONLY" if actual else "STATIC_BFF_RELATION_ONLY",
   realChromiumReadVerified=actual,sourceSpecificBrowserCommandVerified=command,
   sourceSpecificPolicyPrecheckVerified=policy,
   fullOriginalSourceJourneyAccepted=False,formalAcceptance="NOT_ACCEPTED"))
 return dict(schemaVersion="1",run={"commitSha":sha,"runId":run,"job":"source-sql-and-actual-api"},
  realBrowserPortalSources=3,actualBrowserRolePaths=6,declaredBffSourceBindings=11,
  realSourceSpecificCommands=1,grcArticle129SourcePolicyPrecheck=1,
  full155UserJourneysAccepted=False,release="HOLD",
  cases=rows,assertedMarkers=markers)
if __name__=="__main__":
 try:
  check_sources()
  if "--validate" in sys.argv:print("PH10_11_BFF_SOURCE_RELATIONS_VALIDATED_STATIC_ONLY")
  else:
   assert os.environ["CI"]=="true" and not os.getenv("VERCEL")
   assert os.environ["TTO_PH10_FROZEN55_DISPOSABLE"]=="true"
   log=Path(sys.argv[2]).resolve()
   assert log.parent==Path(os.environ["RUNNER_TEMP"]).resolve() and log.name=="ph08-real-http-stdout.log"
   d=make(log.read_text(),os.environ["GITHUB_SHA"],os.environ["GITHUB_RUN_ID"])
   p=ROOT/"ph10-artifacts/ph10_three_portal_role_source_evidence.json"
   p.parent.mkdir(exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
   print("PH10_PORTAL_3_CHROMIUM_SOURCES_6_ACTORS_GRC001_POLICY_BLOCK_LEARN001_COMMAND_FULL155_HOLD")
 except (AssertionError,KeyError,IndexError,OSError,ValueError) as e:
  print("PH10_ROLE_SOURCE_GATE_FAIL_CLOSED",str(e),file=sys.stderr);sys.exit(1)
