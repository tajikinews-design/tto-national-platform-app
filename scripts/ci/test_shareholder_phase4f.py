"""Phase4F independent legal source authority-chain simulation. No real approval action."""
import copy
from datetime import datetime, timezone
import hashlib
import inspect
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
CONTRACT=ROOT/"docs/contracts/shareholder-legal-source-chain-phase4f-v1.json"
PREVIOUS=ROOT/"docs/contracts/shareholder-source-readiness-phase4d-v1.json"
AT=datetime(2026,10,26,12,tzinfo=timezone.utc)
DENY="BLOCKED_PENDING_INDEPENDENT_PROOF"
REVIEW="SYNTHETIC_REVIEW_CHAIN_READY_NOT_LEGAL_APPROVAL"
DATE_RE=re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
SHA_RE=re.compile(r"^[0-9a-f]{64}$")

def timestamp(value):
    if type(value) is not str or not DATE_RE.fullmatch(value):
        return None
    try: return datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError: return None

def fixture(domain,policy,old):
    ref="PHASE4F-SYNTHETIC-"+domain
    return {
      "tenant":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "domain":domain,"sourceRef":ref,"caseState":"INDEPENDENT_REVIEWED",
      "requester":{"id":"REQ-SYNTHETIC","role":"SOURCE_SUBMITTER","active":True},
      "custodian":{"id":"OWNER-SYNTHETIC","role":"AUTHORIZED_SOURCE_CUSTODIAN",
                   "active":True,"externallyVerified":True,"validUntil":"2027-01-01T00:00:00Z"},
      "reviewer":{"id":"REVIEWER-SYNTHETIC","role":"INDEPENDENT_LEGAL_REVIEWER",
                  "active":True,"externallyVerified":True,"validUntil":"2027-01-01T00:00:00Z"},
      "mandate":{"tenant":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                 "domain":domain,"sourceRef":ref,"custodianId":"OWNER-SYNTHETIC",
                 "delegationVerifiedExternally":True,"digest":hashlib.sha256((domain+"-mandate").encode()).hexdigest(),
                 "startsAt":"2026-10-01T00:00:00Z","expiresAt":"2027-01-01T00:00:00Z",
                 "revokedAt":None},
      "reviewedAt":"2026-10-25T00:00:00Z","expiresAt":"2026-11-25T00:00:00Z",
      "withdrawnAt":None,
      "evidence":[{
         "controlId":e["controlId"],"tenant":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
         "domain":domain,"sourceRef":ref,
         "digest":hashlib.sha256((domain+e["controlId"]).encode()).hexdigest(),
         "verifiedExternally":True,"verifiedBy":"REVIEWER-SYNTHETIC",
         "verifiedAt":"2026-10-24T00:00:00Z",
         "expiresAt":"2026-11-30T00:00:00Z"
      } for e in old["sourceDomains"][0 if domain=="CHILD06_MEMBERSHIP" else 1]["evidence"]]
    }

def evaluate(case,policy,at=AT):
    """Simulation ONLY. External verification fields are synthetic test assertions."""
    try:
        if type(case) is not dict or type(policy) is not dict:
            return DENY
        if policy.get("canActivateSource") is not False or policy.get("artifactGrantsRights") is not False:
            return DENY
        if policy.get("externalAuthorityValidated") is not False:
            return DENY
        if case.get("caseState")!="INDEPENDENT_REVIEWED" or case.get("withdrawnAt") is not None:
            return DENY
        tenant,domain,ref=(case[k] for k in ("tenant","domain","sourceRef"))
        if any(type(x) is not str or not x for x in (tenant,domain,ref)):
            return DENY
        spec=next((x for x in policy["scope"]["sourceDomains"] if x["domain"]==domain),None)
        if spec is None or spec["legalApprovalState"]!="PENDING_EXTERNAL_AUTHORITY":
            return DENY
        who=[case["requester"],case["custodian"],case["reviewer"]]
        ids=[x["id"] for x in who]
        if any(type(x) is not str or not x for x in ids) or len(set(ids))!=3:
            return DENY
        roles=["SOURCE_SUBMITTER","AUTHORIZED_SOURCE_CUSTODIAN","INDEPENDENT_LEGAL_REVIEWER"]
        if [x.get("role") for x in who]!=roles or any(x.get("active") is not True for x in who):
            return DENY
        if any(x.get("externallyVerified") is not True for x in who[1:]):
            return DENY
        mandate=case["mandate"]
        if tuple(mandate.get(k) for k in ("tenant","domain","sourceRef","custodianId"))!=(tenant,domain,ref,ids[1]):
            return DENY
        if mandate.get("delegationVerifiedExternally") is not True or mandate.get("revokedAt") is not None:
            return DENY
        if type(mandate.get("digest")) is not str or not SHA_RE.fullmatch(mandate["digest"]):
            return DENY
        start=timestamp(mandate.get("startsAt"));end=timestamp(mandate.get("expiresAt"))
        reviewed=timestamp(case.get("reviewedAt"));expiry=timestamp(case.get("expiresAt"))
        if any(t is None for t in (start,end,reviewed,expiry)):
            return DENY
        if not (start <= reviewed <= at < expiry <= end):
            return DENY
        if (expiry-reviewed).total_seconds()>policy["timePolicy"]["syntheticMaxDays"]*86400:
            return DENY
        for principal in who[1:]:
            valid_until=timestamp(principal.get("validUntil"))
            if valid_until is None or valid_until<=at:
                return DENY
        evidence=case.get("evidence")
        expected=spec["requiredControlIds"]
        if not isinstance(evidence,list) or len(evidence)!=len(expected):
            return DENY
        if len({x.get("controlId") for x in evidence if isinstance(x,dict)})!=len(expected):
            return DENY
        if {x.get("controlId") for x in evidence if isinstance(x,dict)}!=set(expected):
            return DENY
        for item in evidence:
            if type(item) is not dict:
                return DENY
            if (item.get("tenant"),item.get("domain"),item.get("sourceRef"))!=(tenant,domain,ref):
                return DENY
            if item.get("verifiedExternally") is not True or item.get("verifiedBy")!=ids[2]:
                return DENY
            if type(item.get("digest")) is not str or not SHA_RE.fullmatch(item["digest"]):
                return DENY
            received=timestamp(item.get("verifiedAt"));valid=timestamp(item.get("expiresAt"))
            if received is None or valid is None or not (start<=received<=reviewed and at<valid):
                return DENY
        return REVIEW
    except (KeyError,TypeError,ValueError,AttributeError):
        return DENY

class Phase4FLegalAuthorityChain(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy=json.loads(CONTRACT.read_text("utf-8"))
        cls.old=json.loads(PREVIOUS.read_text("utf-8"))
        cls.member=fixture("CHILD06_MEMBERSHIP",cls.policy,cls.old)
        cls.hold=fixture("CHILD07_HOLDINGS",cls.policy,cls.old)

    def test_readiness_never_grants_legal_approval(self):
        self.assertEqual(evaluate(self.member,self.policy),REVIEW)
        self.assertEqual(evaluate(self.hold,self.policy),REVIEW)
        self.assertFalse(self.policy["canActivateSource"])
        self.assertFalse(self.policy["externalAuthorityValidated"])
        self.assertFalse(self.policy["artifactGrantsRights"])
        self.assertEqual(self.policy["runtimeDataConnection"],None)

    def test_preserves_exact_19_source_controls(self):
        old={d["domain"]:d for d in self.old["sourceDomains"]}
        self.assertEqual(sum(x["minimumControls"] for x in self.policy["scope"]["sourceDomains"]),19)
        for domain in self.policy["scope"]["sourceDomains"]:
            self.assertEqual(domain["requiredControlIds"],old[domain["domain"]]["requirements"])
            self.assertEqual(domain["legalApprovalState"],"PENDING_EXTERNAL_AUTHORITY")
        self.assertTrue(all(e["status"]=="PENDING" for d in old.values() for e in d["evidence"]))

    def test_all_32_negative_authority_mutations_denied(self):
        base=self.member
        mutations=[
          ("pending",["caseState"],"PENDING"),
          ("rejected",["caseState"],"REJECTED"),
          ("withdrawn",["withdrawnAt"],"2026-10-26T00:00:00Z"),
          ("cross tenant",["tenant"],"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
          ("domain swap",["domain"],"CHILD07_HOLDINGS"),
          ("source swap",["sourceRef"],"PHASE4F-SYNTHETIC-OTHER"),
          ("submitter self-review",["reviewer","id"],base["requester"]["id"]),
          ("custodian self-review",["reviewer","id"],base["custodian"]["id"]),
          ("wrong owner role",["custodian","role"],"SOURCE_SUBMITTER"),
          ("wrong reviewer role",["reviewer","role"],"SOURCE_SUBMITTER"),
          ("inactive owner",["custodian","active"],False),
          ("inactive reviewer",["reviewer","active"],False),
          ("owner untrusted",["custodian","externallyVerified"],False),
          ("reviewer untrusted",["reviewer","externallyVerified"],False),
          ("owner expired",["custodian","validUntil"],"2026-10-25T00:00:00Z"),
          ("reviewer expired",["reviewer","validUntil"],"2026-10-25T00:00:00Z"),
          ("delegation withdrawn",["mandate","revokedAt"],"2026-10-26T00:00:00Z"),
          ("delegation unverified",["mandate","delegationVerifiedExternally"],False),
          ("forged delegation hash",["mandate","digest"],"fake"),
          ("mandate wrong tenant",["mandate","tenant"],"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
          ("mandate wrong domain",["mandate","domain"],"CHILD07_HOLDINGS"),
          ("mandate wrong owner",["mandate","custodianId"],"OTHER"),
          ("mandate expired",["mandate","expiresAt"],"2026-10-25T00:00:00Z"),
          ("review expired",["expiresAt"],"2026-10-26T12:00:00Z"),
          ("review before mandate",["reviewedAt"],"2026-09-29T00:00:00Z"),
          ("review expiry over mandate",["expiresAt"],"2027-02-01T00:00:00Z"),
          ("missing evidence",["evidence"],base["evidence"][1:]),
          ("evidence other tenant",["evidence",0,"tenant"],"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
          ("evidence other domain",["evidence",0,"domain"],"CHILD07_HOLDINGS"),
          ("evidence false hash",["evidence",0,"digest"],"malformed"),
          ("evidence unverified",["evidence",0,"verifiedExternally"],False),
          ("evidence self-verified",["evidence",0,"verifiedBy"],base["requester"]["id"]),
          ("evidence expired",["evidence",0,"expiresAt"],"2026-10-26T12:00:00Z"),
          ("evidence backdated",["evidence",0,"verifiedAt"],"2026-10-26T00:00:00Z"),
          ("duplicate control",["evidence",0,"controlId"],base["evidence"][1]["controlId"]),
        ]
        self.assertGreaterEqual(len(mutations),32)
        for label,path,value in mutations:
            test=copy.deepcopy(base)
            cursor=test
            for key in path[:-1]:
                cursor=cursor[key]
            cursor[path[-1]]=value
            with self.subTest(attack=label):
                self.assertEqual(evaluate(test,self.policy),DENY)
        self.assertEqual(evaluate(base,self.policy),REVIEW)

    def test_invalid_payload_shapes_denied(self):
        for case in (None,[],{},{"caseState":"INDEPENDENT_REVIEWED"},3):
            with self.subTest(case=repr(case)):
                self.assertEqual(evaluate(case,self.policy),DENY)
        p=copy.deepcopy(self.policy);p["canActivateSource"]=True
        self.assertEqual(evaluate(self.member,p),DENY)
        p=copy.deepcopy(self.policy);p["externalAuthorityValidated"]=True
        self.assertEqual(evaluate(self.member,p),DENY)
        p=copy.deepcopy(self.policy);p["artifactGrantsRights"]=True
        self.assertEqual(evaluate(self.member,p),DENY)

    def test_actual_legal_trust_is_external(self):
        self.assertIn("ORIGINAL_SIGNED_DOCUMENTS",self.policy["mustBeVerifiedOffPlatform"])
        self.assertIn("HASH_ONLY",self.policy["nonAuthorities"])
        self.assertIn("SYNTHETIC_SIGNATURE",self.policy["nonAuthorities"])
        self.assertEqual(self.policy["timePolicy"]["origin"],"PROPOSED_TECHNICAL_CEILING_NOT_STATUTORY_RULE")
        self.assertIn("CHILD07_TRADE_OPERATIONS",self.policy["permanentDeny"])
        self.assertIn("GENERAL_ACCOUNTING",self.policy["permanentDeny"])

    def test_no_network_or_live_activation_import(self):
        source=inspect.getsource(evaluate)
        for forbidden in ("requests.get(","urlopen(","supabase.com","apiir.ir",
                          "INSERT INTO tto.","ALTER TABLE tto."):
            self.assertNotIn(forbidden,source)
        self.assertFalse(self.policy["realDocumentsInRepo"])

if __name__=="__main__":
    unittest.main()
