#!/usr/bin/env python3
"""Build the read-only, dependency-free internal review bundle. DOES NOT DEPLOY."""
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"dist"
PAGES=("shareholder","cooperative-management","national-admin")

def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT/"assets").mkdir(parents=True)
    shutil.copy2(ROOT/"apps/preview-index/index.html",OUT/"index.html")
    for slug in PAGES:
        target=OUT/slug
        target.mkdir(parents=True)
        shutil.copy2(ROOT/"apps"/slug/"index.html",target/"index.html")
    for filename in ("ui.css","app.js"):
        shutil.copy2(ROOT/"packages/ui/assets"/filename,OUT/"assets"/filename)
    files=list(OUT.rglob("*"))
    assert len([p for p in files if p.is_file()])==6
    print("TTO_PREVIEW_BUILD_PASS: 3 panels, 1 hub, 2 shared assets; NO DEPLOY")

if __name__=="__main__":
    main()
