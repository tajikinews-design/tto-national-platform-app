#!/usr/bin/env python3
"""Pinned local Vazirmatn build dependency, same approved variable family.

CI guardrail only. No font downloads, production config, credentials or network.
"""
import hashlib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "packages/ui/assets/Vazirmatn[wght].woff2"
LICENSE = ROOT / "packages/ui/assets/OFL.txt"
PORTALS = ("shareholder", "cooperative-management", "national-admin")

class TestVazirmatnOfflineBuild(unittest.TestCase):
    def test_01_upstream_pinned_woff2_exact_git_blob(self):
        raw = ASSET.read_bytes()
        self.assertEqual(raw[:4], b"wOF2")
        self.assertEqual(len(raw), 111152)
        digest = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
        # upstream rastikerdar/vazirmatn v33.003 fonts/webfonts/Vazirmatn[wght].woff2
        self.assertEqual(digest, "a501289a85595158570b0c2badcb4608b042e748")

    def test_02_original_font_license_preserved(self):
        text = LICENSE.read_text(encoding="utf-8")
        self.assertIn("Copyright 2015 The Vazirmatn Project Authors", text)
        self.assertIn("SIL OPEN FONT LICENSE Version 1.1", text)
        self.assertIn("Font Software", text)

    def test_03_all_three_portals_use_same_local_font_and_css_variable(self):
        for portal in PORTALS:
            with self.subTest(portal=portal):
                layout = ROOT / f"apps/{portal}/app/layout.tsx"
                source = layout.read_text(encoding="utf-8")
                self.assertIn('import localFont from "next/font/local"', source)
                self.assertNotIn('next/font/google', source)
                self.assertIn('variable: "--tto-font"', source)
                self.assertIn('weight: "100 900"', source)
                self.assertIn('display: "swap"', source)
                relative = '../../../packages/ui/assets/Vazirmatn[wght].woff2'
                self.assertIn(relative, source)
                self.assertEqual((layout.parent / relative).resolve(), ASSET.resolve())
                self.assertTrue((layout.parent / relative).is_file())

    def test_04_shared_typography_still_consumes_same_font_variable(self):
        css = (ROOT / "packages/ui/src/styles.css").read_text(encoding="utf-8")
        self.assertIn("var(--tto-font)", css)
        for portal in PORTALS:
            text = (ROOT / f"apps/{portal}/app/layout.tsx").read_text(encoding="utf-8")
            self.assertIn("className={vazirmatn.variable}", text)

if __name__ == "__main__":
    unittest.main()
