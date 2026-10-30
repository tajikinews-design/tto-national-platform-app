"""Guardrail: W1 loopback chain stays detached from application routes and live data."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

class TestW1NextNestPEPIsolation(unittest.TestCase):
    def test_01_test_harness_is_not_application_import(self):
        integration=(ROOT/"scripts/ci/w1-bff-nest-pep-chain.test.cjs").read_text(encoding="utf-8")
        self.assertIn('fromNext("next/server")',integration)
        self.assertIn('fromApi("@nestjs/core")',integration)
        self.assertIn('fromApi("@nestjs/platform-fastify")',integration)
        self.assertIn('"127.0.0.1"',integration)
        self.assertIn('"TTO_W1_CHAIN_LAB"',integration)
        self.assertIn('"TTO_W1_DENIED_FIXTURE_TOUCHES=0"',integration)
        self.assertNotIn('DATABASE_URL:',integration)
        self.assertNotIn('realShareholder',integration)
        self.assertNotIn('LIVE_TRANSFER',integration)
    def test_02_bridge_only_uses_existing_pep(self):
        bridge=(ROOT/"scripts/security/w1_isolated_http_bridge.py").read_text(encoding="utf-8")
        self.assertIn("from scripts.security.w1_pep_simulator import enforce",bridge)
        self.assertIn('"fixtureTouches": fixture.touches',bridge)
        self.assertIn('"hasActualRecord": False',bridge)
        self.assertIn('"canGrantPermission": False',bridge)
        self.assertNotIn("from services",bridge)
        self.assertNotIn("psycopg",bridge)
        self.assertNotIn("DATABASE_URL",bridge)
    def test_03_release_runner_gates_integration(self):
        runner=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
        self.assertIn("TTO_W1_CHAIN_LAB=1",runner)
        self.assertIn("node --test scripts/ci/w1-bff-nest-pep-chain.test.cjs",runner)
        self.assertIn("command -v python3",runner)
    def test_04_live_navigation_remains_unapproved(self):
        import json
        nav=json.loads((ROOT/"docs/analysis/NAVIGATION_CONTRACT.json").read_text(encoding="utf-8"))
        self.assertEqual(len(nav["roots"]),11)
        self.assertTrue(all(n["authoritative_routes"] is None and n["permission_policy"] is None for n in nav["roots"]))
if __name__=="__main__":
    unittest.main()
