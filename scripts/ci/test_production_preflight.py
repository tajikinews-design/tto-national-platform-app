"""Negative and positive tests for the offline production release evidence gate."""
import importlib.util
from pathlib import Path
import unittest

PATH = Path(__file__).with_name("production_preflight.py")
spec = importlib.util.spec_from_file_location("tto_production_preflight", PATH)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def valid_evidence():
    witness = "reviewed-evidence-ref-20261108"
    return {
        "provider": "arvancloud",
        "environment": "production",
        "release": {
            "owner_approval_ref": witness,
            "reviewed_commit": "a" * 40,
            "release_review_ref": witness,
        },
        "arvan": {key: witness for key in gate.FIELDS["arvan"]},
        "database": {
            **{key: witness for key in gate.FIELDS["database"]},
            "production_instance_ref": "tto-production-separated-001",
        },
        "acceptance": {key: witness for key in gate.FIELDS["acceptance"]},
        "images": {
            service: "registry.example.org/tto/" + service + "@sha256:" + "b" * 64
            for service in gate.SERVICES
        },
    }


class ProductionPreflightTest(unittest.TestCase):
    def test_valid_evidence_is_structurally_accepted_not_deployed(self):
        self.assertEqual(gate.checks(valid_evidence()), [])

    def test_missing_production_evidence_fails_closed(self):
        failed = gate.checks({})
        self.assertTrue(any("provider" in item for item in failed))
        self.assertTrue(any("database" in item for item in failed))
        self.assertTrue(any("images" in item for item in failed))

    def test_preview_database_is_rejected(self):
        data = valid_evidence()
        data["database"]["production_instance_ref"] = gate.PREVIEW_DB
        self.assertTrue(any("independent" in item for item in gate.checks(data)))

    def test_wrong_provider_and_environment_are_rejected(self):
        data = valid_evidence()
        data["provider"] = "vercel"
        data["environment"] = "preview"
        self.assertTrue(any("arvancloud" in item for item in gate.checks(data)))
        self.assertTrue(any("production" in item for item in gate.checks(data)))

    def test_mutable_and_placeholder_images_are_rejected(self):
        data = valid_evidence()
        data["images"]["api"] = "registry.example.invalid/tto/api:latest"
        self.assertTrue(any("images.api" in item for item in gate.checks(data)))

    def test_secret_fields_and_credentials_in_urls_are_rejected(self):
        data = valid_evidence()
        data["database"]["password"] = "DO-NOT-RECORD"
        data["arvan"]["tls_ingress_evidence"] = "https://user:password@example.org/proof"
        failed = gate.checks(data)
        self.assertTrue(any("secret-like field" in item for item in failed))
        self.assertTrue(any("embedded credential" in item for item in failed))
        self.assertNotIn("DO-NOT-RECORD", "\n".join(failed))

    def test_unreviewed_commit_and_missing_signoff_are_rejected(self):
        data = valid_evidence()
        data["release"]["reviewed_commit"] = "main"
        data["acceptance"]["security_signoff"] = ""
        failed = gate.checks(data)
        self.assertTrue(any("exact 40-character SHA" in item for item in failed))
        self.assertTrue(any("security_signoff" in item for item in failed))


if __name__ == "__main__":
    unittest.main()
