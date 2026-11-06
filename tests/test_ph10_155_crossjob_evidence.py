"""Synthetic negative-control fixtures for PH10 155-ID evidence-join logic.

These fixtures are not actual acceptance evidence; real output is admitted only
from exact-head CI artifacts produced by independent completed jobs.
"""
import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
S=ROOT/"scripts/ci/ph10-155-crossjob-evidence.py"
spec=importlib.util.spec_from_file_location("truth155",S)
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
SHA="a"*40
RUN="12345678"

class EvidenceTruth(unittest.TestCase):
    @staticmethod
    def sql_path(rid):
        first=rid.split("-AT-")[0]
        if first in {"GOV","COMM","SUP","TRN"}:
            name={"GOV":"governance","COMM":"communications",
                  "SUP":"support","TRN":"transparency"}[first]
            return "tests/sql/ph07-"+name+"-acceptance.sql"
        if first in {"PROJ","VOICE","LEARN","BEN","MKT","PROC"}:
            name={"PROJ":"projects","VOICE":"member-voice",
                  "LEARN":"academy-events","BEN":"member-benefits",
                  "MKT":"marketplace","PROC":"procurement"}[first]
            return "tests/sql/ph08-"+name+"-acceptance.sql"
        name={"OPP":"opportunities","IMPACT":"impact","GRC":"grc",
              "NI":"network-intelligence","DG":"data-governance",
              "OPS":"operations"}[first]
        return "tests/sql/ph09-"+name+"-acceptance.sql"

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        frozen=json.loads((ROOT/"docs/analysis/ACCEPTANCE_IDS.json").read_text(encoding="utf8"))
        ids=[c["id"] for c in frozen]
        record={"commitSha":SHA,"runId":RUN,"job":"synthetic-test-fixture"}
        self.artifacts={
            "ph10_155_exact_run_sql_ledger.json":{
                "commitSha":SHA,"workflowRunId":RUN,"sqlVerifiedIds":100,
                "cases":[{"acceptanceId":rid,"sqlSuiteExecutedWithinThisJob":i>=55,
                           "sqlSuiteResult":"PASS_SCOPED_SQL" if i>=55 else "NOT_ASSERTED_IN_THIS_LEDGER",
                           "workflowRunId":RUN if i>=55 else None,
                           "commitSha":SHA if i>=55 else None}
                           for i,rid in enumerate(ids)]},
            "ph10_source100_individual_sql_evidence.json":{
                "commitSha":SHA,"workflowRunId":RUN,
                "completedSqlSuiteSourceIdCount":100,
                "individualExecutedSqlSignalCount":96,
                "noIndividualSqlSignalCount":4,
                "noIndividualSignalIds":["OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"],
                "cases":[{"acceptanceId":rid,"sqlSourcePath":self.sql_path(rid),
                          "scopedMarkerVerified":rid not in
                              ("OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008"),
                          "exactAssertionMarker":"SYNTHETIC_UNIT_ONLY" if rid not in
                              ("OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008") else None,
                          "evidenceLayer":"FAKE_TEST_SIGNAL",
                          "scopedResult":"TEST_ONLY",
                          "stdoutSha256":"test-fixture-only",
                          "workflowRunId":RUN,"commitSha":SHA,
                          "fullUserJourneyProven":False,"formalAcceptance":"NOT_ACCEPTED"}
                         for rid in ids[55:]]},
            "ph10_frozen55_exact_evidence.json":{
                "run":{"commitSha":SHA,"workflowRunId":RUN},
                "ph05Ph06SourceScopedPass":39,
                "cases":[{"acceptanceId":rid,
                          "status":"PASS_SCOPED_NOT_FULL_E2E" if i>=16 else "BLOCKED",
                          "evidenceLayer":"SCOPED_SQL","testPath":"tests/sql/ph06-member-share-frozen15.sql",
                          "expectedMarker":"FAKE_UNIT_FIXTURE_ONLY",
                          "workflowRunId":RUN,"commitSha":SHA,"job":"synthetic-test-fixture",
                          "stdoutSha256":"deadbeef","sourceSha256":"deadbeef"} for i,rid in enumerate(ids[:55])]},
            "ph10_ph04_auth8_exact_evidence.json":{
                "run":record,
                "cases":[{"acceptanceId":rid,"status":"PASS_SCOPED_NOT_FULL_E2E",
                          "fullEndToEndPassed":False,"evidenceLayer":"NEST_SCOPED_HTTP",
                          "testPath":"services/api/test/identity-workflows.integration.cjs",
                          "expectedMarker":"FAKE_UNIT_FIXTURE_ONLY","run":record}
                         for rid in ids[:8]]},
            "ph10_ph04_tenant8_exact_evidence.json":{
                "run":record,
                "cases":[{"acceptanceId":rid,"status":"PASS_SCOPED_NOT_FULL_E2E",
                          "fullEndToEndPassed":False,"evidenceLayer":"PG17_SCOPED_SQL",
                          "testPath":"tests/sql/ph04-child02-source-eight.sql",
                          "expectedMarker":"FAKE_UNIT_FIXTURE_ONLY","run":record}
                         for rid in ids[8:16]]},
            "ph10_ph08_36_http_gap_ledger.json":{
                "run":record,"relatedRealHttpScopedEvidenceCount":32,
                "absenceOnlyRouteGuards":4,"bffPreflightReadOnlySourceCount":5,
                "formalEndToEndAcceptedCount":0,
                "cases":[{"acceptanceId":rid,"formalAcceptance":"NOT_ACCEPTED",
                          "sourceIdFullHttpJourneyPassed":False,
                          "relatedHttpEvidence":"PASS_RELATED_SCOPED_HTTP",
                          "relatedHttpMarker":"FAKE_UNIT_FIXTURE_ONLY",
                          "bffAuthenticatedCrossLayerScoped":"NOT_PROVEN"}
                         for rid in ids[81:117]]},
            "ph10_ops_four_exact_evidence.json":{
                "commitSha":SHA,"workflowRunId":RUN,
                "operationsSourceSpecificScopedPass":3,"operationsDesignOnly":1,
                "tenantBearingTablesCompared":7,"migrationFilesCleanReplayed":18,
                "designReconciliationSha256":hashlib.sha256(
                    (ROOT/"docs/analysis/PH09_LEGACY_108_47_TRACEABILITY.json").read_bytes()
                ).hexdigest(),
                "reconciledLegacyRequirementIds":108,
                "reconciledLegacyTestIds":47,
                "formalAcceptanceCount":0,"source155FullUserJourneysAccepted":False,
                "cases":[{"acceptanceId":ident,"commitSha":SHA,"workflowRunId":RUN,
                          "formalAcceptance":"NOT_ACCEPTED","fullSourceUserJourneyPassed":False,
                          "scopedTechnicalPassed":ident!="OPS-AT-001",
                          "designTraceabilityValidated":ident=="OPS-AT-001",
                          "sourceContract":"docs/analysis/PH09_OFFICIAL_SOURCE38.json",
                          "evidenceLayer":{
                            "OPS-AT-001":"DESIGN_RECONCILIATION_108_47_ONLY",
                            "OPS-AT-004":"DISPOSABLE_PG17_TENANT_DATA_FINGERPRINT_RESTORE",
                            "OPS-AT-005":"DISPOSABLE_PG17_CLEAN_MIGRATION_SCHEMA_REPLAY",
                            "OPS-AT-008":"DISPOSABLE_PG17_SEPARATE_TRANSACTION_ROLLBACK"
                          }[ident],
                          "testPath":"docs/analysis/PH09_LEGACY_108_47_TRACEABILITY.json" if
                            ident=="OPS-AT-001" else "scripts/ci/ph10-ops-four-dedicated.sh",
                          "assertionMarker":{
                            "OPS-AT-001":None,
                            "OPS-AT-004":"PH10_OPS_AT004_TENANT_SCOPED_ROW_FINGERPRINT_RESTORE_PASS",
                            "OPS-AT-005":"PH10_OPS_AT005_CLEAN_MIGRATION_SCHEMA_RECONCILIATION_PASS",
                            "OPS-AT-008":"PH10_OPS_AT008_INDEPENDENT_TRANSACTION_ROLLBACK_SCOPED_PASS"
                          }[ident],
                          "independentOperationalApproval":False,
                          "scopedResult":"SYNTHETIC_TEST_FIXTURE"}
                         for ident in ("OPS-AT-001","OPS-AT-004","OPS-AT-005","OPS-AT-008")]},
            "ph10_three_portal_role_source_evidence.json":{
                "run":{"commitSha":SHA,"runId":RUN,"job":"source-sql-and-actual-api"},
                "realBrowserPortalSources":3,"actualBrowserRolePaths":6,
                "declaredBffSourceBindings":11,"realSourceSpecificCommands":1,
                "grcArticle129SourcePolicyPrecheck":1,
                "nationalJitRevokedSessionDenied":1,
                "twoDistinctMemberCapacityReadbackVerified":1,
                "twoDistinctMemberRealBrowserRaceVerified":1,
                "full155UserJourneysAccepted":False,"release":"HOLD",
                "cases":[{"portal":p,"navId":n,"sourceAcceptanceId":ident,
                           "formalAcceptance":"NOT_ACCEPTED",
                           "fullOriginalSourceJourneyAccepted":False,
                           "realChromiumReadVerified":(p,n) in {
                               ("shareholder","NAV-06"),
                               ("cooperative-management","NAV-10"),
                               ("national-admin","NAV-09")},
                           "sourceSpecificBrowserCommandVerified":(p,n)==("shareholder","NAV-06"),
                           "sourceSpecificPolicyPrecheckVerified":(p,n)==("cooperative-management","NAV-10")}
                          for p,n,ident in [
                           ("shareholder","NAV-06","LEARN-AT-001"),
                           ("shareholder","NAV-07","MKT-AT-006"),
                           ("shareholder","NAV-08","PROJ-AT-005"),
                           ("shareholder","NAV-10","IMPACT-AT-004"),
                           ("cooperative-management","NAV-04","COMM-AT-005"),
                           ("cooperative-management","NAV-05","SUP-AT-001"),
                           ("cooperative-management","NAV-07","MKT-AT-006"),
                           ("cooperative-management","NAV-08","PROJ-AT-005"),
                           ("cooperative-management","NAV-09","TRN-AT-006"),
                           ("cooperative-management","NAV-10","GRC-AT-001"),
                           ("national-admin","NAV-09","CORE-DOC-AT-008")]]},
            "ph10_page_api_inventory.json":{
                "headSha":SHA,"pages":[{"portal":p} for p in
                          ("shareholder","cooperative-management","national-admin")]},
        }
        self.write()
    def write(self):
        for k,v in self.artifacts.items():
            (self.root/k).write_text(json.dumps(v),encoding="utf8")
        (self.root/"ph10_g5_restore_stdout.log").write_text(
            "PH10_G5_DISPOSABLE_BACKUP_RESTORE_PASS\n",encoding="utf8")
    def test_exact_155_scoped_never_formally_accepted(self):
        out=gate.joined(SHA,RUN,self.root)
        self.assertEqual(len(out["cases"]),155)
        self.assertFalse(out["all155CompleteUserJourneysProven"])
        self.assertEqual(out["sourceIdsFormallyAccepted"],0)
        self.assertEqual(out["perSourceSqlExecutedMarkersVerified"],96)
        self.assertEqual(len(out["sourceSqlWithoutPerIdEvidence"]),4)
        self.assertEqual(out["source100EvidenceLayerCensus"],{
            "individuallyExecutedSqlMarkers":96,
            "independentScopedPg17Ops":3,
            "designReconciliationOnly":1,
            "identifiersClassified":100,
            "runtimeVerifiedAcrossTheseLayers":99,
            "fullyAcceptedSourceJourneys":0})
        self.assertFalse(out["source100AllRuntimeVerified"])
        self.assertTrue(all(not x["fullSourceUserJourneyPassed"] for x in out["cases"]))
    def test_false_sql_specific_evidence_fails(self):
        c=self.artifacts["ph10_source100_individual_sql_evidence.json"]["cases"][0]
        c["scopedMarkerVerified"]=False
        self.write()
        with self.assertRaisesRegex(AssertionError,"SOURCE100_UNEXPECTED_INDIVIDUAL_RESULT"):
            gate.joined(SHA,RUN,self.root)
    def test_ops_tampered_release_proof_fails(self):
        self.artifacts["ph10_ops_four_exact_evidence.json"]["cases"][1]["scopedTechnicalPassed"]=False
        self.write()
        with self.assertRaisesRegex(AssertionError,"OPS_UNEXPECTED_SCOPE"):
            gate.joined(SHA,RUN,self.root)
    def test_ops_001_design_hash_tamper_fails(self):
        self.artifacts["ph10_ops_four_exact_evidence.json"]["designReconciliationSha256"]="0"*64
        self.write()
        with self.assertRaisesRegex(AssertionError,"OPS_001_DESIGN_HASH_OR_COUNTS_MISMATCH"):
            gate.joined(SHA,RUN,self.root)
    def test_ops_004_runtime_marker_tamper_fails(self):
        self.artifacts["ph10_ops_four_exact_evidence.json"]["cases"][1]["assertionMarker"]="FORGED_PASS"
        self.write()
        with self.assertRaisesRegex(AssertionError,"OPS_LAYER_OR_ASSERTION_PROVENANCE_MISMATCH"):
            gate.joined(SHA,RUN,self.root)
    def test_ops_005_migration_replay_marker_tamper_fails(self):
        self.artifacts["ph10_ops_four_exact_evidence.json"]["cases"][2]["assertionMarker"]="FORGED_MIGRATION_PASS"
        self.write()
        with self.assertRaisesRegex(AssertionError,"OPS_LAYER_OR_ASSERTION_PROVENANCE_MISMATCH"):
            gate.joined(SHA,RUN,self.root)
    def test_ops_008_rollback_marker_tamper_fails(self):
        self.artifacts["ph10_ops_four_exact_evidence.json"]["cases"][3]["assertionMarker"]="FORGED_ROLLBACK_PASS"
        self.write()
        with self.assertRaisesRegex(AssertionError,"OPS_LAYER_OR_ASSERTION_PROVENANCE_MISMATCH"):
            gate.joined(SHA,RUN,self.root)
    def test_ops_001_promoted_to_runtime_fails(self):
        self.artifacts["ph10_ops_four_exact_evidence.json"]["cases"][0]["scopedTechnicalPassed"]=True
        self.write()
        with self.assertRaisesRegex(AssertionError,"OPS_UNEXPECTED_SCOPE"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_two_member_browser_race_fails(self):
        self.artifacts["ph10_three_portal_role_source_evidence.json"]["twoDistinctMemberRealBrowserRaceVerified"]=0
        self.write()
        with self.assertRaisesRegex(AssertionError,"THREE_PORTAL_ROLE_SOURCE_RUNTIME_INCOMPLETE"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_two_member_capacity_readback_fails(self):
        self.artifacts["ph10_three_portal_role_source_evidence.json"]["twoDistinctMemberCapacityReadbackVerified"]=0
        self.write()
        with self.assertRaisesRegex(AssertionError,"THREE_PORTAL_ROLE_SOURCE_RUNTIME_INCOMPLETE"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_national_jit_revocation_fails(self):
        self.artifacts["ph10_three_portal_role_source_evidence.json"]["nationalJitRevokedSessionDenied"]=0
        self.write()
        with self.assertRaisesRegex(AssertionError,"THREE_PORTAL_ROLE_SOURCE_RUNTIME_INCOMPLETE"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_grc_policy_precheck_fails(self):
        self.artifacts["ph10_three_portal_role_source_evidence.json"]["grcArticle129SourcePolicyPrecheck"]=0
        self.write()
        with self.assertRaisesRegex(AssertionError,"THREE_PORTAL_ROLE_SOURCE_RUNTIME_INCOMPLETE"):
            gate.joined(SHA,RUN,self.root)
    def test_portal_fabricated_runtime_fails(self):
        self.artifacts["ph10_three_portal_role_source_evidence.json"]["realBrowserPortalSources"]=11
        self.write()
        with self.assertRaisesRegex(AssertionError,"THREE_PORTAL_ROLE_SOURCE_RUNTIME_INCOMPLETE"):
            gate.joined(SHA,RUN,self.root)
    def test_mismatched_commit_fail_closed(self):
        self.artifacts["ph10_ph04_auth8_exact_evidence.json"]["run"]["commitSha"]="b"*40
        self.write()
        with self.assertRaisesRegex(AssertionError,"CROSS_COMMIT"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_source_id_fails(self):
        self.artifacts["ph10_frozen55_exact_evidence.json"]["cases"].pop()
        self.write()
        with self.assertRaisesRegex(AssertionError,"FROZEN55_RUNTIME_MISSING"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_recovery_fails(self):
        (self.root/"ph10_g5_restore_stdout.log").write_text("restore failed\n")
        with self.assertRaisesRegex(AssertionError,"G5_BACKUP_RESTORE"):
            gate.joined(SHA,RUN,self.root)
    def test_false_promoted_ph08_e2e_fails(self):
        self.artifacts["ph10_ph08_36_http_gap_ledger.json"]["cases"][0]["sourceIdFullHttpJourneyPassed"]=True
        self.write()
        with self.assertRaisesRegex(AssertionError,"PH08_FALSE_E2E"):
            gate.joined(SHA,RUN,self.root)

if __name__=="__main__": unittest.main()
