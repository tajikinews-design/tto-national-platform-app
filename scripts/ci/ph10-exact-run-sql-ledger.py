"""PH10 exact-run SQL evidence ledger; never mistakes source SQL for full E2E acceptance.

Only invoke AFTER all PH07/PH08/PH09 SQL suites succeed in the same CI job.
"""
import json
import os
from pathlib import Path

root = Path(__file__).resolve().parents[2]
ids = json.loads((root / "docs/analysis/ACCEPTANCE_IDS.json").read_text())
groups = [("PH04", 16), ("PH05", 24), ("PH06", 15),
          ("PH07", 26), ("PH08", 36), ("PH09", 38)]
assert len(ids) == 155 and len({x["id"] for x in ids}) == 155
sha = os.environ.get("GITHUB_SHA", "")
run = os.environ.get("GITHUB_RUN_ID", "")
assert os.environ.get("CI") == "true" and len(sha) == 40 and run.isdigit()
rows = []
cursor = 0
for phase, n in groups:
    for item in ids[cursor:cursor+n]:
        executed = phase in ("PH07", "PH08", "PH09")
        rows.append({
            "acceptanceId": item["id"],
            "phase": phase,
            "source": item["source"],
            "sqlSuiteExecutedWithinThisJob": executed,
            "sqlSuiteResult": "PASS_SCOPED_SQL" if executed else "NOT_ASSERTED_IN_THIS_LEDGER",
            "evidenceLayer": "SQL_ONLY" if executed else "UNPROVEN",
            "fullEndToEndPassed": False,
            "formalAcceptance": "NOT_ACCEPTED",
            "workflowRunId": run if executed else None,
            "commitSha": sha if executed else None,
        })
    cursor += n
assert cursor == 155
assert sum(x["sqlSuiteExecutedWithinThisJob"] for x in rows) == 100
out = root / "ph10-artifacts/ph10_155_exact_run_sql_ledger.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({
    "schemaVersion": "1.0",
    "executionClaim": "EXACT_CI_RUN_PH07_PH08_PH09_SCOPED_SQL_ONLY",
    "all155FormalAcceptance": False,
    "workflowRunId": run,
    "commitSha": sha,
    "sqlVerifiedIds": 100,
    "notClaimedInThisLedger": 55,
    "cases": rows,
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("PH10_EXACT_RUN_SQL_LEDGER_PASS_100_OF_155_SQL_ONLY", run, sha)
