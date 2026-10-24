"""Keep the Arvan portability gate real and offline after pnpm install.

The release checker must not bypass YAML validation or download PyYAML at
runtime. Tests here run on stdlib-only Python in a network-disabled container.
"""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
PKG = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
LOCK = (ROOT / "pnpm-lock.yaml").read_text(encoding="utf-8")
HELPER = (ROOT / "scripts/ci/local-release-helper.ps1").read_text(encoding="utf-8")
NODE = (ROOT / "scripts/test_arvan_k8s_templates.cjs").read_text(encoding="utf-8")
PYTHON = (ROOT / "scripts/test_arvan_k8s_templates.py").read_text(encoding="utf-8")

class ArvanReleaseOfflineContract(unittest.TestCase):
    def test_pinned_dependency_is_covered_by_lockfile(self):
        self.assertEqual(PKG["devDependencies"]["js-yaml"], "4.3.2")
        self.assertIn("      js-yaml:\n        specifier: 4.3.2\n        version: 4.3.2", LOCK)
        self.assertIn("  js-yaml@4.3.2:", LOCK)
        self.assertIn('const yaml = require("js-yaml")', NODE)

    def test_same_real_validation_runs_without_runtime_install(self):
        begin = HELPER.index("function Arvan-Static-Only {")
        end = HELPER.index("function OCI-Build-And-Smoke", begin)
        section = HELPER[begin:end]
        self.assertIn('Node-Step "Arvan YAML portability lint; never deploy"', section)
        self.assertIn("node scripts/test_arvan_k8s_templates.cjs", section)
        self.assertIn('TTO_LOCAL_RELEASE_ARVAN_STATIC_PASS', section)
        self.assertNotIn("pip install", section)
        self.assertNotIn("PyYAML", section)
        self.assertNotIn("docker build", section.lower())
        self.assertIn("TTO_ARVAN_STATIC_K8S_PORTABILITY_PASS_4_SERVICES_NO_DEPLOY", NODE)

    def test_python_gate_requirements_ported_and_strengthened(self):
        for marker in (
            "automountServiceAccountToken", "runAsNonRoot",
            "allowPrivilegeEscalation", "REPLACE_WITH_APPROVED_DIGEST",
            "registry.example.invalid/", "readinessProbe",
            "tto-api-runtime", "secretKeyRef",
            '"Deployment"', '"Service"',
        ):
            self.assertIn(marker, PYTHON)
            self.assertIn(marker, NODE)
        self.assertIn("assert.throws", NODE)
        self.assertIn('mutations.length', NODE)
        self.assertIn('TTO_ARVAN_YAML_LINT_NETWORK_INSTALLS=0', NODE)

if __name__ == "__main__":
    unittest.main()
