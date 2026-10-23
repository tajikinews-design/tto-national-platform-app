"""Fail-closed structure checks for cross-platform OCI runtime probe."""
from pathlib import Path
import unittest

DIR=Path(__file__).parent
class TestOciProbeTransport(unittest.TestCase):
    def test_windows_uses_copied_file_not_multiline_eval(self):
        ps=(DIR/"local-release-helper.ps1").read_text(encoding="utf-8")
        self.assertIn('node /tmp/tto-oci-runtime-smoke.mjs',ps)
        self.assertIn('Docker-Step ("Copy OCI probe " + $label)',ps)
        self.assertIn('"--network","none"',ps)
        self.assertNotIn('node --input-type=module -e $js',ps)
        self.assertIn('TTO_RELEASE_OCI_RUNTIME_FAILED_',ps)

    def test_probe_is_local_and_fail_closed(self):
        js=(DIR/"oci-runtime-smoke.mjs").read_text(encoding="utf-8")
        self.assertIn("http://127.0.0.1:3000/",js)
        self.assertIn('redirect:"manual"',js)
        self.assertIn('response.status === 200',js)
        self.assertIn('dir="rtl"',js)
        self.assertIn('\\u062f\\u0627\\u062f\\u0647',js)
        self.assertIn('process.exitCode = 1',js)
        self.assertTrue((DIR/"oci-runtime-smoke.test.mjs").is_file())
