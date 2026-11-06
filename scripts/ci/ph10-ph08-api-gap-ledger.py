#!/usr/bin/env python3
"""PH08 frozen 36: classify existing real HTTP slices without false full-ID acceptance."""
import argparse,json,os,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FROZEN=ROOT/"docs/analysis/ACCEPTANCE_IDS.json"
SOURCE=ROOT/"docs/analysis/PH08_OFFICIAL_SOURCE36.json"
OUT=ROOT/"ph10-artifacts/ph10_ph08_36_http_gap_ledger.json"
PREFLIGHT_ONLY_IDS=["MKT-AT-002","MKT-AT-003","PROC-AT-001","PROC-AT-003","PROC-AT-006"]
CONTRACT=ROOT/"docs/contracts/PH08_FIVE_BLOCKED_OPERATIONS_CONTRACT_v1.json"
MARKERS={
 "MKT-AT-002":"PH10_REAL_HTTP_PH08_MKT_AT002_COOPERATIVE_SELLER_PREFLIGHT_ONLY_PASS",
 "MKT-AT-003":"PH10_REAL_HTTP_PH08_MKT_AT003_VERSIONED_REFUND_PREFLIGHT_ONLY_PASS",
 "PROC-AT-001":"PH10_REAL_HTTP_PH08_PROC_AT001_DEADLINE_PREFLIGHT_NO_BID_PASS",
 "PROC-AT-003":"PH10_REAL_HTTP_PH08_PROC_AT003_FROZEN_CRITERIA_PREFLIGHT_NO_EDIT_PASS",
 "PROC-AT-006":"PH10_REAL_HTTP_PH08_PROC_AT006_VERSIONED_THRESHOLD_PREFLIGHT_ONLY_PASS",
 "LEARN-AT-005":"PH10_REAL_HTTP_PH08_LEARN_AT005_RETIRED_COURSE_MEMBER_HISTORY_PASS",
 "PROJ-AT-002":"PH10_REAL_HTTP_PH08_PROJ_AT002_FOREIGN_COUNTY_NO_AUTO_AUTHORITY_PASS",
 "VOICE-AT-006":"PH10_REAL_HTTP_PH08_VOICE_AT006_EXPLICIT_HANDOFF_NO_AUTO_PROJECT_PASS",
 "BEN-AT-001":"PH10_REAL_HTTP_PH08_BEN_AT001_POLICYLESS_LIMITED_BENEFIT_REJECTED_PASS",
 "MKT-AT-001":"PH10_REAL_HTTP_PH08_MKT_AT001_SUPPLIER_INQUIRY_NEVER_PUBLIC_OFFER_PASS",
 "MKT-AT-004":"PH10_REAL_HTTP_PH08_MKT_AT004_SPONSORED_LABEL_TENANT_PRIVACY_PASS",
 "LEARN-AT-003":"PH10_REAL_HTTP_PH08_LEARN_AT003_REAL_VACANCY_PROMOTION_PASS",
 "PROC-AT-005":"PH10_REAL_HTTP_PH08_PROC_AT005_CONFLICT_OF_INTEREST_ELIGIBILITY_GUARD_PASS",
 "PROJ-AT-003":"PH10_REAL_HTTP_PH08_PROJ_AT003_MANAGER_MILESTONE_SINGLE_AUDIT_EVENT_PASS",
 "PROJ-AT-006":"PH10_REAL_HTTP_PH08_PROJ_AT006_VERSION_ONLY_CONCURRENT_CAS_PASS",
 "VOICE-AT-005":"PH10_REAL_HTTP_PH08_VOICE_AT005_SMALL_COHORT_MEMBER_ONLY_SUPPRESSION_PASS",
 "PROJ-AT-004":"PH10_REAL_HTTP_PH08_PROJ_AT004_READONLY_NO_OWNERSHIP_FIELDS_PASS",
 "VOICE-AT-001":"PH10_REAL_HTTP_PH08_VOICE_AT001_RECORDED_RESPONSE_NONLEGAL_PASS",
 "LEARN-AT-002":"PH10_REAL_HTTP_PH08_LEARN_AT002_SINGLE_ACTOR_CONCURRENT_CAPACITY_BOUNDARY_PASS",
 "LEARN-AT-006":"PH10_REAL_HTTP_PH08_LEARN_AT006_REFUND_POLICY_READ_VERSION_PASS",
 "BEN-AT-004":"PH10_REAL_HTTP_PH08_BEN_AT004_EXPIRED_VOUCHER_NO_WRITE_PASS",
 "BEN-AT-006":"PH10_REAL_HTTP_PH08_BEN_AT006_NONCASH_NOT_DIVIDEND_READ_PASS",
 "MKT-AT-006":"PH10_REAL_HTTP_PH08_MKT_AT006_FOREIGN_SELLER_READ_DENIED_PASS",
 "PROC-AT-002":"PH10_REAL_HTTP_PH08_PROC_AT002_SEALED_BID_METADATA_HIDDEN_PASS",
 "PROJ-AT-005":"PH10_REAL_HTTP_PH08_APPROVED_PROJECT_DISCLOSURE_PASS",
 "VOICE-AT-002":"PH10_REAL_HTTP_PH08_VOICE_AT002_EXPIRED_NO_EFFECT_PASS",
 "VOICE-AT-003":"PH10_REAL_HTTP_PH08_POLL_DUPLICATE_AND_AUDIENCE_PASS",
 "VOICE-AT-004":"PH10_REAL_HTTP_PH08_POLL_DUPLICATE_AND_AUDIENCE_PASS",
 "LEARN-AT-001":"PH10_REAL_HTTP_PH08_ENROLL_CAPACITY_DUPLICATE_ROLE_PASS",
 "BEN-AT-002":"PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS",
 "BEN-AT-003":"PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS",
 "BEN-AT-005":"PH10_REAL_HTTP_PH08_VOUCHER_SINGLE_USE_AND_NO_CASH_PASS",
}
ABSENT_ROUTE_MARKERS={
 "PROJ-AT-001":"PH10_REAL_HTTP_PH08_PROJ_AT001_ABSENT_ACTIVATION_ROUTE_GUARD_PASS",
 "LEARN-AT-004":"PH10_REAL_HTTP_PH08_LEARN_AT004_ABSENT_CERTIFICATE_ROUTE_GUARD_PASS",
 "MKT-AT-005":"PH10_REAL_HTTP_PH08_MKT_AT005_ABSENT_TARGETING_ROUTE_GUARD_PASS",
 "PROC-AT-004":"PH10_REAL_HTTP_PH08_PROC_AT004_ABSENT_PAYMENT_POOL_ROUTE_GUARD_PASS",
}
BFF_SCOPE_MARKERS={
 "MKT-AT-002": "PH10_REAL_BFF_PH08_MKT_AT002_CHECKOUT_PREFLIGHT_SCOPED_PASS",
 "MKT-AT-003": "PH10_REAL_BFF_PH08_MKT_AT003_REFUND_PREFLIGHT_SCOPED_PASS",
 "PROC-AT-001": "PH10_REAL_BFF_PH08_PROC_AT001_LATE_BID_PREFLIGHT_SCOPED_PASS",
 "PROC-AT-003": "PH10_REAL_BFF_PH08_PROC_AT003_CRITERIA_LOCK_PREFLIGHT_SCOPED_PASS",
 "PROC-AT-006": "PH10_REAL_BFF_PH08_PROC_AT006_POLICY_VERSIONS_PREFLIGHT_SCOPED_PASS"
}
PATHS={
 "PROJ":["GET /v1/tenants/{tenantId}/ph08/projects/disclosures","GET /v1/tenants/{tenantId}/ph08/projects/branches/{branchId}/authority-state"],
 "VOICE":["GET /v1/tenants/{tenantId}/ph08/voice/open-polls","POST /v1/tenants/{tenantId}/ph08/voice/{pollId}/respond","GET /v1/tenants/{tenantId}/ph08/voice/proposals/{proposalId}/handoff-state"],
 "LEARN":["GET /v1/tenants/{tenantId}/ph08/learning/events","POST /v1/tenants/{tenantId}/ph08/learning/events/{eventId}/enroll","GET /v1/tenants/{tenantId}/ph08/learning/retired-history"],
 "BEN":["GET /v1/tenants/{tenantId}/ph08/benefits/my-vouchers","POST /v1/tenants/{tenantId}/ph08/benefits/vouchers/{voucherId}/redeem","GET /v1/tenants/{tenantId}/ph08/benefits/{benefitId}/activation-prerequisites"],
 "MKT":["GET /v1/tenants/{tenantId}/ph08/market/offers","GET /v1/tenants/{tenantId}/ph08/market/sponsored-creatives","POST /v1/tenants/{tenantId}/ph08/market/supplier-proposals","GET /v1/tenants/{tenantId}/ph08/market/offers/{offerId}/checkout-preflight","GET /v1/tenants/{tenantId}/ph08/market/orders/{orderId}/refund-policy-preflight"],
 "PROC":["GET /v1/tenants/{tenantId}/ph08/procurement/tenders","GET /v1/tenants/{tenantId}/ph08/procurement/tenders/{tenderId}/bid-deadline-preflight","GET /v1/tenants/{tenantId}/ph08/procurement/tenders/{tenderId}/criteria-lock-preflight","GET /v1/tenants/{tenantId}/ph08/procurement/threshold-policies/{policyCode}/version-preflight"],
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
   last=path.split("/ph08/")[-1].replace("{eventId}",":eventId").replace("{pollId}",":pollId").replace("{voucherId}",":voucherId").replace("{branchId}",":branchId").replace("{proposalId}",":proposalId").replace("{benefitId}",":benefitId").replace("{offerId}",":offerId").replace("{orderId}",":orderId").replace("{tenderId}",":tenderId").replace("{policyCode}",":policyCode")
   assert last in text,"NEST_ROUTE_MISSING:"+last
 assert set(MARKERS).isdisjoint(ABSENT_ROUTE_MARKERS)
 assert len(MARKERS)==32 and len(ABSENT_ROUTE_MARKERS)==4
 for ident,marker in {**MARKERS,**ABSENT_ROUTE_MARKERS}.items():
  assert ident in {x["id"] for x in raw} and marker in test,"RELATED_OR_ABSENCE_MARKER_MISSING:"+ident
 contract=json.loads(CONTRACT.read_text(encoding="utf-8"))
 assert contract["globalRules"]["readiness"]=="BLOCKED"
 assert contract["globalRules"]["fullSourceUserJourneyAccepted"] is False
 assert contract["globalRules"]["legalAuthorityVerified"] is False
 truth={x["id"]:x for x in raw}
 declared=contract["contracts"]
 assert len(declared)==5 and {x["id"] for x in declared}==set(PREFLIGHT_ONLY_IDS),"FIVE_CONTRACT_SET_DRIFT"
 for x in declared:
  original=truth[x["id"]]
  assert x["source"]==original["scenario"] and x["expected"]==original["expected"],"SOURCE_CONTRACT_DRIFT"
  assert x["method"]=="GET" and x["realOperation"]=="BLOCKED","MUTATION_GATE_REQUIRED"
  assert x["path"].startswith("/v1/tenants/{tenantId}/ph08/")
  assert x["path"] in [p.split(" ",1)[1] for p in PATHS[original["module"]]],"PATH_UNDECLARED"
 for ident,marker in BFF_SCOPE_MARKERS.items():
  assert ident in PREFLIGHT_ONLY_IDS and marker in test,"BFF_TEST_MARKER_MISSING:"+ident
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
  absence=ABSENT_ROUTE_MARKERS.get(ident)
  chosen=marker or absence
  found=bool(run and chosen and exact(log,chosen))
  bff_marker=BFF_SCOPE_MARKERS.get(ident)
  bff_found=bool(run and bff_marker and exact(log,bff_marker))
  grade=("PASS_RELATED_SCOPED_HTTP" if found and marker else
         "PASS_ABSENT_ROUTE_GUARD_ONLY" if found and absence else
         "NO_RELATED_EXACT_HEAD_EXECUTION" if chosen else
         "NO_SOURCE_ID_SPECIFIC_HTTP_PROOF")
  rows.append({"acceptanceId":ident,"module":group,"scenario":c["scenario"],"expected":c["expected"],
   "operationGate":"BLOCKED_PREFLIGHT_ONLY" if ident in PREFLIGHT_ONLY_IDS else ("BLOCKED_ABSENT_ROUTE" if absence else "NOT_FORMAL_E2E"),
   "bffAuthenticatedCrossLayerScoped":"PASS_READONLY_NEST_PG17" if bff_found else "NOT_PROVEN",
   "bffMarker":bff_marker,"fullBrowserUserJourneyAccepted":False,
   "sqlSourcePath":c["sqlFile"],"declaredRelatedNestEndpoints":PATHS[group],
   "relatedHttpMarker":chosen,"relatedHttpEvidence":grade,
   "relatedHttpRun":run if found else None,
   "sourceIdFullHttpJourneyPassed":False,"endToEndAccepted":False,
   "formalAcceptance":"NOT_ACCEPTED","operationalData":"NOT_USED",
   "remainingTechnicalGap":"DOMAIN_OPERATION_NOT_IMPLEMENTED_OR_NOT_PROVEN" if absence or not marker else "FULL_ORIGINAL_SCENARIO_HTTP_BROWSER_NOT_PROVEN"})
 count=sum(x["relatedHttpEvidence"]=="PASS_RELATED_SCOPED_HTTP" for x in rows)
 absence_count=sum(x["relatedHttpEvidence"]=="PASS_ABSENT_ROUTE_GUARD_ONLY" for x in rows)
 bff_count=sum(x["bffAuthenticatedCrossLayerScoped"]=="PASS_READONLY_NEST_PG17" for x in rows)
 OUT.parent.mkdir(exist_ok=True)
 OUT.write_text(json.dumps({"schemaVersion":"1.0","phase":"PH08","frozenSourceCount":36,
    "sqlSourceAssertionsAlreadyRunSeparately":36,"relatedRealHttpScopedEvidenceCount":count,
    "absenceOnlyRouteGuards":absence_count,
    "fivePreflightSourceIds":PREFLIGHT_ONLY_IDS,
    "preflightOperationalRelease":"BLOCKED",
    "bffPreflightReadOnlySourceCount":bff_count,
    "remainingNoDirectHttpProbeCount":36-count-absence_count,
    "full36SourceIdHttpJourneyCount":0,"formalEndToEndAcceptedCount":0,"run":run,
    "sourceEvidenceClassification":"RELATED_HTTP_IS_NOT_EXACT_SOURCE_ID_FULL_E2E",
    "cases":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(f"PH08_36_HTTP_GAP_CENSUS_RELATED={count}/36_ABSENT_ONLY={absence_count}_NO_DIRECT_PROBE={36-count-absence_count}_FULL_SOURCE_ID_HTTP=0/36_FORMAL_E2E=0/36")
 print(f"PH08_READONLY_FIVE_BFF_TO_NEST_TO_PG17={bff_count}/5_FORMAL_E2E=0/155")
 return 0 if not log_path or (count==len(MARKERS) and absence_count==len(ABSENT_ROUTE_MARKERS) and bff_count==5) else 1

if __name__=="__main__":
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group(required=True)
 g.add_argument("--validate-source",action="store_true");g.add_argument("--http-log")
 a=p.parse_args()
 try:sys.exit(census(None if a.validate_source else a.http_log))
 except (AssertionError,ValueError,OSError,KeyError) as e:
  print("PH08_GAP_CENSUS_FAIL_CLOSED",str(e),file=sys.stderr);sys.exit(1)
