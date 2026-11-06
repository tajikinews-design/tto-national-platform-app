#!/usr/bin/env python3
"""PH12 immutable ID / source-ownership gate. SUCCESS means HOLD was enforced."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

official = read("docs/analysis/PH06_MEMBER07_SHARE08_SOURCE_TESTS.json")
matrix = read("docs/analysis/PH12_CHILD06_CHILD07_FROZEN15_EXECUTION_CROSSWALK.json")
packet = read("docs/contracts/PH12_CHILD06_CHILD07_SOURCE_OWNER_DECISION_PACKET_2026-11-06.json")
previous = read("docs/contracts/shareholder-source-authority-readiness-v1.json")
status = read("status/PHASE_GATES.json")
source_ids = [case["sourceTestId"] for case in official["cases"]]
case_ids = [case["id"] for case in packet["acceptanceCoverage"]]
assert len(set(source_ids)) == 15 and len(case_ids) == 15
assert case_ids == source_ids == [case["id"] for case in matrix["cases"]]
assert len([x for x in source_ids if x.startswith("MEMBER-AT-")]) == 7
assert len([x for x in source_ids if x.startswith("SHARE-AT-")]) == 8
assert all(case["scenarioOrigin"] ==
    "DERIVED_FROM_LOCKED_INVARIANTS_NOT_VERBATIM_SOURCE_TEST_TEXT"
    for case in official["cases"])
assert all(case["formalStatus"] == "HOLD" and
    case["sourceTextAvailability"] == "DERIVED_FROM_LOCKED_INVARIANTS_NOT_VERBATIM" and
    case["independentQaApproval"] is None and case["legalOwnerApproval"] is None and
    case["realHttpAcceptance"] is None and case["threePortalUat"] is None
    for case in packet["acceptanceCoverage"])
assert packet["signedFormalAcceptances"] == 0
assert packet["readiness"] == "HOLD"
assert not packet["liveTransferEnabled"] and not packet["mergeOrDeployAuthorized"]
expected = {
    "C06_AUTHORITY_SINGLE_WRITER", "C06_NON_MEMBER_ENTITLEMENTS",
    "C07_OFFICIAL_OPENING_REGISTER"
}
assert {x["gateId"] for x in packet["decisions"]} == expected
for item in packet["decisions"]:
    assert item["approvalStatus"] == "PENDING", item["gateId"]
    assert item["approvedBy"] is None and item["approvedAt"] is None
    assert item["approvalEvidenceRef"] is None
    assert item["requiredEvidence"] and item["decisionOwnerRole"]
    assert set(item["relatedAcceptance"]) <= set(source_ids)
assert set(sum((d["relatedAcceptance"] for d in packet["decisions"]), [])) == set(source_ids)
assert packet["technicalEvidence"]["pg17Run"] == 42261793772
assert packet["technicalEvidence"]["adaptiveSecurityRun"] == 42261983342
assert previous["authorizationState"] == "LEGAL_AND_SOURCE_NOT_APPROVED"
assert previous["runtimeActivationSupported"] is False
assert status["production_authorized"] is False
ckpt = status["phase12_child0607_source_checkpoint"]
assert ckpt["progress"] == "SCOPED_TECHNICAL_GREEN_FORMAL_HOLD"
assert ckpt["draft_pr"] == 169
assert status["phases"]["PHASE-12"]["status"] == "IN_PROGRESS"
assert len(ckpt["hard_blocks"]) >= 4

mig = (ROOT / "database/migrations/0046_ph12_child06_07_source_reconciliation_readonly.sql").read_text()
assert "MEMBER_SOURCE_APPROVAL_MISSING" in mig and "OPENING_QUANTITY_MISMATCH" in mig
assert "NON_MEMBER_SOURCE_ADAPTER_NOT_APPROVED" in mig
assert "REVOKE ALL ON FUNCTION tto.ph12_child06_reconcile_sources" in mig
assert "tto.ph12_child07_reconcile_opening" in mig
tests = (ROOT / "tests/sql/ph12-child06-child07-canonical-failclosed.sql").read_text()
for label in [
    "PH12_CF02_EVENT_CONFLICT_ACCEPTED",
    "PH12_IMPORTED_VERSION_ROLLBACK_ACCEPTED",
    "PH12_IMPORTED_EVENT_TAMPER_ACCEPTED",
    "PH12_IMPORTED_STATUS_TAMPER_ACCEPTED",
    "PH12_FUTURE_LEDGER_SNAPSHOT_ACCEPTED",
    "PH12_UNAPPROVED_ALIGNMENT_FAKE_GREEN",
    "PH12_NONMEMBER_OFFICIAL_SOURCE_UNAUTHORIZED",
    "PH12_LEGACY_TRANSFER_FINALIZE_UNBLOCKED",
]:
    assert label in tests, label

print("PH12_CHILD0607_15_SOURCE_IDS_3_GATES_FORMAL_HOLD_GUARD_PASS")
print("NO_SIGNED_AUTHORITY_NO_NONMEMBER_ENTITLEMENT_NO_LEDGER_ACTIVATION_NO_TRANSFER")
