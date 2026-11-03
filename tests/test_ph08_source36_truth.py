import json
import pathlib
import unittest
root=pathlib.Path(__file__).resolve().parents[1]
class Phase8(unittest.TestCase):
 def test_source_manifest(self):
  original=json.loads((root/'docs/analysis/ACCEPTANCE_IDS.json').read_text())
  manifest=json.loads((root/'docs/analysis/PH08_OFFICIAL_SOURCE36.json').read_text())
  ids=[v['id'] for v in original[81:117]]
  seen=[v['id'] for v in manifest['cases']]
  self.assertEqual(len(original),155)
  self.assertEqual(len(seen),36)
  self.assertEqual(ids,seen)
  self.assertEqual(len(set(ids)),36)
 def test_six_physical_source_suites(self):
  obj=json.loads((root/'docs/analysis/PH08_OFFICIAL_SOURCE36.json').read_text())
  for c in obj['cases']:
   with self.subTest(case=c['id']):
    p=root/c['sqlFile']
    self.assertTrue(p.is_file())
    signal='PH08_'+c['id'].replace('-AT-','_AT').replace('-','_')+'_'
    self.assertIn(signal,p.read_text())
    self.assertEqual(c['fullSourceE2E'],'NOT_ACCEPTED')
    self.assertTrue(c['scenario'])
    self.assertTrue(c['expected'])
if __name__=='__main__':
 unittest.main()