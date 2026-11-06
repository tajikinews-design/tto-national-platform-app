"""Synthetic negative-control fixtures for PH10 155-ID evidence-join logic.

These fixtures are not actual acceptance evidence; real output is admitted only
from exact-head CI artifacts produced by independent completed jobs.
"""
import importlib.util
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
        self.assertTrue(all(not x["fullSourceUserJourneyPassed"] for x in out["cases"]))
    def test_mismatched_commit_fail_closed(self):
        self.artifacts["ph10_ph04_auth8_exact_evidence.json"]["run"]["commitSha"]="b"*40
        self.write()
        with self.assertRaisesRegex(AssertionError,"CROSS_COMMIT"):
            gate.joined(SHA,RUN,self.root)
    def test_missing_source_id_fails(self):
        self.artifacts["ph10_frozen55_exact_evidence.json"]["cases"].pop()
        self.write()
        with self.assertRaisesRegex(AssertionError,"FROZEN55_DRIFT"):
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
