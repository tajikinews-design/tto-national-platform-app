#!/usr/bin/env python3
"""Conservative TTO CI suite selection. Empty/ambiguous diff means core."""
import argparse
from pathlib import Path

LIGHT_PREFIXES=("docs/reports/","docs/deployment/","docs/guides/")
LIGHT_FILES={"README.md"}
def suite(event, action, draft, requested, changed):
    if event=="workflow_dispatch":
        if requested not in ("core","release"): raise ValueError("Invalid manual suite")
        return requested
    if event!="pull_request": raise ValueError("Invalid event")
    if action=="ready_for_review" or draft=="false": return "release"
    if draft!="true": raise ValueError("Unknown PR draft status")
    if not changed:return "core"
    for p in changed:
        if not p or p.startswith("/") or "\n" in p or "\r" in p:return "core"
        if p not in LIGHT_FILES and not p.startswith(LIGHT_PREFIXES): return "core"
    return "lite"
if __name__=="__main__":
    ap=argparse.ArgumentParser()
    for arg in ("event","action","draft","requested","changes-file"):
        ap.add_argument("--"+arg,required=(arg in ("event","changes-file")),default="")
    a=ap.parse_args()
    print(suite(a.event,a.action,a.draft,a.requested,Path(a.changes_file).read_text().splitlines()))
