"""Fail-closed, byte-for-byte regression guard for the user-approved TTO login UI.

Every future CI run must reject unapproved edits to any frozen UI file.
To change the design, obtain explicit product-owner approval, create a new
freeze version / snapshot commit, and update this guard + manifest in review.
This enforces a test gate, not an immutable GitHub branch permission rule.
"""
from __future__ import annotations

import hashlib
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FREEZE = ROOT / "docs" / "design" / "TTO-AUTH-UI-V1-FREEZE.json"
APPROVED_SHA = "51171ab034e29c31d52026fc39380fb4a636fad7"
PATHS = {
    "packages/ui/src/auth-frame.tsx",
    "packages/ui/src/styles.css",
    "packages/ui/src/portal-password-login.tsx",
    "packages/ui/src/otp-login.tsx",
    "apps/national-admin/app/national-root-login.tsx",
    "apps/national-admin/app/login/page.tsx",
    "apps/cooperative-management/app/login/page.tsx",
    "apps/shareholder/app/login/page.tsx",
    "apps/cooperative-management/app/customer-register/page.tsx",
    "apps/cooperative-management/app/subscribe/page.tsx",
}


def git_blob_sha1(contents: bytes) -> str:
    # Identical to 'git hash-object <file>'; avoids assuming a checkout has git history.
    prefix = b"blob " + str(len(contents)).encode("ascii") + b"\x00"
    return hashlib.sha1(prefix + contents).hexdigest()


class ApprovedAuthUiFreeze(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(FREEZE.read_text(encoding="utf-8"))

    def test_freeze_approval_and_unambiguous_scope(self) -> None:
        m = self.manifest
        self.assertEqual(m["schemaVersion"], 1)
        self.assertEqual(m["freezeId"], "TTO-AUTH-UI-V1")
        self.assertEqual(m["approvedCommit"], APPROVED_SHA)
        self.assertEqual(m["snapshotBranch"], "freeze/tto-auth-ui-v1-approved-20261109")
        self.assertEqual(m["governance"]["status"], "UI_GREEN_APPROVED_FROZEN")
        self.assertEqual(m["governance"]["releaseStatus"], "PRODUCTION_HOLD")
        self.assertEqual(set(m["files"]), PATHS)
        self.assertEqual(set(m["previewDeployments"]), {"national","cooperative","shareholder"})
        self.assertEqual(set(m["ciVerifiedAtApproval"]), {"preview","security"})

    def test_all_approved_source_blobs_are_unchanged(self) -> None:
        for relative_path in sorted(PATHS):
            with self.subTest(path=relative_path):
                expected = self.manifest["files"][relative_path]
                self.assertRegex(expected, r"^[0-9a-f]{40}$")
                path = ROOT / relative_path
                self.assertTrue(path.is_file(), f"Frozen UI file is missing: {relative_path}")
                self.assertFalse(path.is_symlink(), f"Frozen UI must not be a symlink: {relative_path}")
                actual = git_blob_sha1(path.read_bytes())
                self.assertEqual(
                    actual, expected,
                    f"FROZEN TTO-AUTH-UI-V1 CHANGED: {relative_path}. "
                    "Restore approved baseline, or obtain owner approval and "
                    "create a separately reviewed V2 freeze. CI MUST FAIL CLOSED.",
                )

    def test_approved_visual_contract(self) -> None:
        # Explicit semantic guardrails in addition to the byte-level lock.
        css=(ROOT/"packages/ui/src/styles.css").read_text(encoding="utf-8")
        frame=(ROOT/"packages/ui/src/auth-frame.tsx").read_text(encoding="utf-8")
        order=(ROOT/"apps/cooperative-management/app/subscribe/page.tsx").read_text(encoding="utf-8")
        self.assertIn("width:min(870px,100%)", css)
        self.assertIn("min-height:min(615px,calc(100svh - 44px))", css)
        self.assertIn(".tto-checkout-progress",css)
        self.assertIn('AuthMode="login"|"register"|"order"', frame)
        self.assertIn('type Step="details"|"confirm"|"done"', order)
        self.assertIn('mode="order"',order)
        self.assertIn("DEMO_AMOUNT_ATTESTED",order)
        self.assertIn('data.tenantActivated!==true',order)

if __name__ == "__main__":
    unittest.main()
