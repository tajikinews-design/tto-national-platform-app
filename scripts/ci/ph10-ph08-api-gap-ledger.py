#!/usr/bin/env python3
"""PH08 frozen 36: classify existing real HTTP slices without false full-ID acceptance."""
import argparse,json,os,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FROZEN=ROOT/"docs/analysis/ACCEPTANCE_IDS.json"
SOURCE=ROOT/"docs/analysis/PH08_OFFICIAL_SOURCE36.json"
OUT=ROOT/"ph10-artifacts/ph10_ph08_36_http_gap_ledger.json"
MARKERS={
 "PROJ-AT-005":"PH10_REAL_HTTP_PH08_APPROVED_PROJECT_DISCLOSURE_PASS",
 "VOICE-AT-003":"PH10_REAL_HTTP_PH08_POLL_DUPLICATE_AND_AUDIENCE_PASS",
 "VOICE-AT-004":"PH10_REAL_HTTP_PH08_POLL_DUPLICATE_AND_AUDIENCE_PASS",
 "LEARN-AT-001":"PH10_REAL_HTTP_PH08_ENROLL_CAPACITY_DUPLICATE_ROLE_PASS",
 "BEN-AT-002":"PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS",
 "BEN-AT-003":"PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS",
 "BEN-AT-005":"PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS",
}
PATHS={
 "PROJ":["GET /v1/tenants/{tenantId}/ph08/projects/disclosures"],
 "VOICE":["GET /v1/tenants/{tenantId}/ph08/voice/open-polls","POST /v1/tenants/{tenantId}/ph08/voice/{pollId}/respond"],
 "LEARN":["GET /v1/tenants/{tenantId}/ph08/learning/events","POST /v1/tenants/{tenantId}/ph08/learning/events/{eventId}/enroll"],
 "BEN":["GET /v1/tenants/{tenantId}/ph08/benefits/my-vouchers","POST /v1/tenants/{tenantId}/ph08/benefits/vouchers/{voucherId}/redeem"],
 "MKT":["GET /v1/tenants/{tenantId}/ph08/market/offers"],
 "PROC":["GET /v1/tenants/{tenantId}/ph08/procurement/tenders"],
}
NEST=ROOT/"services/api/src/module.ts"
HTTP=ROOT/"services/api/test/ph09-portal.http.integration.cjs"

def source():
 frozen=json.loads(FROZEN.read_text(encoding="utf-8"))
 raw=json.loads(SOURCE.read_text(encoding="utf-8"))["cases"]
 assert len(frozen)==155 and len(raw)==36
 assert len({x["id"] for x in frozen})==155 and len({x["id"] for x in raw})==36
 assert [x["id"] for x in frozen[81:117]]==[x["id"] for x in raw],"PH08_FROZEN_IDS_CHANGED"
 assert set(x["module"] for x in raw)==set(PATHS)
 text=NEST.read_text(encoding="utf-8")
 test=HTTP.read_text(encoding="utf-8")
 for v in PATHS.values():
  for endpoint in v:
   method,path=endpoint.split(" ",1)
   last=path.split("/ph08/")[-1].replace("{eventId}",":eventId").replace("{pollId}",":pollId")
   assert last in text,"NEST_ROUTE_MISSING:"+last
 for ident,marker in MARKERS.items():
  assert ident in {x["id"] for x in raw} and marker in test,"RELATED_TEST_MARKER_MISSING:"+ident
 for c in raw:assert (ROOT/c["sqlFile"]).is_file(),"SOURCE_SQL_MISSING:"+c["id"]
 return raw

def exact(log,marker):
 return marker in {line.strip() for line in log.splitlines()}

def census(log_path=None):
 cases=source()
 run=None; log=""
 if log_path:
  assert os.getenv("CI")=="true" and os.getenv("TTO_PH10_FROZEN55_DISPOSABLE")=="true"
  assert not os.getenv("VERCEL")
  sha,runid=os.getenv("GITHUB_SHA",""),os.getenv("GITHUB_RUN_ID","")
  assert re.fullmatch(r"[0-9a-f]{40}",sha) and runid.isdigit()
  p=Path(log_path).resolve()
  assert p.parent==Path(os.environ["RUNNER_TEMP"]).resolve() and p.name=="ph08-real-http-stdout.log","UNTRUSTED_LOG"
  log=p.read_text(encoding="utf-8")
  run={"commitSha":sha,"runId":runid,"job":os.getenv("GITHUB_JOB","UNKNOWN")}
 rows=[]
 for c in cases:
  ident,group=c["id"],c["module"]
  marker=MARKERS.get(ident)
  found=bool(run and marker and exact(log,marker))
  rows.append({"acceptanceId":ident,"module":group,"scenario":c["scenario"],"expected":c["expected"],
   "sqlSourcePath":c["sqlFile"],"declaredRelatedNestEndpoints":PATHS[group],
   "relatedHttpMarker":marker,"relatedHttpEvidence":"PASS_RELATED_SCOPED_HTTP" if found else
     ("NO_RELATED_EXACT_HEAD_EXECUTION" if marker else "NO_SOURCE_ID_SPECIFIC_HTTP_PROOF"),
   "relatedHttpRun":run if found else None,
   "sourceIdFullHttpJourneyPassed":False,"endToEndAccepted":False,
   "formalAcceptance":"NOT_ACCEPTED","operationalData":"NOT_USED"})
 count=sum(x["relatedHttpEvidence"]=="PASS_RELATED_SCOPED_HTTP" for x in rows)
 OUT.parent.mkdir(exist_ok=True)
 OUT.write_text(json.dumps({"schemaVersion":"1.0","phase":"PH08","frozenSourceCount":36,
    "sqlSourceAssertionsAlreadyRunSeparately":36,"relatedRealHttpScopedEvidenceCount":count,
    "full36SourceIdHttpJourneyCount":0,"formalEndToEndAcceptedCount":0,"run":run,
    "sourceEvidenceClassification":"RELATED_HTTP_IS_NOT_EXACT_SOURCE_ID_FULL_E2E",
    "cases":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(f"PH08_36_HTTP_GAP_CENSUS_RELATED={count}/36_FULL_SOURCE_ID_HTTP=0/36_FORMAL_E2E=0/36")
 return 0 if not log_path or count==len(MARKERS) else 1

if __name__=="__main__":
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group(required=True)
 g.add_argument("--validate-source",action="store_true");g.add_argument("--http-log")
 a=p.parse_args()
 try:sys.exit(census(None if a.validate_source else a.http_log))
 except (AssertionError,ValueError,OSError,KeyError) as e:
  print("PH08_GAP_CENSUS_FAIL_CLOSED",str(e),file=sys.stderr);sys.exit(1)
