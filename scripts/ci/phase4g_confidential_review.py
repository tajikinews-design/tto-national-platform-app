"""Phase4G OFFLINE synthetic workflow. No actual file upload, DB writes or legal grant."""
import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PATH=ROOT/"docs/contracts/shareholder-confidential-intake-phase4g-v1.json"
OLD=ROOT/"docs/contracts/shareholder-source-readiness-phase4d-v1.json"
ROLES=("SOURCE_SUBMITTER","AUTHORIZED_SOURCE_CUSTODIAN",
       "INDEPENDENT_LEGAL_REVIEWER","TECHNICAL_OPERATOR")
EDGES={
 ("DRAFT","SUBMITTED"):"SOURCE_SUBMITTER",
 ("SUBMITTED","QUARANTINED"):"TECHNICAL_OPERATOR",
 ("QUARANTINED","METADATA_VALIDATED"):"TECHNICAL_OPERATOR",
 ("METADATA_VALIDATED","AUTHENTICITY_REVIEWED"):"AUTHORIZED_SOURCE_CUSTODIAN",
 ("AUTHENTICITY_REVIEWED","INDEPENDENT_REVIEW_RECORDED"):"INDEPENDENT_LEGAL_REVIEWER",
 ("INDEPENDENT_REVIEW_RECORDED","EXTERNAL_SIGNOFF_REQUIRED"):"INDEPENDENT_LEGAL_REVIEWER",
}
FINAL={"WITHDRAWN","REJECTED","EXPIRED","EXTERNAL_SIGNOFF_REQUIRED"}
NOW=datetime(2026,10,27,10,tzinfo=timezone.utc)

class Denied(ValueError):pass
def guard(x,reason):
    if not x:raise Denied("PHASE4G_"+reason)
def stamp(s):
    try:
        guard(isinstance(s,str) and s.endswith("Z"),"DATE")
        return datetime.fromisoformat(s.replace("Z","+00:00"))
    except (ValueError,TypeError):raise Denied("PHASE4G_DATE")
def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def contract():
    p=json.loads(PATH.read_text("utf-8"))
    o=json.loads(OLD.read_text("utf-8"))
    for k in ("realEvidenceIngressEnabled","realSourceConnectionEnabled",
              "realApprovalMutationEnabled","realSharesTradingEnabled",
              "uploadedDocumentsPresent","liveStorageProvisioned"):
        guard(p.get(k) is False,"LIVE_DISABLED")
    guard(p["confidentialIntake"]["realEndpoint"] is None,"NO_UPLOAD")
    guard(p["confidentialIntake"]["tempUploadAdapter"]=="DISABLED","STORAGE")
    guard(p["operationalAuthorityApproval"]=="BLOCKED_UNTIL_SEPARATE_EXTERNAL_LEGAL_DECISION","AUTH")
    guard(p["policyMaximumDays"]==90,"LIMIT")
    guard([d["mandatoryControls"] for d in p["domains"]]==
          [d["requirements"] for d in o["sourceDomains"]],"CONTROLS")
    guard([len(d["mandatoryControls"]) for d in p["domains"]]==[9,10],"COUNT")
    guard(set(map(tuple,p["workflow"]["transitions"])) >= set(EDGES),"EDGES")
    return p
def fixture(domain="CHILD06_MEMBERSHIP"):
    p=contract()
    domains={d["sourceDomain"]:d for d in p["domains"]}
    guard(domain in domains,"DOMAIN")
    tenant="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    actors={r:{"id":"SYN-"+r,"tenantId":tenant,"active":True} for r in ROLES}
    docs=[{"kind":kind,"tenantId":tenant,"domain":domain,
           "ref":"OPAQUE-SYN-"+kind,"sha256":hashlib.sha256(kind.encode()).hexdigest(),
           "mime":"application/pdf","bytes":1024,
           "scan":"MOCK_CLEAN","authenticity":"MOCK_EXTERNAL_REVIEW",
           "classification":"RESTRICTED"} for kind in domains[domain]["evidenceClasses"]]
    initial={"from":None,"to":"DRAFT","actor":"TEST_SYNTHETIC","at":"2026-10-27T08:00:00Z"}
    return {"caseId":"SYNTHETIC-CASE","tenantId":tenant,"sourceDomain":domain,
            "sourceRef":"SYNTHETIC-"+domain,"state":"DRAFT",
            "actors":actors,
            "mandate":{"tenantId":tenant,"domain":domain,"sourceRef":"SYNTHETIC-"+domain,
                       "custodianId":actors["AUTHORIZED_SOURCE_CUSTODIAN"]["id"],
                       "from":"2026-10-01T00:00:00Z","until":"2026-12-01T00:00:00Z",
                       "revoked":False,"syntheticTrust":True},
            "expiresAt":"2026-11-30T00:00:00Z",
            "controls":domains[domain]["mandatoryControls"],
            "evidence":docs,
            "decision":{"externalApproval":False,"recordedBy":None},
            "events":[{"event":initial,"prev":"0"*64,"hash":digest(["0"*64,initial])}]}
def audit(case):
    try:
        prev="0"*64
        for e in case["events"]:
            if e["prev"]!=prev or e["hash"]!=digest([prev,e["event"]]):return False
            prev=e["hash"]
        return case["state"]==case["events"][-1]["event"]["to"]
    except (KeyError,TypeError,IndexError):return False
def verify(case,now=NOW):
    p=contract()
    guard(isinstance(case,dict) and audit(case),"AUDIT")
    scope=next((d for d in p["domains"] if d["sourceDomain"]==case["sourceDomain"]),None)
    guard(scope is not None and scope["mandatoryControls"]==case["controls"],"SCOPE_CONTROL")
    actors=case["actors"];guard(set(actors)==set(ROLES),"ROLES")
    guard(len({a["id"] for a in actors.values()})==4,"SELF_APPROVAL")
    guard(all(a["tenantId"]==case["tenantId"] and a["active"] is True
              for a in actors.values()),"CROSS_TENANT_OR_REVOKED")
    m=case["mandate"]
    guard((m["tenantId"],m["domain"],m["sourceRef"],m["custodianId"])==
          (case["tenantId"],case["sourceDomain"],case["sourceRef"],
           actors["AUTHORIZED_SOURCE_CUSTODIAN"]["id"]),"MANDATE_SCOPE")
    guard(m["revoked"] is False and m["syntheticTrust"] is True,"MANDATE_REVOKED")
    guard(stamp(m["from"])<=now<stamp(m["until"]) and
          now<stamp(case["expiresAt"])<=stamp(m["until"]),"EXPIRED")
    evidence=case["evidence"]
    guard(len(evidence)==len(scope["evidenceClasses"]) and
          [e["kind"] for e in evidence]==scope["evidenceClasses"],"EVIDENCE")
    guard(len({e["ref"] for e in evidence})==len(evidence),"DUPLICATE")
    for e in evidence:
        guard(set(e)=={"kind","tenantId","domain","ref","sha256","mime","bytes",
                       "scan","authenticity","classification"},"EVIDENCE_SHAPE")
        guard(e["tenantId"]==case["tenantId"] and e["domain"]==case["sourceDomain"],"EVIDENCE_TENANT")
        guard(e["mime"]=="application/pdf" and type(e["bytes"]) is int and
              0<e["bytes"]<=10485760,"MIME_SIZE")
        guard(e["scan"]=="MOCK_CLEAN" and e["authenticity"]=="MOCK_EXTERNAL_REVIEW","ATTESTATION")
        guard(e["classification"]=="RESTRICTED" and
              isinstance(e["sha256"],str) and len(e["sha256"])==64,"INTEGRITY_METADATA")
    guard(case["decision"]["externalApproval"] is False,"LEGAL_APPROVAL")
def move(case,to,role,actor,now=NOW):
    guard(case["state"] not in FINAL,"TERMINAL")
    verify(case,now)
    start=case["state"]
    if to=="WITHDRAWN":need="SOURCE_SUBMITTER"
    elif to=="REJECTED" and start!="DRAFT":need="INDEPENDENT_LEGAL_REVIEWER"
    else:need=EDGES.get((start,to))
    guard(need==role and case["actors"][role]["id"]==actor,"ROLE_EDGE")
    p=contract()
    guard([start,to] in p["workflow"]["transitions"],"GRAPH")
    if to=="EXTERNAL_SIGNOFF_REQUIRED":
        guard(case["decision"]["recordedBy"]==actor,"REVIEW_REQUIRED")
    next_case=copy.deepcopy(case)
    if to=="INDEPENDENT_REVIEW_RECORDED":
        next_case["decision"]["recordedBy"]=actor
    event={"from":start,"to":to,"actor":actor,
           "at":now.isoformat().replace("+00:00","Z")}
    prev=case["events"][-1]["hash"]
    next_case["events"].append({"event":event,"prev":prev,"hash":digest([prev,event])})
    next_case["state"]=to
    guard(audit(next_case),"OUTPUT_AUDIT")
    return next_case
def view(case):
    guard(audit(case),"AUDIT")
    return {"state":case["state"],"events":len(case["events"]),
            "sourceDomain":case["sourceDomain"],"auditHead":case["events"][-1]["hash"],
            "realLegalApproval":False,"realFileIngress":False,"sourceActivated":False}

def expire(case,now):
    """Record expiry/revocation without reauthorizing an expired mandate."""
    guard(type(case) is dict and audit(case) and case["state"] not in FINAL,"EXPIRY_STATE")
    mandate=case["mandate"]
    overdue=(now>=stamp(case["expiresAt"]) or
             now>=stamp(mandate["until"]) or mandate["revoked"] is True)
    guard(overdue,"NOT_EXPIRED")
    result=copy.deepcopy(case)
    event={"from":case["state"],"to":"EXPIRED","actor":"SYSTEM_SYNTHETIC_TEST",
           "at":now.isoformat().replace("+00:00","Z")}
    prev=case["events"][-1]["hash"]
    result["events"].append({"event":event,"prev":prev,"hash":digest([prev,event])})
    result["state"]="EXPIRED"
    guard(audit(result),"EXPIRY_AUDIT")
    return result
