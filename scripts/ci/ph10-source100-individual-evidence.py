#!/usr/bin/env python3
"""Exact per-source-ID SQL marker evidence for PH07/08/09 on disposable PG17.

A SQL file completing successfully is NOT individual evidence for all its IDs.
96 cases have unique standalone per-ID PASS markers; four PH09 operations cases
need separate external/CI proof. This script never certifies full user E2E.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/"ph10-artifacts"
PH9_MODULE={"OPP":"opportunities","IMPACT":"impact","GRC":"grc",
             "NI":"network-intelligence","DG":"data-governance","OPS":"operations"}
NO_MARKER={"OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"}
PATTERN=re.compile(r"^[A-Z0-9_]+_PASS$")
SHA=re.compile(r"^[a-f0-9]{40}$")

def load(rel):
    return json.loads((ROOT/rel).read_text(encoding="utf8"))

def source():
    frozen=[x["id"] for x in load("docs/analysis/ACCEPTANCE_IDS.json")]
    manifests=[
      load("docs/analysis/PH07_26_SOURCE_ACCEPTANCE.json")["cases"],
      load("docs/analysis/PH08_OFFICIAL_SOURCE36.json")["cases"],
      load("docs/analysis/PH09_OFFICIAL_SOURCE38.json")["cases"]]
    assert len(frozen)==155 and len(set(frozen))==155
    cases=[]
    for phase, records in zip(("PH07","PH08","PH09"),manifests):
        for x in records:
            path=(x["assertionSql"] if phase=="PH07" else
                  x["sqlFile"] if phase=="PH08" else
                  "tests/sql/ph09-"+PH9_MODULE[x["module"]]+"-acceptance.sql")
            cases.append((x["id"],phase,path))
    assert [x[0] for x in cases]==frozen[55:] and len(cases)==100
    paths={path: (ROOT/path).read_text(encoding="utf8") for _,_,path in cases}
    mapping=[]
    for ident,phase,path in cases:
        part,num=ident.split("-AT-")
        expr=re.compile(r"'("+phase+"_"+part+"_AT"+num+r"_[A-Z0-9_]*PASS)'")
        found=list(dict.fromkeys(expr.findall(paths[path])))
        assert len(found)<=1,"AMBIGUOUS_SQL_SOURCE_SIGNAL:"+ident
        assert bool(found)==(ident not in NO_MARKER),"SOURCE_MARKER_CENSUS_CHANGED:"+ident
        mapping.append({"acceptanceId":ident,"phase":phase,"sqlSourcePath":path,
                        "exactAssertionMarker":found[0] if found else None})
    assert len({x["exactAssertionMarker"] for x in mapping if x["exactAssertionMarker"]})==96
    return mapping

def runtime():
    assert os.getenv("CI")=="true" and not os.getenv("VERCEL"),"CI_NO_VERCEL"
    assert os.getenv("TTO_PH10_SOURCE100_DISPOSABLE")=="true","EPHEMERAL_ONLY"
    sha,run=os.getenv("GITHUB_SHA",""),os.getenv("GITHUB_RUN_ID","")
    assert SHA.fullmatch(sha) and run.isdigit(),"RUN_PROVENANCE_MISSING"
    logs=Path(os.environ["RUNNER_TEMP"]).resolve()/"ph10-source100-markers"
    assert logs.is_dir(),"SOURCE100_LOG_DIR_MISSING"
    mapping=source()
    files={x["sqlSourcePath"] for x in mapping}
    names={path:Path(path).name+".log" for path in files}
    assert len(set(names.values()))==16,"SOURCE100_LOG_BASENAME_COLLISION"
    stdout={}
    for path,name in names.items():
        log=logs/name
        assert log.is_file() and log.resolve().parent==logs,"SOURCE100_LOG_ABSENT:"+name
        s=log.read_text(encoding="utf8")
        stdout[path]=(set(line.strip() for line in s.splitlines()),hashlib.sha256(s.encode()).hexdigest())
    verified=0
    for row in mapping:
        marker=row["exactAssertionMarker"]
        actual=bool(marker and marker in stdout[row["sqlSourcePath"]][0])
        if marker and not actual:raise AssertionError("SOURCE100_EXECUTION_MARKER_MISSING:"+row["acceptanceId"])
        row.update({"evidenceLayer":"PER_ID_EXECUTED_SQL_MARKER" if actual else "SQL_SUITE_ONLY_NO_PER_ID_MARKER",
                    "scopedMarkerVerified":actual,
                    "scopedResult":"PASS_SCOPED_SQL_NOT_FULL_E2E" if actual else "BLOCKED_INDIVIDUAL_SQL_EVIDENCE",
                    "stdoutSha256":stdout[row["sqlSourcePath"]][1],
                    "commitSha":sha,"workflowRunId":run,
                    "formalAcceptance":"NOT_ACCEPTED","fullUserJourneyProven":False})
        verified+=int(actual)
    assert verified==96,"SOURCE100_PER_ID_VERIFIED_EXPECTED_96"
    blocked={x["acceptanceId"] for x in mapping if not x["scopedMarkerVerified"]}
    assert blocked==NO_MARKER,"SOURCE100_MISSING_IDS_CHANGED"
    result={"schemaVersion":"1.0","commitSha":sha,"workflowRunId":run,
            "completedSqlSuiteSourceIdCount":100,
            "individualExecutedSqlSignalCount":96,
            "noIndividualSqlSignalCount":4,
            "noIndividualSignalIds":sorted(blocked),
            "executionScope":"DISPOSABLE_POSTGRES17_SQL_ONLY",
            "all155FormalE2EAcceptance":False,"operationalRelease":"HOLD","cases":mapping}
    ART.mkdir(exist_ok=True)
    (ART/"ph10_source100_individual_sql_evidence.json").write_text(
        json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("PH10_SOURCE100_PER_ID_REAL_SQL_MARKERS=96/100_UNPROVEN_OPS4=4_FULL_E2E=0/100")

def main():
    a=argparse.ArgumentParser()
    g=a.add_mutually_exclusive_group(required=True)
    g.add_argument("--validate",action="store_true")
    g.add_argument("--runtime",action="store_true")
    z=a.parse_args()
    if z.validate:
        q=source()
        assert sum(bool(v["exactAssertionMarker"]) for v in q)==96
        print("PH10_SOURCE100_STATIC_UNIQUE_MARKER_MAP_96_OF_100_NOT_EXECUTED")
    else:runtime()

if __name__=="__main__":
    try:main()
    except (AssertionError,OSError,KeyError,ValueError) as exc:
        print("PH10_SOURCE100_FAIL_CLOSED",str(exc),file=sys.stderr)
        sys.exit(1)
