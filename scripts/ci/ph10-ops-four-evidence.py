#!/usr/bin/env python3
"""OPS-001 design reconciliation; OPS-004/005/008 isolated independent CI proof.

Never promotes design or PG17 scoped evidence to full PH09/PH10 E2E or legal
acceptance. Requires exact marker lines from an actual CI-scoped execution.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[2]
LOGNAME="ph10-ops-four-run.stdout.log"
CASES={
 "OPS-AT-001":(None,"DESIGN_RECONCILIATION_108_47_ONLY"),
 "OPS-AT-004":("PH10_OPS_AT004_TENANT_SCOPED_ROW_FINGERPRINT_RESTORE_PASS","DISPOSABLE_PG17_TENANT_DATA_FINGERPRINT_RESTORE"),
 "OPS-AT-005":("PH10_OPS_AT005_CLEAN_MIGRATION_SCHEMA_RECONCILIATION_PASS","DISPOSABLE_PG17_CLEAN_MIGRATION_SCHEMA_REPLAY"),
 "OPS-AT-008":("PH10_OPS_AT008_INDEPENDENT_TRANSACTION_ROLLBACK_SCOPED_PASS","DISPOSABLE_PG17_SEPARATE_TRANSACTION_ROLLBACK")
}
DECISIONS={
 "requirements":{"RETAIN":34,"UPDATE":62,"REPLACE":10,"RETIRE":2},
 "tests":{"RETAIN":22,"UPDATE":13,"REPLACE":11,"RETIRE":1}
}
def validate_design():
    d=json.loads((ROOT/"docs/analysis/PH09_LEGACY_108_47_TRACEABILITY.json").read_text(encoding="utf8"))
    assert d["traceabilityType"]=="DESIGN_RECONCILIATION_ONLY"
    assert d["fullOperationalAcceptance"]=="NOT_ISSUED"
    assert d["unresolved"]==0
    for group,wanted in DECISIONS.items():
        rows=d[group]
        assert len(rows)==sum(wanted.values())
        assert len({r["legacyId"] for r in rows})==len(rows)
        assert {k:sum(r["resolution"]==k for r in rows) for k in wanted}==wanted
        for row in rows:
            assert row["legacyId"] and row["owner"] and row["reason"]
            if group=="requirements":
                assert row["currentRule"]
                if row["resolution"]!="RETIRE":assert row["successorRequirement"]
            else:
                assert row["currentExpected"] and row["successorTest"]
    return hashlib.sha256((ROOT/"docs/analysis/PH09_LEGACY_108_47_TRACEABILITY.json").read_bytes()).hexdigest()

def exact_lines(log):
    return {x.strip() for x in log.splitlines()}

def report(log,sha,run):
    assert re.fullmatch(r"[0-9a-f]{40}",sha) and run.isdigit()
    design_hash=validate_design()
    lines=exact_lines(log)
    assert "PH10_OPS_NO_REAL_RELEASE_OR_DATA_USED" in lines
    assert "PH10_OPS004_TWO_NONEMPTY_TENANT_EVIDENCE_RESTORE_PASS" in lines,\
        "OPS004_TWO_DISTINCT_NONEMPTY_TENANT_RESTORE_PROOF_MISSING"
    table_line=[x for x in lines if x.startswith("PH10_OPS004_TENANT_TABLES_CHECKED=")]
    migration_line=[x for x in lines if x.startswith("PH10_OPS005_MIGRATION_FILES_REPLAYED=")]
    assert len(table_line)==len(migration_line)==1,"OPS_METRICS_ABSENT_OR_AMBIGUOUS"
    tables=int(table_line[0].split("=")[1])
    migration_count=int(migration_line[0].split("=")[1])
    assert tables>=3 and migration_count>=10,"OPS_SCOPE_TOO_NARROW"
    rows=[]
    for ident,(marker,layer) in CASES.items():
        if marker: assert marker in lines,"OPS_INDEPENDENT_RUNTIME_MARKER_MISSING:"+ident
        rows.append({
          "acceptanceId":ident,"commitSha":sha,"workflowRunId":run,
          "sourceContract":"docs/analysis/PH09_OFFICIAL_SOURCE38.json",
          "testPath":"scripts/ci/ph10-ops-four-dedicated.sh" if marker else
                     "docs/analysis/PH09_LEGACY_108_47_TRACEABILITY.json",
          "assertionMarker":marker,
          "evidenceLayer":layer,
          "scopedTechnicalPassed":bool(marker),
          "designTraceabilityValidated":ident=="OPS-AT-001",
          "scopedResult":"PASS_SCOPED_DISPOSABLE_NOT_FULL_E2E" if marker else
                         "DESIGN_108_47_LOCKED_NOT_PER_ITEM_RUNTIME_VERIFIED",
          "fullSourceUserJourneyPassed":False,"formalAcceptance":"NOT_ACCEPTED",
          "independentOperationalApproval":False})
    return {"schemaVersion":"1.0","commitSha":sha,"workflowRunId":run,
        "opsIds":sorted(CASES),"formalAcceptanceCount":0,
        "scope":"OWNER_LOCKED_108_47_DESIGN_PLUS_THREE_DISPOSABLE_OPERATIONS",
        "designReconciliationSha256":design_hash,
        "reconciledLegacyRequirementIds":108,"reconciledLegacyTestIds":47,
        "tenantBearingTablesCompared":tables,"migrationFilesCleanReplayed":migration_count,
        "operationsSourceSpecificScopedPass":3,
        "operationsDesignOnly":1,"source155FullUserJourneysAccepted":False,
        "release":"HOLD","cases":rows}

def main():
    a=argparse.ArgumentParser()
    a.add_argument("--validate",action="store_true")
    a.add_argument("--log")
    args=a.parse_args()
    assert bool(args.validate)!=bool(args.log)
    if args.validate:
        validate_design()
        print("PH10_OPS_AT001_108_47_OWNER_DESIGN_RECONCILED_NOT_RUNTIME_E2E")
        return
    assert os.getenv("CI")=="true" and not os.getenv("VERCEL")
    assert os.getenv("TTO_PH10_OPS_DISPOSABLE")=="true"
    p=Path(args.log).resolve()
    assert p.parent==Path(os.environ["RUNNER_TEMP"]).resolve() and p.name==LOGNAME
    evidence=report(p.read_text(encoding="utf8"),os.environ["GITHUB_SHA"],os.environ["GITHUB_RUN_ID"])
    out=ROOT/"ph10-artifacts/ph10_ops_four_exact_evidence.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("PH10_OPS_FOUR_SOURCE_TRUTH_DESIGN_001=1_INDEPENDENT_SCOPED_004_005_008=3_FORMAL_E2E=0")

if __name__=="__main__":
    try:main()
    except (AssertionError,ValueError,OSError,KeyError) as exc:
        print("PH10_OPS_EVIDENCE_FAIL_CLOSED",str(exc),file=sys.stderr)
        sys.exit(1)
