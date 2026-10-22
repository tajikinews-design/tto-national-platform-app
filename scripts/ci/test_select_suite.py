import unittest
from scripts.ci.select_suite import suite
class AdaptiveGateTests(unittest.TestCase):
 def test_lite(self):
  self.assertEqual(suite("pull_request","synchronize","true","",["README.md","docs/reports/a.md"]),"lite")
 def test_sensitive_paths(self):
  for p in ["database/migrations/0010.sql","docs/analysis/policy.md","docs/source/contracts.json",
            "services/api/src/module.ts","apps/shareholder/app/page.tsx",
            "packages/contracts/README.md",".github/workflows/work.yml","infra/arvan/base.yaml"]:
   with self.subTest(p=p):self.assertEqual(suite("pull_request","synchronize","true","",[p]),"core")
 def test_empty_and_mixed(self):
  self.assertEqual(suite("pull_request","opened","true","",[]),"core")
  self.assertEqual(suite("pull_request","synchronize","true","",["README.md","database/x.sql"]),"core")
 def test_release(self):
  self.assertEqual(suite("pull_request","ready_for_review","true","",["README.md"]),"release")
  self.assertEqual(suite("pull_request","synchronize","false","",["README.md"]),"release")
  self.assertEqual(suite("workflow_dispatch","","","release",[]),"release")
  self.assertEqual(suite("workflow_dispatch","","","core",[]),"core")
 def test_fail_closed(self):
  for args in [("push","","true","",["README.md"]),("pull_request","synchronize","","",["README.md"]),("workflow_dispatch","","","lite",[])]:
   with self.assertRaises(ValueError):suite(*args)
  self.assertEqual(suite("pull_request","synchronize","true","",["/docs/reports/a.md"]),"core")
if __name__=="__main__":unittest.main()
