#!/usr/bin/env python3
"""Offline check of pinned Git source tree snapshot. No write/network/secrets."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/"docs/source/SOURCE_BASELINE.json").read_text(encoding="utf-8"))
assert DATA["read_only"] is True
assert DATA["repository"]=="tajikinews-design/tto-national-platform"
assert DATA["pinned_commit"]=="5eb6be8edfbb61f2eca740a42c30f572b493f023"
assert len(DATA["files"])==DATA["verified_file_count"]==15
assert len(set(x["path"] for x in DATA["files"]))==15
assert all(len(f["git_blob_sha"])==40 and f["bytes"]>0 for f in DATA["files"])
print("TTO_SOURCE_SNAPSHOT_MANIFEST_PASS=15 (offline manifest consistency only)")
