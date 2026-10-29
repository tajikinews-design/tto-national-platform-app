#!/usr/bin/env python3
"""Cross-NAV W1 static navigation, sources, privacy, and release contract audit."""
from pathlib import Path
import json
import re
ROOT=Path(__file__).resolve().parents[2]
REV=ROOT/"apps/shareholder/app/review/interactive"
contract=json.loads((ROOT/"docs/analysis/NAVIGATION_CONTRACT.json").read_text(encoding="utf-8"))
labels=[x["shareholder_label"] for x in contract["roots"]]
assert len(labels)==11 and len(set(labels))==11
assert [x["code"] for x in contract["roots"]]==[f"NAV-{i:02d}" for i in range(1,12)]
assert contract["implementation_status"]=="NOT_IMPLEMENTED"
assert all(x["ui_implementation"]=="REVIEW_SHELL_ONLY" and x["authoritative_routes"] is None and x["permission_policy"] is None for x in contract["roots"])
canonical=(ROOT/"packages/ui/src/shareholder-navigation.ts").read_text(encoding="utf-8")
assert all(f'"{name}"' in canonical for name in labels)
expected=["/review/interactive"]+[f"/review/interactive/nav-{i:02d}" for i in range(2,12)]
pages=[REV/"page.tsx"]+[REV/f"nav-{i:02d}"/"page.tsx" for i in range(2,12)]
assert all(p.is_file() for p in pages)
for p in pages:
    assert 'force-static' in p.read_text(encoding="utf-8"),p
files={1:REV/"synthetic-dashboard.tsx",2:REV/"nav-02"/"synthetic-membership-holdings.tsx",3:REV/"nav-03"/"synthetic-share-market.tsx"}
for i in range(4,12):
    folder=REV/f"nav-{i:02d}"
    options=list(folder.glob("synthetic-*.tsx"))
    assert len(options)==1,(folder,options)
    files[i]=options[0]
sources={i:p.read_text(encoding="utf-8") for i,p in files.items()}
# From every shared sidebar, navigation labels must map to complete same 11 routes.
for i in range(4,12):
    s=sources[i]
    assert all(f'"{name}"' in s for name in labels),(i,"missing label")
    assert all('"'+href+'"' in s for href in expected),(i,"missing href")
    assert s.count('aria-current')>=1,(i,"missing current indicator")
    if i>=5:
        assert f'index==={i-1}' in s,(i,"wrong active index")
assert 'return index===0?"/review/interactive":"/review/interactive/"+NAV_IDS[index].toLowerCase();' in sources[1]
assert '["▥","گزارش‌های من","/review/interactive/nav-10"]' in sources[4]
assert '["⚙","تنظیمات حساب","/review/interactive/nav-11"]' in sources[4]
for i in range(5,12):
    assert '["▥","گزارش‌های من","/review/interactive/nav-10"]' in sources[i]
    assert '["⚙","تنظیمات حساب","/review/interactive/nav-11"]' in sources[i]
# Source-scoped review pages must contain no network writes or active auth operations.
for i in range(4,12):
    s=sources[i]
    assert 'fetch(' not in s and 'XMLHttpRequest' not in s,(i,"network fetch in review")
    assert 'localStorage' not in s and 'sessionStorage' not in s,(i,"storage in review")
assert 'useState<Nav10Mode>("UNVERIFIED")' in sources[10]
assert 'useState<Nav11Mode>("UNVERIFIED")' in sources[11]
runner=(ROOT/"scripts/ci/run-local-docker.ps1").read_text(encoding="utf-8")
for n in range(3,12):
    assert f"node scripts/e2e-shareholder-nav{n:02d}-" in runner,(n,"missing viewport release")
browser=(ROOT/"scripts/e2e-shareholder-w1-integrated-audit.cjs").read_text(encoding="utf-8")
assert 'if(i<2)' in browser
assert '"w1-nav"+String(i+1).padStart(2,"0")+"-"+width+".png"' in browser
assert 'TTO_W1_NAV01_NAV02_ARCHIVAL_SCREENSHOTS=8/8' in browser
assert 'fullPage:width===1440' in browser
print("TTO_W1_NAV01_NAV02_ARCHIVAL_CAPTURE_CONTRACT_PASS")
print("TTO_W1_NAV01_NAV11_ROUTES=PASS")
print("TTO_W1_NAV01_NAV11_CANONICAL_LABELS=PASS")
print("TTO_W1_NAV01_NAV11_REVIEW_ISOLATION=PASS")
print("TTO_W1_NAV01_NAV11_PERMISSION_GATE_NOT_MISREPORTED=PASS")
print("TTO_W1_INTEGRATED_STATIC_AUDIT_PASS")
