#!/usr/bin/env python3
"""Fail-closed exact-head source-ID evidence for PH04–PH06, isolated CI only.

PH04's 16 related aliases remain BLOCKED; a passing SQL suite never certifies
full source-ID end-to-end or formal legal/operational acceptance.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
FROZEN = ROOT / "docs/analysis/ACCEPTANCE_IDS.json"
PH05_MAP = ROOT / "docs/analysis/PH05_24_EXECUTABLE_SCOPED_COVERAGE.json"
PH04_MATRIX = ROOT / "docs/analysis/PH04_LOCKED_155_SOURCE_EXECUTION_MATRIX.json"
OUTPUT = ROOT / "ph10-artifacts/ph10_frozen55_exact_evidence.json"
SQL_FILES = (
    "tests/sql/ph05-cf03-contract-depth.sql",
    "tests/sql/ph05-cf03-file-download-negative.sql",
    "tests/sql/ph05-cf03-audit-hold-negative.sql",
    "tests/sql/ph05-cf04-contract-depth.sql",
    "tests/sql/ph06-member-share-frozen15.sql",
)
NODE_FILE = "scripts/ci/ph05-signed-provider-sandbox.test.cjs"
ALLOWED = frozenset((*SQL_FILES, NODE_FILE))
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def expected_rows():
    frozen = load_json(FROZEN)
    assert len(frozen) == 155 and len({x["id"] for x in frozen}) == 155, "FROZEN_155_CHANGED"
    groups = ([("PH04", x) for x in frozen[:16]] +
              [("PH05", x) for x in frozen[16:40]] +
              [("PH06", x) for x in frozen[40:55]])
    assert [x["id"] for _, x in groups[:16]] == [x["sourceTestId"] for x in load_json(PH04_MATRIX)["cases"][:16]]
    mapping = load_json(PH05_MAP)["details"]
    assert len(mapping) == 24 and len({x["sourceTestId"] for x in mapping}) == 24, "PH05_MAPPING_INVALID"
    m = {x["sourceTestId"]: x for x in mapping}
    rows = []
    for phase, item in groups:
        rid = item["id"]
        row = {"acceptanceId": rid, "phase": phase, "source": item["source"],
               "formalAcceptance": "NOT_ACCEPTED", "fullEndToEndPassed": False,
               "officialLegalAuthorityVerified": False}
        if phase == "PH04":
            row.update({"testPath": None, "expectedMarker": None, "evidenceLayer": "RELATED_HISTORICAL_ONLY",
                        "status": "BLOCKED_EXACT_SOURCE_ID_EXECUTION_NOT_ESTABLISHED"})
        elif phase == "PH05":
            src = m[rid]
            path, marker = src["codeAssertionFile"], src["signalPrefix"]
            assert path in ALLOWED and isinstance(marker, str) and marker.startswith("PH05_")
            assert len(marker) >= 18 and (ROOT / path).is_file(), "PH05_PATH_OR_MARKER_INVALID: " + rid
            row.update({"testPath": path, "expectedMarker": marker,
                        "evidenceLayer": "OFFLINE_SANDBOX" if path == NODE_FILE else "SCOPED_SQL",
                        "status": "NOT_EXECUTED_ON_THIS_SHA"})
        else:
            assert rid.startswith(("MEMBER-AT-", "SHARE-AT-")), "PH06_ID_INVALID"
            n = rid.split("-AT-")[1]
            assert re.fullmatch(r"[0-9]{3}", n)
            marker = "PH06_" + rid.split("-AT-")[0] + "_AT" + n + "_"
            row.update({"testPath": SQL_FILES[-1], "expectedMarker": marker,
                        "evidenceLayer": "SCOPED_SQL", "status": "NOT_EXECUTED_ON_THIS_SHA"})
        rows.append(row)
    assert len(rows) == 55 and len({x["acceptanceId"] for x in rows}) == 55
    assert [sum(x["phase"] == p for x in rows) for p in ("PH04", "PH05", "PH06")] == [16, 24, 15]
    assert {x["testPath"] for x in rows if x["testPath"]} == ALLOWED, "SUITE_COVERAGE_DRIFT"
    return rows


def marker_found(log: str, prefix: str) -> bool:
    # Only non-echoed psql -qAt result rows or node --test TAP stdout lines count.
    # An embedded source statement, console command, or log substring is NOT evidence.
    if prefix.endswith("_PASS"):
        token = re.escape(prefix)
    else:
        token = re.escape(prefix) + r"[A-Z0-9_]*_PASS"
    pattern = re.compile(r"^(?:# )?" + token + r"$")
    return any(pattern.fullmatch(line.strip()) for line in log.splitlines())


def verify_disposable_container() -> None:
    assert os.getenv("CI") == "true", "CI_REQUIRED"
    assert os.getenv("TTO_PH10_FROZEN55_DISPOSABLE") == "true", "ISOLATION_OPT_IN_REQUIRED"
    assert not os.getenv("VERCEL"), "VERCEL_EXECUTION_FORBIDDEN"
    sha, run_id = os.getenv("GITHUB_SHA", ""), os.getenv("GITHUB_RUN_ID", "")
    assert SHA_RE.fullmatch(sha) and run_id.isdigit(), "EXACT_GITHUB_PROVENANCE_REQUIRED"
    check = subprocess.run(
        ["docker", "inspect", "--format", "{{.Config.Image}}|{{.State.Running}}", "tto-ph10-ci"],
        text=True, capture_output=True, timeout=15, check=True,
    )
    img, running = check.stdout.strip().split("|")
    assert re.fullmatch(r"postgres:17(?:-alpine)?", img) and running == "true", "NOT_ISOLATED_PG17"
    assert not os.getenv("TTO_ENABLE_REAL_SMSOTP_DELIVERY", "").lower() == "true", "LIVE_SMS_FORBIDDEN"


def run_suite(path: str) -> tuple[str, int, str]:
    if path == NODE_FILE:
        command = ["node", "--test", path]
        proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=90, check=False)
    else:
        command = ["docker", "exec", "-i", "tto-ph10-ci", "psql", "-U", "postgres",
                   "-d", "tto", "-qAt", "-v", "ON_ERROR_STOP=1"]
        with (ROOT / path).open("r", encoding="utf-8") as stream:
            proc = subprocess.run(command, cwd=ROOT, stdin=stream, text=True,
                                  capture_output=True, timeout=120, check=False)
    # Only stdout is used for PASS: stderr may contain SQL source echoes or warning text.
    return proc.stdout, proc.returncode, proc.stderr


def execute() -> int:
    verify_disposable_container()
    rows = expected_rows()
    metadata = {"workflowRunId": os.environ["GITHUB_RUN_ID"], "commitSha": os.environ["GITHUB_SHA"],
                "job": os.getenv("GITHUB_JOB", "UNKNOWN"), "event": os.getenv("GITHUB_EVENT_NAME", "UNKNOWN")}
    attempts = {}
    for path in sorted(ALLOWED):
        try:
            stdout, code, stderr = run_suite(path)
        except (OSError, subprocess.TimeoutExpired) as err:
            stdout, code, stderr = "", 124, type(err).__name__
        attempts[path] = {"exitCode": code, "stdout": stdout}
        print(f"FROZEN55_SUITE {path}: {'PASS' if code == 0 else 'FAIL'}", flush=True)
        if code:
            print("FROZEN55_SUITE_ERROR", path, stderr[-1000:], file=sys.stderr)
    verified = 0
    for row in rows:
        path, prefix = row["testPath"], row["expectedMarker"]
        if path is None:
            continue
        evidence = attempts[path]
        if evidence["exitCode"] == 0 and marker_found(evidence["stdout"], prefix):
            verified += 1
            row.update({"status": "PASS_SCOPED_NOT_FULL_E2E", "workflowRunId": metadata["workflowRunId"],
                        "commitSha": metadata["commitSha"], "job": metadata["job"],
                        "stdoutSha256": hashlib.sha256(evidence["stdout"].encode()).hexdigest(),
                        "sourceSha256": hashlib.sha256((ROOT / path).read_bytes()).hexdigest()})
        else:
            row["status"] = "BLOCKED_MISSING_SUCCESSFUL_EXECUTION_OR_MARKER"
    output = {"schemaVersion": "1.0", "truth": "REAL_ISOLATED_EXECUTION_NOT_FORMAL_E2E",
              "frozenIds": 55, "ph04RelatedOnlyBlocked": 16,
              "ph05Ph06SourceScopedPass": verified, "ph05Ph06Total": 39,
              "all155FullUserJourneysAccepted": False, "legalAndOperationalRelease": "BLOCKED",
              "run": metadata, "cases": rows}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"FROZEN55_EXACT_LEDGER_SCOPED={verified}/39; PH04_EXACT=0/16; FORMAL_E2E=0/55", flush=True)
    return 0 if verified == 39 else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-source", action="store_true", help="Read-only source/marker mapping validation, NOT runtime evidence")
    parser.add_argument("--execute", action="store_true", help="Execute only inside verified ephemeral GitHub CI PG17")
    args = parser.parse_args()
    if args.validate_source == args.execute:
        parser.error("select exactly one mode")
    if args.validate_source:
        rows = expected_rows()
        assert sum(x["expectedMarker"] is not None for x in rows) == 39
        print("FROZEN55_SOURCE_MAPPING_VALID_PH04_BLOCKED_16_PH05_24_PH06_15_NOT_RUNTIME_GREEN")
        return 0
    return execute()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (AssertionError, ValueError) as exc:
        print("FROZEN55_FAIL_CLOSED", str(exc), file=sys.stderr)
        sys.exit(1)
