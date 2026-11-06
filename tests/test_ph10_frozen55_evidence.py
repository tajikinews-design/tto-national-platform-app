"""Offline negative control for exact marker validation, not PG17 integration."""
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[1] / "scripts/ci/ph10-frozen55-exact-evidence.py"
spec = importlib.util.spec_from_file_location("frozen55", MODULE)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class EvidenceTruth(unittest.TestCase):
    def test_ph05_exact_signal(self):
        p = "PH05_CORE_DOC_AT001_SCANNER_BLOCKED_PHYSICAL_PROOF_PASS"
        self.assertTrue(gate.marker_found(p + "\n", p))
        self.assertFalse(gate.marker_found("SELECT '" + p + "' AS signal;", p))
        self.assertFalse(gate.marker_found("echo " + p, p))
        self.assertFalse(gate.marker_found("not " + p, p))
        self.assertFalse(gate.marker_found(p[:-1], p))

    def test_partial_prefix_only_with_completed_pass(self):
        prefix = "PH05_CORE_INT_AT001_"
        self.assertTrue(gate.marker_found("# PH05_CORE_INT_AT001_SIGNED_SANDBOX_REPLAY_PASS", prefix))
        self.assertFalse(gate.marker_found("# PH05_CORE_INT_AT001_SIGNED_SANDBOX_REPLAY_FAIL", prefix))
        self.assertFalse(gate.marker_found("# PH05_CORE_INT_AT010_SIGNED_SANDBOX_REPLAY_PASS", prefix))
        self.assertFalse(gate.marker_found("# console.log('PH05_CORE_INT_AT001_X_PASS')", prefix))

    def test_ph06_source_exactness(self):
        p = "PH06_SHARE_AT008_"
        self.assertTrue(gate.marker_found("PH06_SHARE_AT008_NO_CASH_WALLET_NO_SETTLEMENT_PASS", p))
        self.assertFalse(gate.marker_found("PH06_SHARE_AT007_OWN_CASE_SCOPE_AND_APP_DENY_PASS", p))
        self.assertFalse(gate.marker_found("PH06_SHARE_AT008_NO_CASH_WALLET_NO_SETTLEMENT_PASS EXTRA", p))

    def test_disposable_guard_is_hard_fail_locally(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"CI": "false", "TTO_PH10_FROZEN55_DISPOSABLE": "true"}):
            with self.assertRaisesRegex(AssertionError, "CI_REQUIRED"):
                gate.verify_disposable_container()


if __name__ == "__main__":
    unittest.main()
