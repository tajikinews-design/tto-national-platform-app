#!/usr/bin/env python3
"""PH12 scoped source-field coverage guard: structural progress is not formal acceptance."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json").read_text())
audit = json.loads((ROOT / "docs/analysis/PH12_CHILD06_CHILD07_75_FIELD_CROSSWALK.json").read_text())
approved = [x for x in source["entities"] if x["child_id"] in ("CHILD-06", "CHILD-07")]
rows = audit["rows"]
assert len(approved) == 12
assert sum(len(x["fields"].split(", ")) for x in approved) == 75
assert len(rows) == len({x["sourceId"] for x in rows}) == 75
assert sum(x["child"] == "CHILD-06" for x in rows) == 32
assert sum(x["child"] == "CHILD-07" for x in rows) == 43
assert all(x["formalSemanticAcceptance"] == "NOT_CERTIFIED" for x in rows)
sql = (ROOT / "database/migrations/0044_ph12_child06_child07_canonical_failclosed.sql").read_text()
tables = {
    "child06_cooperative_relationships", "child06_relationship_decisions",
    "child06_member_profiles", "child07_valuation_reports",
    "child07_capital_offers", "child07_sell_orders",
    "child07_buy_requests", "child07_transfer_cases",
    "child07_share_locks", "child07_ownership_ledger_entries"
}
for table in tables:
    assert f"CREATE TABLE tto.{table}(" in sql, table
    assert f"'{table}'" in sql, table  # RLS and REVOKE ALL guard list
assert "CHECK(source_kind='OPENING_VERIFIED' AND source_case_ref IS NULL AND direction='CREDIT')" in sql
assert "CHECK(status IN('REQUESTED','LOCKED','PAYMENT_REPORTED','PAYMENT_VERIFIED','BLOCKED'))" in sql
assert "REVOKE ALL ON FUNCTION tto.ph12_child07_gate_ledger_insert()" in sql
assert "FOREIGN KEY(tenant_id,shareholder_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id)" in sql
assert "FOREIGN KEY(tenant_id,evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)" in sql
assert "tto.relationship_projections" not in sql.split("CREATE TABLE")[1]  # no CF02 ownership
assert not any(x in sql.upper() for x in ("CREATE TABLE TTO.WALLET", "CREATE TABLE TTO.FUND_RESERVATION"))
tests=(ROOT / "tests/sql/ph12-child06-child07-canonical-failclosed.sql").read_text()
for signal in [
    "PH12_NONMEMBER_IMPLICIT_MEMBERSHIP_OR_ROLE",
    "PH12_CHILD06_VERSION_GAP_ALLOWED",
    "PH12_CROSS_TENANT_EVIDENCE_ALLOWED",
    "PH12_CROSS_TENANT_SHARE_SELL_ALLOWED",
    "PH12_CROSS_TENANT_TRANSFER_ALLOWED",
    "PH12_UNSOURCED_CLASSIFICATION_ACCEPTED",
    "PH12_UNCLASSIFIED_LEDGER_ACCEPTED",
    "PH12_REAL_TRANSFER_LEDGER_ENABLED",
    "PH12_LEDGER_MUTABLE",
    "PH12_LEGACY_TRANSFER_FINALIZE_UNBLOCKED",
    "PH12_RUNTIME_PRIVILEGE_LEAK"
]:
    assert signal in tests, signal
assert tests.strip().endswith("SELECT 'PH12_CHILD06_07_ALL_SYNTHETIC_ROWS_ROLLED_BACK_NO_REAL_SHARES';")
print("PH12_CHILD0607_SOURCE75_CANDIDATES_AND_FAILCLOSED_TEST_CONTRACT_PASS_NO_FORMAL_ACCEPTANCE")
