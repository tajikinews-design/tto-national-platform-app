#!/usr/bin/env python3
"""Frozen PH04 source IDs: scoped isolated evidence, NEVER full E2E or legal GREEN."""
import argparse,json,os,re,subprocess,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"ph10-artifacts"
SOURCE="tests/sql/ph04-child02-source-eight.sql"
INGEST="tests/sql/ph04-child02-idempotent-ingest.sql"
RACE="scripts/ci/ph10-concurrent-tenant-slug.sh"
AUTH={
"CORE-AUTH-AT-001":"CORE_AUTH_AT001_TWO_TENANT_ROLE_INDEPENDENCE_HTTP_PASS",
"CORE-AUTH-AT-002":"CORE_AUTH_AT002_CROSS_TENANT_URL_EXACT_DENIAL_HTTP_PASS",
"CORE-AUTH-AT-003":"CORE_AUTH_AT003_EXPIRED_ROLE_ACTIVE_SESSION_HTTP_DENIED_PASS",
"CORE-AUTH-AT-004":"CORE_AUTH_AT004_PLATFORM_ADMIN_NO_JIT_TENANT_DENIAL_HTTP_PASS",
"CORE-AUTH-AT-005":"CORE_AUTH_AT005_OTP_REPLAY_SECOND_REJECT_HTTP_PASS",
"CORE-AUTH-AT-006":"CORE_AUTH_AT006_REVOKED_ROLE_STALE_TOKEN_HTTP_DENIED_PASS",
"CORE-AUTH-AT-007":"CORE_AUTH_AT007_JIT_REQUESTOR_SELF_APPROVAL_DENIED_HTTP_PASS",
"CORE-AUTH-AT-008":"CORE_AUTH_AT008_PERMISSION_WITHOUT_LEGAL_AUTHORITY_HTTP_DENIED_PASS"}
TENANT={
"CORE-TENANT-AT-001":(SOURCE,"CORE-TENANT-AT-001_SYNTHETIC_DIRECT_ASSERTION_PASS"),
"CORE-TENANT-AT-002":(SOURCE,"CORE-TENANT-AT-002_SYNTHETIC_AUTHORIZED_SLUG_COMMAND_PASS"),
"CORE-TENANT-AT-003":(RACE,"CORE_TENANT_AT003_TWO_INDEPENDENT_POSTGRES_SESSIONS_EXACT_SOURCE_PASS"),
"CORE-TENANT-AT-004":(SOURCE,"CORE-TENANT-AT-004_SYNTHETIC_DIRECT_ASSERTION_PASS"),
"CORE-TENANT-AT-005":(SOURCE,"CORE-TENANT-AT-005_SYNTHETIC_DIRECT_ASSERTION_PASS"),
"CORE-TENANT-AT-006":(SOURCE,"CORE-TENANT-AT-006_SYNTHETIC_DIRECT_ASSERTION_PASS"),
"CORE-TENANT-AT-007":(INGEST,"CORE-TENANT-AT-007_SYNTHETIC_DUPLICATE_EVENT_IDEMPOTENCY_PASS"),
"CORE-TENANT-AT-008":(SOURCE,"CORE-TENANT-AT-008_SYNTHETIC_DIRECT_SQL_PRIVILEGE_PASS")}
def frozen_check():
  s=json.loads((ROOT/"docs/analysis/ACCEPTANCE_IDS.json").read_text(encoding="utf-8"))
  c=json.loads((ROOT/"docs/analysis/PH10_OFFICIAL_155_SCENARIOS.json").read_text(encoding="utf-8"))["cases"]
  assert len(s)==len(c)==155 and len({x["id"] for x in s})==155
  assert [x["id"] for x in s[:16]]==list(AUTH)+list(TENANT)
  assert [x["id"] for x in c[:16]]==[x["id"] for x in s[:16]]
  for f in (SOURCE,INGEST,RACE):assert (ROOT/f).is_file()
  return s[:16],c[:16]
def exact_marker(log,marker):return marker in {x.strip() for x in log.splitlines()}
def metadata():
  assert os.getenv("CI")=="true","CI_ONLY"
  assert os.getenv("TTO_PH10_FROZEN55_DISPOSABLE")=="true","DISPOSABLE_REQUIRED"
  assert not os.getenv("VERCEL"),"VERCEL_FORBIDDEN"
  assert os.getenv("TTO_ENABLE_REAL_SMSOTP_DELIVERY","false").lower()!="true","LIVE_SMS_FORBIDDEN"
  sha,run=os.getenv("GITHUB_SHA",""),os.getenv("GITHUB_RUN_ID","")
  assert re.fullmatch(r"[0-9a-f]{40}",sha) and run.isdigit(),"PROVENANCE_REQUIRED"
  return {"commitSha":sha,"runId":run,"job":os.getenv("GITHUB_JOB","UNKNOWN")}
def save(name,group,cases,m,results):
  rows=[]
  for c in cases:
    ident=c["id"];file,marker,layer,passed=results[ident]
    rows.append({"acceptanceId":ident,"sourceScenario":c["sourceScenario"],"sourceExpected":c["sourceExpected"],
      "testPath":file,"expectedMarker":marker,"evidenceLayer":layer,
      "status":"PASS_SCOPED_NOT_FULL_E2E" if passed else "BLOCKED_NO_EXACT_EVIDENCE",
      "run":m if passed else None,"formalAcceptance":"NOT_ACCEPTED",
      "fullEndToEndPassed":False,"legalAuthorityVerified":False})
  count=sum(x["status"].startswith("PASS") for x in rows)
  OUT.mkdir(exist_ok=True)
  (OUT/name).write_text(json.dumps({"schemaVersion":"1.0","group":group,"passed":count,
    "sourceIds":len(rows),"all155FormalAcceptance":False,"run":m,"cases":rows},
    ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  print(f"PH04_{group}_EXACT_SOURCE_SCOPED={count}/{len(rows)}_NOT_FULL_E2E")
  return 0 if count==len(rows) else 1
def invoke(cmd,source=None):
  if source:
    with (ROOT/source).open(encoding="utf-8") as f:
      p=subprocess.run(cmd,stdin=f,cwd=ROOT,capture_output=True,text=True,timeout=120)
  else:p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=40)
  if p.returncode:print("PH04_SUITE_FAILED",cmd[0],p.stderr[-900:],file=sys.stderr)
  return p.returncode,p.stdout
def run_tenant():
  _,cases=frozen_check();m=metadata()
  assert os.getenv("TEST_ADMIN_DATABASE_URL","") in ("","postgresql://postgres@127.0.0.1:5432/tto"),"REMOTE_DB_FORBIDDEN"
  rc,status=invoke(["docker","inspect","--format","{{.Config.Image}}|{{.State.Running}}","tto-ph10-ci"])
  assert rc==0 and status.strip() in ("postgres:17|true","postgres:17-alpine|true"),"TEMP_PG17_REQUIRED"
  outputs={}
  for f in (SOURCE,INGEST):
    outputs[f]=invoke(["docker","exec","-i","tto-ph10-ci","psql","-U","postgres","-d","tto","-qAt","-v","ON_ERROR_STOP=1"],f)
  outputs[RACE]=invoke(["bash",RACE])
  results={}
  for c in cases[8:]:
    ident=c["id"];file,mark=TENANT[ident];rc,out=outputs[file]
    results[ident]=(file,mark,"PG17_CONCURRENT" if file==RACE else "PG17_SCOPED_SQL",rc==0 and exact_marker(out,mark))
  return save("ph10_ph04_tenant8_exact_evidence.json","TENANT",cases[8:],m,results)
def run_auth(path):
  _,cases=frozen_check();m=metadata()
  p=Path(path).resolve()
  assert p.parent==Path(os.environ["RUNNER_TEMP"]).resolve() and p.name=="ph04-identity-source-stdout.log","UNTRUSTED_LOG_PATH"
  log=p.read_text(encoding="utf-8")
  results={c["id"]:("services/api/test/identity-workflows.integration.cjs",AUTH[c["id"]],"NEST_SCOPED_HTTP",exact_marker(log,AUTH[c["id"]])) for c in cases[:8]}
  return save("ph10_ph04_auth8_exact_evidence.json","AUTH",cases[:8],m,results)
if __name__=="__main__":
  p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group(required=True)
  g.add_argument("--validate",action="store_true");g.add_argument("--tenant",action="store_true");g.add_argument("--auth-log")
  a=p.parse_args()
  try:
    if a.validate:frozen_check();print("PH04_FROZEN16_SOURCE_MAPPING_VALID_NOT_RUNTIME_GREEN");sys.exit(0)
    sys.exit(run_tenant() if a.tenant else run_auth(a.auth_log))
  except (AssertionError,ValueError,OSError,KeyError,subprocess.TimeoutExpired) as e:
    print("PH04_FAIL_CLOSED",str(e),file=sys.stderr);sys.exit(1)
