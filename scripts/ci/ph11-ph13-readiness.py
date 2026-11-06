#!/usr/bin/env python3
"""Source-backed PH11-13 readiness diagnostic: success means truthful HOLD, never release."""
import argparse
import hashlib
import json
import os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def load(p):
    return json.loads((ROOT/p).read_text(encoding="utf-8"))
def verify(gate,phases,source,physical,accepted,ph10):
    expected={"PHASE-%02d"%n for n in range(14)}
    assert set(phases["phases"])==expected,"APPROVED_PHASE_BOUNDARY_DRIFT"
    assert gate["approvedPhaseRange"]=="PHASE-00..PHASE-13" and gate["phase14"]=="NOT_DEFINED","PHASE14_NOT_AUTHORIZED"
    assert gate["status"]=="HOLD","FALSE_OVERALL_GREEN"
    assert phases["production_authorized"] is False,"PRODUCTION_AUTHORIZATION_UNVERIFIED"
    assert source["entity_count"]==len(source["entities"])==148,"SOURCE_148_DRIFT"
    assert physical["entities"]==148 and physical["field_phrases"]==len(physical["rows"])==786,"FIELD_786_DRIFT"
    assert all(x.get("actual_semantic_equivalence_certified") is not True for x in physical["rows"]),"UNSUPPORTED_PHYSICAL_PARITY"
    assert accepted["acceptance_count"]==len(accepted["acceptance_cases"])==155,"SOURCE155_DRIFT"
    assert accepted["not_accepted_per_source"]==155,"SOURCE155_FALSE_SIGNOFF"
    assert ph10["sourceCount"]==155 and ph10["formalOperationalGreen"]=="NOT_ISSUED","PH10_FALSE_RELEASE"
    required={"PHASE-11":{"currentShaAuthorizedPreview","reviewerSSO","persistentSyntheticBackend"},
     "PHASE-12":{"source155FullUat","entity148Field786PhysicalParity","assistiveTechnologyHumanReview","authorizedRoleTenantUat","legalProviderSignoff"},
     "PHASE-13":{"dedicatedArvanHost","realInfrastructureRestore","rolloutRollback","independentSecurityReview","ownerSignedRelease"}}
    assert set(gate["phases"])==set(required),"PHASE_COVERAGE_DRIFT"
    for phase,keys in required.items():
        entry=gate["phases"][phase]
        assert entry["status"]=="HOLD","FALSE_PHASE_GREEN:"+phase
        for key in keys:
            assert entry.get(key)=="NOT_PROVEN","UNVERIFIED_GATE_PROMOTED:"+phase+":"+key
    assert gate["phases"]["PHASE-11"]["protectedSsoFourProjects"]=="OBSERVED_ACCOUNT_SETTING"
    assert gate["phases"]["PHASE-11"]["hobbyPolicy"]=="SYNTHETIC_NONCOMMERCIAL_ONLY"
    assert gate["latestVerifiedPH10"]["formal155Accepted"]==0
    return {"classification":"CI_TRUTH_HOLD_NOT_PHASE_GREEN",
     "phases":{p:"HOLD" for p in sorted(required)},
     "phase14":"NOT_DEFINED","sourceEntities":148,"fieldPhrases":786,
     "sourceAcceptances":155,"formallyAccepted":0,
     "verifiedVercelSsoProjectSettings":4,
     "previewLoginUat":"NOT_PROVEN","productionAuthorized":False,
     "release":"HOLD"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output")
    args=p.parse_args()
    gate=load("docs/analysis/PH11_PH13_READINESS_GATE.json")
    result=verify(gate,load("status/PHASE_GATES.json"),
      load("docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json"),
      load("docs/analysis/PH01_148_ENTITY_FIELD_PHYSICAL_CANDIDATES.json"),
      load("docs/analysis/PH01_155_ACCEPTANCE_EVIDENCE_GATE.json"),
      load("docs/analysis/PH10_INTEGRATION_ACCEPTANCE_GATE.json"))
    result["gateSha256"]=hashlib.sha256(
     (ROOT/"docs/analysis/PH11_PH13_READINESS_GATE.json").read_bytes()).hexdigest()
    if args.output:
        assert os.getenv("CI")=="true" and not os.getenv("VERCEL"),"CI_ONLY"
        dest=(ROOT/args.output).resolve()
        assert dest.parent==ROOT/"ph11-13-artifacts","NO_UNTRUSTED_EVIDENCE_PATH"
        result["run"]={"sha":os.environ["GITHUB_SHA"],"id":os.environ["GITHUB_RUN_ID"]}
        dest.parent.mkdir(exist_ok=True)
        dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PH11_12_13_SOURCE_TRUTH_HOLD_PHASE14_NOT_DEFINED")
    print(json.dumps(result,ensure_ascii=False))
if __name__=="__main__":
    main()
