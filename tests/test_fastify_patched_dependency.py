"""TTO Fastify direct and transitive patch integrity; no production data."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class FastifyPinGate(unittest.TestCase):
    def test_direct_api_pin_and_root_override(self):
        api = json.loads((ROOT / "services/api/package.json").read_text(encoding="utf-8"))
        root = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(api["dependencies"]["fastify"], "5.12.8")
        self.assertEqual(root["pnpm"]["overrides"]["fastify"], "5.12.8")
        self.assertEqual(root["packageManager"], "pnpm@10.18.0")

    def test_lockfile_direct_and_transitive_versions_are_patched(self):
        lock = (ROOT / "pnpm-lock.yaml").read_text(encoding="utf-8")
        self.assertIn("fastify@5.12.8:", lock)
        versions = re.findall(r"(?m)^\s{2}fastify@(\d+\.\d+\.\d+):", lock)
        self.assertEqual(set(versions), {"5.12.8"}, f"Unexpected Fastify packages: {versions}")
        self.assertRegex(lock, r"(?m)^\s+specifier: 5\.12\.8$")
        self.assertRegex(lock, r"(?m)^\s+fastify: 5\.12\.8$")
        self.assertNotIn("fastify@5.11.3:", lock)
        self.assertNotIn("fastify@5.12.7:", lock)

    def test_source_scope_preserved(self):
        self.assertTrue((ROOT / "docs/source/SOURCE_BASELINE.json").is_file())

if __name__ == "__main__":
    unittest.main()
