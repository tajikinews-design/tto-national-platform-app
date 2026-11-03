import json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Phase09Start(unittest.TestCase):
 def test_original_155_to_child18_23(self):
  data=json.loads((ROOT/'docs/analysis/ACCEPTANCE_IDS.json').read_text())
  manifest=json.loads((ROOT/'docs/analysis/PH09_OFFICIAL_SOURCE38.json').read_text())
  self.assertEqual(len(data),155)
  self.assertEqual(len(manifest['cases']),38)
  self.assertEqual([v['id'] for v in data[117:155]],[v['id'] for v in manifest['cases']])
  self.assertEqual(len(set(v['id'] for v in manifest['cases'])),38)
 def test_no_premature_green(self):
  m=json.loads((ROOT/'docs/analysis/PH09_OFFICIAL_SOURCE38.json').read_text())
  for c in m['cases']:
   self.assertTrue(c['officialScenario'])
   self.assertTrue(c['officialExpected'])
   self.assertEqual(c['status'],'NOT_EXECUTED')
   self.assertEqual(c['formalAcceptance'],'NOT_GREEN')
if __name__=='__main__':unittest.main()