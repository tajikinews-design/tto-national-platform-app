#!/usr/bin/env python3
"""NAV11 static deny-by-default compliance. No operational settings."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]
base=ROOT/"apps/shareholder/app/review/interactive/nav-11"
fx=(base/"settings-fixtures.ts").read_text(encoding="utf-8")
ui=(base/"synthetic-settings.tsx").read_text(encoding="utf-8")
page=(base/"page.tsx").read_text(encoding="utf-8")
css=(base/"settings.css").read_text(encoding="utf-8")
labels=["حساب کاربری","عکس پروفایل","اطلاعات تماس","تنظیم اعلان‌ها","کانال پیام","تنظیمات حریم خصوصی","امنیت حساب","نشست‌های فعال","OTP/MFA","خروج از دستگاه‌ها"]
positions=[fx.index('label:"'+x+'"') for x in labels]
assert positions==sorted(positions)
assert len(re.findall(r'\{id:"[A-Z]+",label:',fx))==10
assert 'mockOnly:true as const' in fx and 'editable:false as const' in fx
assert 'actionAllowed:false as const' in fx
assert 'useState<Nav11Mode>("UNVERIFIED")' in ui
assert all(x in ui for x in ['SOURCE_UNAVAILABLE','ACCESS_DENIED','DEMO_CONTENT','NAV11_SECTIONS','aria-pressed'])
assert 'index===10' in ui and '/review/interactive/nav-11' in ui
assert 'SyntheticSettings' in page and 'force-static' in page
assert '.nav11-shell' in css
for forbidden in ['fetch(', 'XMLHttpRequest','localStorage','sessionStorage','navigator.credentials','navigator.clipboard','window.open','download=','<form','type="submit"','POST','PUT','DELETE']:
    assert forbidden not in ui, forbidden
print("TTO_NAV11_CANONICAL_TEN=PASS")
print("TTO_NAV11_SYNTHETIC_DEFAULT_DENY=PASS")
print("TTO_NAV11_SECURITY_ACTIONS_BLOCKED=PASS")
print("TTO_NAV11_STATIC_CONTRACT_PASS")
