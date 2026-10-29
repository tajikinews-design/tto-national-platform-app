#!/usr/bin/env python3
"""NAV10 fail-closed static contract test. Does not replace Docker/Chromium QA."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "apps/shareholder/app/review/interactive/nav-10"
fixtures = (BASE / "report-fixtures.ts").read_text(encoding="utf-8")
screen = (BASE / "synthetic-reports.tsx").read_text(encoding="utf-8")
page = (BASE / "page.tsx").read_text(encoding="utf-8")
css = (BASE / "reports.css").read_text(encoding="utf-8")
nav = (ROOT / "packages/ui/src/shareholder-navigation.ts").read_text(encoding="utf-8")

labels = [
 "گزارش سهام من", "تاریخچه معاملات", "سوابق پرداخت",
 "خریدهای فروشگاه", "مزایای استفاده‌شده", "دوره‌ها و رویدادها",
 "فعالیت‌های من", "دریافت گزارش/PDF"
]
assert all(fixtures.index(f'label:"{label}"') < fixtures.index(f'label:"{labels[i+1]}"')
           for i, label in enumerate(labels[:-1]))
assert len(re.findall(r'id:"DEMO-RPT-\d{3}"', fixtures)) == 16
assert 'mockOnly:true' in fixtures and 'sourceVerified:false' in fixtures
assert 'downloadable:false' in fixtures and 'officialDocument:false' in fixtures
assert 'UNVERIFIED' in screen and 'SOURCE_UNAVAILABLE' in screen and 'ACCESS_DENIED' in screen and 'DEMO_CONTENT' in screen
assert 'useState<Nav10Mode>("UNVERIFIED")' in screen
assert 'NAV10_SECTIONS.map' in screen or 'CATEGORY_GROUPS.map' in screen
assert 'aria-pressed' in screen and 'role="status"' in screen
assert 'type="search"' in screen and 'disabled={!demo}' in screen
assert 'NAV10_FIXTURES.filter' in screen
assert 'NAV10_INVARIANTS.map' in screen
assert '/review/interactive/nav-10' in screen
assert 'گزارش‌های من' in nav
assert 'force-static' in page and 'SyntheticReports' in page
assert '.nav10-shell' in css
for forbidden in ("fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "window.open", "createObjectURL", "download=", "href=\"data:", "POST", "PUT", "DELETE"):
 assert forbidden not in screen, forbidden
for forbidden in ("fetch(", "XMLHttpRequest", "createObjectURL", "download="):
 assert forbidden not in fixtures, forbidden
print("TTO_NAV10_CANONICAL_EIGHT=PASS")
print("TTO_NAV10_SYNTHETIC_FIXTURES_16=PASS")
print("TTO_NAV10_FAIL_CLOSED=PASS")
print("TTO_NAV10_STATIC_CONTRACT_PASS")
