"""Independent static verification of owner-locked legacy 108/47 reconciliation.

Only validates exact traceability, not runtime acceptance. The 155 new source
tests have their own frozen manifest and are exercised across phases.
"""
import json,pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def data(p):return json.loads((ROOT/p).read_text(encoding="utf8"))
class Source10847(unittest.TestCase):
 def test_original_complete_decision_distribution(self):
  d=data("docs/analysis/PH09_LEGACY_108_47_TRACEABILITY.json")
  for name,n,wanted in [
   ("requirements",108,{"RETAIN":34,"UPDATE":62,"REPLACE":10,"RETIRE":2}),
   ("tests",47,{"RETAIN":22,"UPDATE":13,"REPLACE":11,"RETIRE":1})
  ]:
   rows=d[name]
   self.assertEqual(len(rows),n)
   self.assertEqual(len({x["legacyId"] for x in rows}),n)
   self.assertEqual({k:sum(x["resolution"]==k for x in rows) for k in wanted},wanted)
   for x in rows:
    with self.subTest(source=x["legacyId"]):
     self.assertTrue(x["legacyId"])
     self.assertTrue(x["owner"])
     self.assertTrue(x["reason"])
     self.assertTrue(x["currentRule"] if name=="requirements" else x["currentExpected"])
     if name=="requirements" and x["resolution"]!="RETIRE":
      self.assertTrue(x["successorRequirement"])
     if name=="tests":
      self.assertTrue(x["successorTest"])
  self.assertEqual(d["unresolved"],0)
  self.assertEqual(d["traceabilityType"],"DESIGN_RECONCILIATION_ONLY")
  self.assertEqual(d["fullOperationalAcceptance"],"NOT_ISSUED")
 def test_source155_and_phase9_38_still_lockstep(self):
  a=data("docs/analysis/ACCEPTANCE_IDS.json")
  b=data("docs/analysis/PH09_OFFICIAL_SOURCE38.json")
  self.assertEqual(len(a),155)
  self.assertEqual(len(b["cases"]),38)
  self.assertEqual([x["id"] for x in a[117:]],[x["id"] for x in b["cases"]])
 def test_no_cash_wallet_route_in_actual_nest_portal(self):
  module=(ROOT/"services/api/src/module.ts").read_text(encoding="utf8")
  # No HTTP handler may offer a user cash-wallet balance or withdrawal.
  self.assertIsNone(re.search(r'@(Get|Post|Patch|Put|Delete)\\(\\s*["\\\']([^"\\\']*/)?(?:wallet|cash-wallet|withdraw)(?:/|["\\\'])',module,re.I))
if __name__=="__main__":
 unittest.main()
