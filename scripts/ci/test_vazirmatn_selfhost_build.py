#!/usr/bin/env python3
"""Offline guard: TTO's three portal builds must not fetch Vazirmatn from Google."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
APPS=("shareholder","cooperative-management","national-admin")
PACKAGE="@fontsource-variable/vazirmatn"
VERSION="5.2.8"
INTEGRITY="sha512-2YzXfH4PNOeoZsBsgJgjbnm+IC2nonGyMLX3gXLm8FQrP+wpi1uGBIWYWlEzJ0lmntgdyAc3lRViHHfZWKvbog=="

class TestFontBuildDeterminism(unittest.TestCase):
    def test_01_all_three_portals_use_pinned_selfhosted_font(self):
        for app in APPS:
            with self.subTest(app=app):
                pkg=json.loads((ROOT/"apps"/app/"package.json").read_text(encoding="utf-8"))
                self.assertEqual(pkg["dependencies"].get(PACKAGE),VERSION)
                layout=(ROOT/"apps"/app/"app/layout.tsx").read_text(encoding="utf-8")
                self.assertIn('import "@fontsource-variable/vazirmatn/wght.css";',layout)
                self.assertNotIn("next/font/google",layout)
                self.assertNotIn("fonts.googleapis.com",layout)
                self.assertIn('lang="fa"',layout)
                self.assertIn('dir="rtl"',layout)

    def test_02_existing_css_variable_semantics_preserved(self):
        css=(ROOT/"packages/ui/src/styles.css").read_text(encoding="utf-8")
        self.assertIn('--tto-font:"Vazirmatn Variable"',css)
        self.assertIn("var(--tto-font)",css)
        self.assertIn("Vazirmatn,Tahoma,Arial",css)

    def test_03_lockfile_freezes_dependency_and_integrity(self):
        lock=(ROOT/"pnpm-lock.yaml").read_text(encoding="utf-8")
        for app in APPS:
            with self.subTest(app=app):
                segment=lock.split("  apps/"+app+":\n",1)[1].split("\n  ",1)[0]
                self.assertIn("      '@fontsource-variable/vazirmatn':\n        specifier: 5.2.8\n        version: 5.2.8",segment)
        self.assertIn("  '@fontsource-variable/vazirmatn@5.2.8':\n    resolution: {integrity: "+INTEGRITY+"}",lock)
        self.assertIn("snapshots:\n\n  '@fontsource-variable/vazirmatn@5.2.8': {}",lock)
        self.assertEqual(lock.count("      '@fontsource-variable/vazirmatn':"),3)

if __name__=="__main__":
    unittest.main()
