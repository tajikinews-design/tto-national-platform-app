"""PH10 immutable-source census and *evidence class* register; never certify 155 E2E from SQL."""
import collections,json,pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name): return json.loads((ROOT/name).read_text(encoding="utf-8"))
BASE="docs/analysis/"
SOURCE=load(BASE+"ACCEPTANCE_IDS.json")
ROUTING=[("PH04",16),("PH05",24),("PH06",15),("PH07",26),("PH08",36),("PH09",38)]
ARTIFACT=ROOT/"ph10-artifacts"
SQL_BY_GROUP={
 "PH06": lambda c: "tests/sql/ph06-member-share-frozen15.sql",
 "PH07": lambda c: "tests/sql/ph07-"+{"GOV":"governance","COMM":"communications","SUP":"support","TRN":"transparency"}[c["id"].split("-")[0]]+"-acceptance.sql",
 "PH08": lambda c: "tests/sql/ph08-"+{"PROJ":"projects","VOICE":"member-voice","LEARN":"academy-events","BEN":"member-benefits","MKT":"marketplace","PROC":"procurement"}[c["id"].split("-")[0]]+"-acceptance.sql",
 "PH09": lambda c: "tests/sql/ph09-"+{"OPP":"opportunities","IMPACT":"impact","GRC":"grc","NI":"network-intelligence","DG":"data-governance","OPS":"operations"}[c["id"].split("-")[0]]+"-acceptance.sql"
}
def current_cases():
 evidence=load(BASE+"PH05_24_EXECUTABLE_SCOPED_COVERAGE.json")
 lookup={c["sourceTestId"]:c for c in evidence["details"]}
 assert len(lookup)==24
 result=[]; i=0
 for phase,size in ROUTING:
  for x in SOURCE[i:i+size]:
   id=x["id"]
   if phase=="PH04":
    path="docs/analysis/PH04_LOCKED_155_SOURCE_EXECUTION_MATRIX.json"
    level="RELATED_OR_PARTIAL_HISTORICAL_EVIDENCE_NOT_EXECUTED_IN_THIS_RUN"
   elif phase=="PH05":
    path=lookup[id]["codeAssertionFile"]
    level="SOURCE_SPECIFIC_SYNTHETIC_SQL_FILE_EXISTS_NOT_YET_EXECUTED"
   else:
    path=SQL_BY_GROUP[phase](x)
    level="SOURCE_SPECIFIC_SYNTHETIC_SQL_FILE_EXISTS_NOT_YET_EXECUTED"
   p=ROOT/path
   if not p.is_file():raise AssertionError(id+": missing "+path)
   data=p.read_text(encoding="utf-8")
   if phase=="PH05" and lookup[id]["signalPrefix"] not in data:
    raise AssertionError(id+": missing source signal in "+path)
   if phase in ("PH07","PH08","PH09"):
    marker=phase+"_"+id.replace("-AT-","_AT").replace("-","_")
    # Special cases OPS have separate output from CI.
    if marker not in data and not (id in ("OPS-AT-004","OPS-AT-005","OPS-AT-008")):
     raise AssertionError(id+": no source signal "+marker+" in "+path)
   result.append({"id":id,"phase":phase,"syntheticAssertionFile":path,
    "evidenceClass":level,"latestExactHeadRun":None,
    "liveUserJourneyProved":False,"authenticLegalSourceProved":False,
    "fullPortalE2EProved":False,"reviewerHumanSignoff":None,
    "formalAcceptance":"NOT_ACCEPTED"})
  i+=size
 assert i==155
 return result
class Phase10SourceAudit(unittest.TestCase):
 def test_frozen155_complete_stable_and_unique(self):
  self.assertEqual(len(SOURCE),155)
  self.assertEqual(len(set(x["id"] for x in SOURCE)),155)
  entries=current_cases()
  self.assertEqual([e["id"] for e in entries],[s["id"] for s in SOURCE])
  self.assertEqual(dict(collections.Counter(x["phase"] for x in entries)),dict(ROUTING))
 def test_all_155_have_exact_official_scenario_and_expected(self):
  original=load(BASE+"PH10_OFFICIAL_155_SCENARIOS.json")
  expected=original["cases"]
  self.assertEqual(original["sourceCount"],155)
  self.assertEqual([row["id"] for row in expected],[row["id"] for row in SOURCE])
  self.assertEqual(len(set(x["id"] for x in expected)),155)
  for row in expected:
   with self.subTest(id=row["id"]):
    self.assertTrue(row["sourceScenario"].strip())
    self.assertTrue(row["sourceExpected"].strip())
  self.assertEqual(original["formalOperationalAcceptance"],"NOT_ISSUED")
 def test_no_unearned_green(self):
  for x in current_cases():
   with self.subTest(id=x["id"]):
    self.assertEqual(x["formalAcceptance"],"NOT_ACCEPTED")
    self.assertFalse(x["fullPortalE2EProved"])
 def test_legacy_complete_but_not_execution(self):
  d=load(BASE+"PH09_LEGACY_108_47_TRACEABILITY.json")
  self.assertEqual((len(d["requirements"]),len(d["tests"])),(108,47))
  self.assertEqual(d["traceabilityType"],"DESIGN_RECONCILIATION_ONLY")
 def test_three_portals_not_assumed_complete(self):
  for portal in ("shareholder","national-admin","cooperative-management"):
   page=(ROOT/"apps"/portal/"app/modules/[id]/page.tsx").read_text()
   self.assertIn("notFound()",page)
  for portal in ("national-admin","cooperative-management"):
   page=(ROOT/"apps"/portal/"app/modules/[id]/page.tsx").read_text()
   self.assertIn("module-status",page)
   if portal=="national-admin":
    self.assertIn('TenantScopePicker surface="national"',page)
    self.assertNotIn("OtpLogin",page)
   else:
    self.assertIn('PortalSessionGate surface="cooperative"',page)
    self.assertNotIn("OtpLogin",page)
    self.assertIn("TenantScopePicker",page)
 def test_emit_inspectable_census(self):
  ARTIFACT.mkdir(exist_ok=True)
  entries=current_cases()
  (ARTIFACT/"ph10_155_source_census.json").write_text(
   json.dumps({"phase":"PH10","evidenceProvenance":"EXACT_SOURCE_CODE_EXISTS_ONLY",
    "currentRun":None,"sourceCaseCount":155,"all155UserJourneysAccepted":False,
    "formalReleaseGate":"BLOCKED","cases":entries},ensure_ascii=False,indent=2)+"\n")
  counts=dict(collections.Counter(x["evidenceClass"] for x in entries))
  print("PH10_155_IMMUTABLE_SOURCE_ID_AUDIT_PASS",counts)
if __name__=="__main__":unittest.main()