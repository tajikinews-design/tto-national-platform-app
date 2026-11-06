#!/usr/bin/env python3
"""PH10 exact-run cross-job source155 evidence join. Synthetic CI only.

A completed source-scoped test never establishes a full end-to-end user journey,
external source authenticity, or legal acceptance. No test execution here.
"""
import json
import os
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/"ph10-artifacts"
PHASES=[("PH04",0,16),("PH05",16,40),("PH06",40,55),
        ("PH07",55,81),("PH08",81,117),("PH09",117,155)]
MODULE09={"OPP":"opportunities","IMPACT":"impact","GRC":"grc",
          "NI":"network-intelligence","DG":"data-governance","OPS":"operations"}

def j(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def need(condition, code):
    if not condition: raise AssertionError(code)

def run_matches(ref, sha, run_id):
    need(isinstance(ref,dict), "MISSING_RUN_RECORD")
    need(ref.get("commitSha")==sha, "CROSS_COMMIT_EVIDENCE_DENIED")
    need(str(ref.get("runId",ref.get("workflowRunId")))==run_id, "CROSS_RUN_EVIDENCE_DENIED")

def joined(sha,run_id,artifacts=ART):
    need(re.fullmatch(r"[0-9a-f]{40}",sha) and run_id.isdigit(),"INVALID_PROVENANCE")
    frozen=j(ROOT/"docs/analysis/ACCEPTANCE_IDS.json")
    official=j(ROOT/"docs/analysis/PH10_OFFICIAL_155_SCENARIOS.json")["cases"]
    need(len(frozen)==len(official)==155,"SOURCE_COUNT_DRIFT")
    original_ids=[x["id"] for x in frozen]
    need(original_ids==[x["id"] for x in official] and len(set(original_ids))==155,
         "SOURCE_ID_SEQUENCE_OR_DUPLICATE")
    first=j(artifacts/"ph10_155_exact_run_sql_ledger.json")
    per_sql=j(artifacts/"ph10_source100_individual_sql_evidence.json")
    f55=j(artifacts/"ph10_frozen55_exact_evidence.json")
    auth=j(artifacts/"ph10_ph04_auth8_exact_evidence.json")
    tenants=j(artifacts/"ph10_ph04_tenant8_exact_evidence.json")
    p8=j(artifacts/"ph10_ph08_36_http_gap_ledger.json")
    ops=j(artifacts/"ph10_ops_four_exact_evidence.json")
    route=j(artifacts/"ph10_page_api_inventory.json")
    recovery=(artifacts/"ph10_g5_restore_stdout.log").read_text(encoding="utf-8")
    need("PH10_G5_DISPOSABLE_BACKUP_RESTORE_PASS" in {x.strip() for x in recovery.splitlines()},
         "G5_BACKUP_RESTORE_PROOF_MISSING")
    for item in (first,f55,per_sql,ops):
        need(item.get("commitSha",item.get("run",{}).get("commitSha"))==sha,
             "SQL_LEDGER_SHA_MISMATCH")
        need(str(item.get("workflowRunId",item.get("run",{}).get("workflowRunId")))==run_id,
             "SQL_LEDGER_RUN_MISMATCH")
    for item in (auth,tenants,p8):
        run_matches(item["run"] if "run" in item else None,sha,run_id)
    need(route.get("headSha")==sha, "PAGE_INVENTORY_SHA_MISMATCH")
    need({x["portal"] for x in route["pages"]} ==
         {"shareholder","cooperative-management","national-admin"},
         "THREE_PORTAL_INVENTORY_MISSING")
    need(first.get("sqlVerifiedIds")==100 and len(first["cases"])==155,
         "100_SQL_CENSUS_MISSING")
    need(per_sql.get("completedSqlSuiteSourceIdCount")==100 and
         per_sql.get("individualExecutedSqlSignalCount")==96 and
         per_sql.get("noIndividualSqlSignalCount")==4 and
         per_sql.get("noIndividualSignalIds")==["OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"],
         "SOURCE100_96_PLUS_4_TRUTH_CENSUS_MISSING")
    need(f55.get("ph05Ph06SourceScopedPass")==39 and len(f55["cases"])==55,
         "FROZEN55_RUNTIME_MISSING")
    need(p8.get("relatedRealHttpScopedEvidenceCount")==32 and
         p8.get("absenceOnlyRouteGuards")==4 and
         p8.get("bffPreflightReadOnlySourceCount")==5,
         "PH08_HTTP_SCOPED_CENSUS_MISSING")
    need(p8.get("formalEndToEndAcceptedCount")==0,
         "UNTRUSTED_PH08_E2E_PROMOTION")
    need(ops.get("operationsSourceSpecificScopedPass")==3 and
         ops.get("operationsDesignOnly")==1 and
         ops.get("tenantBearingTablesCompared",0)>=3 and
         ops.get("migrationFilesCleanReplayed",0)>=10 and
         ops.get("formalAcceptanceCount")==0 and
         ops.get("source155FullUserJourneysAccepted") is False,
         "OPS_FOUR_EXACT_SCOPE_PROOF_MISSING")
    keyed=lambda xs:{v["acceptanceId"]:v for v in xs}
    sql,older,ac,tc,api,source100,ops_rows=map(keyed,(first["cases"],f55["cases"],auth["cases"],tenants["cases"],p8["cases"],per_sql["cases"],ops["cases"]))
    need(set(sql)==set(original_ids),"SQL_SOURCE_DRIFT")
    need(set(source100)==set(original_ids[55:]),"SOURCE100_INDIVIDUAL_ID_DRIFT")
    need(set(older)==set(original_ids[:55]),"FROZEN55_DRIFT")
    need(set(ac)==set(original_ids[:8]) and set(tc)==set(original_ids[8:16]),
         "PH04_AUTH_OR_TENANT_COVERAGE_DRIFT")
    need(set(api)==set(original_ids[81:117]),"PH08_SOURCE_ID_DRIFT")
    need(set(ops_rows)=={"OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"},
         "OPS_FOUR_ID_DRIFT")
    for k,v in ops_rows.items():
        need(v["commitSha"]==sha and str(v["workflowRunId"])==run_id and
             v["formalAcceptance"]=="NOT_ACCEPTED" and
             v["fullSourceUserJourneyPassed"] is False,"OPS_FALSE_SOURCE_PROMOTION:"+k)
        need(v["scopedTechnicalPassed"]==(k!="OPS-AT-001"),"OPS_UNEXPECTED_SCOPE:"+k)
    source07={v["id"]:v for v in j(ROOT/"docs/analysis/PH07_26_SOURCE_ACCEPTANCE.json")["cases"]}
    source08={v["id"]:v for v in j(ROOT/"docs/analysis/PH08_OFFICIAL_SOURCE36.json")["cases"]}
    source09={v["id"]:v for v in j(ROOT/"docs/analysis/PH09_OFFICIAL_SOURCE38.json")["cases"]}
    need(set(source07)==set(original_ids[55:81]) and
         set(source08)==set(original_ids[81:117]) and
         set(source09)==set(original_ids[117:155]),"MODULE_MANIFEST_DRIFT")
    rows=[]
    for i,v in enumerate(official):
        ident=v["id"]
        phase=next(p for p,a,b in PHASES if a<=i<b)
        row={"acceptanceId":ident,"phase":phase,
             "sourceScenario":v["sourceScenario"],"sourceExpected":v["sourceExpected"],
             "exactCommitSha":sha,"workflowRunId":run_id,
             "formalAcceptance":"NOT_ACCEPTED","fullSourceUserJourneyPassed":False,
             "independentLegalSourceVerified":False,
             "productionOrFinancialOperationPerformed":False}
        if phase=="PH04":
            d=(ac if i<8 else tc)[ident]
            need(d["status"]=="PASS_SCOPED_NOT_FULL_E2E","PH04_MISSING_SCOPED_MARKER:"+ident)
            run_matches(d.get("run"),sha,run_id)
            need(d.get("fullEndToEndPassed") is False,"PH04_FALSE_ACCEPTANCE")
            row.update(evidenceLayer=d["evidenceLayer"],testPath=d["testPath"],
                       assertionMarker=d["expectedMarker"],job=d["run"]["job"],
                       scopedTechnicalResult=d["status"])
        elif phase in ("PH05","PH06"):
            d=older[ident]
            need(d.get("status")=="PASS_SCOPED_NOT_FULL_E2E","PH05_06_MISSING_MARKER:"+ident)
            need(d.get("workflowRunId")==run_id and d.get("commitSha")==sha,
                 "PH05_06_CROSS_RUN_DENIED")
            need(d.get("stdoutSha256") and d.get("sourceSha256"),"MISSING_SOURCE_HASH")
            row.update(evidenceLayer=d["evidenceLayer"],testPath=d["testPath"],
                       assertionMarker=d["expectedMarker"],job=d["job"],
                       scopedTechnicalResult=d["status"],
                       testOutputSha256=d["stdoutSha256"],testSourceSha256=d["sourceSha256"])
        else:
            d=sql[ident]
            need(d.get("sqlSuiteExecutedWithinThisJob") is True and
                 d.get("sqlSuiteResult")=="PASS_SCOPED_SQL" and
                 str(d.get("workflowRunId"))==run_id and
                 d.get("commitSha")==sha,"SQL_SOURCE_CI_NOT_PROVEN:"+ident)
            path=(source07[ident]["assertionSql"] if phase=="PH07" else
                  source08[ident]["sqlFile"] if phase=="PH08" else
                  "tests/sql/ph09-"+MODULE09[source09[ident]["module"]]+"-acceptance.sql")
            need((ROOT/path).is_file(),"SOURCE_TEST_NOT_FOUND:"+ident)
            signal=source100[ident]
            need(signal["sqlSourcePath"]==path and
                 signal.get("commitSha")==sha and
                 str(signal.get("workflowRunId"))==run_id,
                 "SOURCE100_PER_ID_PROVENANCE_DRIFT:"+ident)
            verified=signal["scopedMarkerVerified"] is True
            need(verified==(ident not in {"OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"}),
                 "SOURCE100_UNEXPECTED_INDIVIDUAL_RESULT:"+ident)
            need(signal.get("fullUserJourneyProven") is False and
                 signal.get("formalAcceptance")=="NOT_ACCEPTED",
                 "SOURCE100_FALSE_LEGAL_OR_E2E_PROMOTION:"+ident)
            row.update(evidenceLayer=signal["evidenceLayer"],
                       testPath=path,
                       assertionMarker=signal["exactAssertionMarker"],
                       sourceSqlOutputSha256=signal["stdoutSha256"],
                       job="source-sql-and-actual-api",
                       scopedTechnicalResult=signal["scopedResult"])
            if ident in ops_rows:
                scoped=ops_rows[ident]
                row.update(independentOpsEvidenceLayer=scoped["evidenceLayer"],
                           independentOpsTestPath=scoped["testPath"],
                           independentOpsAssertionMarker=scoped["assertionMarker"],
                           independentOpsScopedTechnicalPassed=scoped["scopedTechnicalPassed"],
                           independentOpsScopedResult=scoped["scopedResult"])
                row["opsIndependentBoundary"]="DESIGN_ONLY_NOT_RUNTIME" if ident=="OPS-AT-001" else "PG17_SCOPED_NOT_FULL_SOURCE_E2E"
            if phase=="PH08":
                extra=api[ident]
                need(extra["formalAcceptance"]=="NOT_ACCEPTED" and
                     extra["sourceIdFullHttpJourneyPassed"] is False,
                     "PH08_FALSE_E2E")
                row.update(relatedHttpScope=extra["relatedHttpEvidence"],
                           relatedHttpMarker=extra["relatedHttpMarker"],
                           bffPreflightScope=extra["bffAuthenticatedCrossLayerScoped"])
        rows.append(row)
    need(len(rows)==len(set(v["acceptanceId"] for v in rows))==155,
         "FINAL_155_INCOMPLETE")
    need(all(not v["fullSourceUserJourneyPassed"] and
                 v["formalAcceptance"]=="NOT_ACCEPTED" for v in rows),
         "INFLATED_E2E_ACCEPTANCE")
    counts={p:sum(v["phase"]==p for v in rows) for p,_,_ in PHASES}
    need(counts=={"PH04":16,"PH05":24,"PH06":15,"PH07":26,"PH08":36,"PH09":38},
         "PHASE_COUNTS_CHANGED")
    return {"schemaVersion":"1.0","commitSha":sha,"runId":run_id,
            "scope":"EXACT_HEAD_SYNTHETIC_SQL_HTTP_BROWSER_AND_PG17_RECOVERY",
            "phaseCounts":counts,"sourceIdsClassified":155,"sourceIdsFormallyAccepted":0,
            "all155CompleteUserJourneysProven":False,
            "threePortalInventory":"STATIC_INVENTORY_NOT_ALL_ROLES_E2E",
            "sql100SuiteCompleted":100,"perSourceSqlExecutedMarkersVerified":96,
            "sourceSqlWithoutPerIdEvidence":["OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"],
            "opsOutOfBandScopedRuntimeProven":3,
            "opsLegacyDesignReconciliationProven":1,
            "opsFullUserJourneysProven":0,
            "ph08SourceHttp":"32_RELATED_4_ABSENT_ROUTE_NOT_FULL_E2E",
            "g5DisposableBackupRestore":"PASS_IN_CI_NONPRODUCTION",
            "legalSourceAuthenticity":"BLOCKED","release":"HOLD",
            "warnings":["Case-level HTTP/browser may be related, not full source acceptance",
                        "Legal authority and real source verification not established",
                        "PH05 legacy workflow validation is tracked separately"],
            "cases":rows}

def main():
    need(os.getenv("CI")=="true" and not os.getenv("VERCEL"),
         "ISOLATED_CI_ONLY")
    sha,run=os.getenv("GITHUB_SHA",""),os.getenv("GITHUB_RUN_ID","")
    result=joined(sha,run)
    ART.mkdir(exist_ok=True)
    (ART/"ph10_155_crossjob_truth_ledger.json").write_text(
        json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PH10_155_EXACT_CROSSJOB_CLASSIFIED=155_PER_SOURCE_SQL=96/100_OPS_INDEPENDENT_SCOPED=3_DESIGN=1_FORMAL_E2E=0_RELEASE_HOLD")
    print("PH10_G5_EXACT_HEAD_PG17_RECOVERY_VERIFIED_NONPRODUCTION")

if __name__=="__main__":
    try: main()
    except (OSError,KeyError,AssertionError,ValueError) as exc:
        print("PH10_155_JOIN_FAIL_CLOSED",str(exc),file=sys.stderr)
        sys.exit(1)
