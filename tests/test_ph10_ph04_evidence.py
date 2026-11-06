"""PH04 source-ID evidence checker must never accept partial or forged marker."""
import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/"scripts/ci/ph10-ph04-exact-evidence.py"
s=importlib.util.spec_from_file_location("ph04source", P)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class PH04Evidence(unittest.TestCase):
 def test_source_count_and_names_stay_frozen(self):
  a,b=m.frozen_check()
  self.assertEqual(len(a),16)
  self.assertEqual([x["id"] for x in a],list(m.AUTH)+list(m.TENANT))
  self.assertEqual([x["id"] for x in b],[x["id"] for x in a])
 def test_fail_closed_on_source_echo_and_partial_marker(self):
  marker=m.AUTH["CORE-AUTH-AT-005"]
  self.assertTrue(m.exact_marker(marker+"\n",marker))
  self.assertFalse(m.exact_marker("console.log('"+marker+"')",marker))
  self.assertFalse(m.exact_marker(marker[:-4]+"\n",marker))
  self.assertFalse(m.exact_marker("not "+marker,marker))
 def test_tenant_partial_sequential_not_race(self):
  p=m.TENANT["CORE-TENANT-AT-003"][1]
  self.assertTrue(m.exact_marker(p,p))
  self.assertFalse(m.exact_marker("CORE-TENANT-AT-003_PARTIAL_SEQUENTIAL_NOT_CONCURRENT",p))
 def test_local_runtime_denied(self):
  from unittest.mock import patch
  with patch.dict("os.environ",{"CI":"false","TTO_PH10_FROZEN55_DISPOSABLE":"true"}):
   with self.assertRaisesRegex(AssertionError,"CI_ONLY"):
    m.metadata()

if __name__=="__main__":unittest.main()
