import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
class FoundationTests(unittest.TestCase):
  def test_source_pin_and_file_count(self):
    d=json.loads((ROOT/"docs/source/SOURCE_BASELINE.json").read_text())
    self.assertEqual(d["repository"],"tajikinews-design/tto-national-platform")
    self.assertEqual(d["pinned_commit"],"5eb6be8edfbb61f2eca740a42c30f572b493f023")
    self.assertEqual(len(d["files"]),15)
    self.assertEqual(len({f["path"] for f in d["files"]}),15)

  def test_all_23_specifications_indexed_not_completed(self):
    c=json.loads((ROOT/"docs/analysis/CHILD_CATALOG.json").read_text())
    self.assertEqual(len(c),23)
    self.assertEqual({x["id"] for x in c},{f"CHILD-{i:02d}" for i in range(1,24)})
    self.assertTrue(all(x["implementation"]=="NOT_STARTED" for x in c))

  def test_all_three_surfaces_and_shared_style(self):
    for slug in ("shareholder","cooperative-management","national-admin"):
      p=ROOT/"apps"/slug/"index.html"
      self.assertTrue(p.is_file())
      s=p.read_text()
      self.assertIn('dir="rtl"',s)
      self.assertIn("assets/",s)
    self.assertTrue((ROOT/"packages/ui/assets/ui.css").is_file())

  def test_canonical_navigation_and_no_fake_metrics(self):
    s=(ROOT/"packages/ui/assets/app.js").read_text()
    for i in range(1,12):self.assertIn(f"NAV-{i:02d}",s)
    self.assertIn("داده‌ای برای نمایش موجود نیست",s)
    self.assertIn("—",s)
    self.assertNotIn("fetch(",s)
    self.assertNotIn("XMLHttpRequest",s)

  def test_production_is_forbidden(self):
    d=json.loads((ROOT/"status/PHASE_GATES.json").read_text())
    self.assertFalse(d["production_authorized"])
    self.assertEqual(d["production_host"],"ArvanCloud")
    self.assertNotEqual(d["phases"]["PHASE-10"]["status"],"GREEN")
    self.assertNotEqual(d["phases"]["PHASE-11"]["status"],"GREEN")

  def test_acceptance_identifiers_are_index_only(self):
    ids=json.loads((ROOT/"docs/analysis/ACCEPTANCE_IDS.json").read_text())
    self.assertEqual(len(ids),155)
    self.assertEqual(len({x["id"] for x in ids}),155)
    self.assertTrue(all(x["status"]=="NOT_RUN" for x in ids))

  def test_phase00_evidence_is_recorded(self):
    d=json.loads((ROOT/"status/PHASE_GATES.json").read_text())
    self.assertEqual(d["phases"]["PHASE-00"]["status"],"GREEN")
    self.assertGreaterEqual(len(d["phases"]["PHASE-00"]["evidence"]),3)
    self.assertEqual(d["phases"]["PHASE-01"]["status"],"IN_PROGRESS")

  def test_preview_build(self):
    r=subprocess.run([sys.executable,str(ROOT/"scripts/build_preview.py")],capture_output=True,text=True)
    self.assertEqual(r.returncode,0,r.stdout+r.stderr)
    for slug in ("shareholder","cooperative-management","national-admin"):
      self.assertTrue((ROOT/"dist"/slug/"index.html").is_file())
    self.assertTrue((ROOT/"dist/assets/app.js").is_file())
    self.assertTrue((ROOT/"dist/assets/ui.css").is_file())

if __name__=="__main__":unittest.main()
