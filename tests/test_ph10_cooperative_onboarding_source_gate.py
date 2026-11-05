"""PH10 cooperative onboarding source/invariant checks (NOT PostgreSQL execution).

This preflight is deliberately executable without Docker or credentials.
It cannot prove migrations, authorization behavior, legal validity or browser E2E.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class PH10CooperativeSourceGate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = read("database/migrations/9998_ph10_cooperative_dossier_review_gate.sql")
        cls.draft = read("database/migrations/9999_ph10_cooperative_onboarding_drafts.sql")
        cls.quarantine = read("database/migrations/9999b_ph10_cooperative_evidence_quarantine.sql")
        cls.external = read("database/migrations/9999c_ph10_cooperative_external_source_review_gate.sql")
        cls.malware = read("database/migrations/9999d_ph10_cooperative_malware_scan_receipts.sql")
        cls.manual = read("database/migrations/9999e_ph10_manager_official_notice_claims.sql")
        cls.clamd = read("services/api/src/clamd-evidence.ts")
        cls.scan_bff = read("apps/national-admin/app/api/cooperatives/onboarding-evidence/[evidenceId]/scan/route.ts")
        cls.api = read("services/api/src/module.ts")
        cls.front = read("apps/national-admin/app/cooperatives/onboarding/page.tsx")
        cls.draft_bff = read("apps/national-admin/app/api/cooperatives/onboarding-drafts/route.ts")
        cls.file_bff = read("apps/national-admin/app/api/cooperatives/onboarding-evidence/route.ts")
        cls.review_bff = read("apps/national-admin/app/api/cooperatives/onboarding/[dossierId]/actions/route.ts")

    def test_no_autonomous_legal_activation(self):
        for sql in (self.review, self.draft, self.quarantine, self.external, self.malware):
            self.assertNotRegex(sql, r"(?i)\bINSERT\s+INTO\s+tto\.(?:tenants|role_assignments)\b")
            self.assertNotRegex(sql, r"(?i)\bUPDATE\s+tto\.tenants\b")
        self.assertNotIn("'APPROVED'", self.review)
        self.assertNotIn("'ACTIVE'", self.review)
        self.assertIn("EXTERNAL_APPROVAL_REQUIRED", self.review)
        self.assertIn("NOT_VERIFIED", self.quarantine)

    def test_drafts_are_reserved_and_versioned(self):
        self.assertIn("REFERENCES tto.cooperative_workspace_addresses(workspace_id)", self.draft)
        self.assertIn("request_key uuid PRIMARY KEY", self.draft)
        self.assertIn("STALE_DRAFT_VERSION", self.draft)
        self.assertIn("DRAFT_OWNER_MISMATCH", self.draft)
        self.assertIn("tto.has_national_root()", self.draft)
        self.assertIn("hashtextextended(p_slug,42)", self.draft)
        self.assertIn("hashtextextended($1,42)", self.api)

    def test_review_is_serial_and_audited(self):
        self.assertIn("FOR UPDATE", self.review)
        self.assertIn("request_key uuid UNIQUE", self.review)
        self.assertIn("REVIEW_IDEMPOTENCY_KEY_CONFLICT", self.review)
        self.assertIn("STALE_REVIEW_VERSION", self.review)
        self.assertIn("INDEPENDENT_REVIEW_AND_EVIDENCE_REQUIRED", self.review)
        self.assertIn("REFER_EXTERNAL_REVIEW", self.review)
        self.assertIn("tto.has_national_root()", self.review)
        self.assertIn("reviewed_at", self.review)

    def test_quarantine_never_releases_unverified_files(self):
        self.assertIn("ciphertext bytea", self.quarantine)
        self.assertIn("CHECK(scan_status='QUARANTINED')", self.quarantine)
        self.assertIn("CHECK(authenticity_status='NOT_VERIFIED')", self.quarantine)
        self.assertIn("FORCE ROW LEVEL SECURITY", self.quarantine)
        self.assertNotRegex(self.quarantine, r"(?i)GRANT\s+SELECT\s+ON\s+tto\.cooperative_onboarding_evidence_quarantine")
        self.assertIn("hashtextextended(p_slug,42)", self.quarantine)
        self.assertIn("hashtextextended(p_upload_key::text,57)", self.quarantine)
        self.assertIn("EVIDENCE_UPLOAD_WINDOW_CLOSED", self.quarantine)
        self.assertIn("v_existing.content_sha256=p_sha", self.quarantine)
        self.assertIn("createCipheriv(\"aes-256-gcm\"", self.api)

    def test_independent_legal_reviewer_mandate_cannot_create_approval(self):
        self.assertIn("CREATE TABLE tto.cooperative_external_legal_review_mandates", self.external)
        self.assertIn("CREATE TABLE tto.cooperative_external_source_check_records", self.external)
        self.assertIn("REVOKE ALL ON tto.cooperative_external_legal_review_mandates FROM PUBLIC,tto_app", self.external)
        self.assertIn("REVOKE ALL ON tto.cooperative_external_source_check_records FROM PUBLIC,tto_app", self.external)
        self.assertIn("INDEPENDENT_EXTERNAL_REVIEWER_REQUIRED", self.external)
        self.assertIn("m.expires_at>clock_timestamp()", self.external)
        self.assertIn("m.revoked_at IS NULL", self.external)
        self.assertIn("v_dossier.created_by=v_actor", self.external)
        self.assertIn("authenticity','NOT_VERIFIED'", self.external)
        self.assertIn("MATCH_REPORTED_UNVERIFIED", self.external)
        self.assertIn("tto.cooperative_evidence_integrity_packet", self.external)
        self.assertIn("record_independent_cooperative_source_check", self.api)

    def test_api_boundary_is_fail_closed(self):
        for content in (self.draft_bff, self.file_bff, self.review_bff):
            self.assertIn('tto_session', content)
            self.assertIn('ORIGIN_REQUIRED', content)
            self.assertIn('TTO_ISOLATED_DEMO_DB', content)
            self.assertIn('cache:"no-store"', content)
        self.assertIn("crypto.randomUUID()", self.front)
        self.assertIn("uploadQuarantinedEvidence", self.front)
        self.assertIn("saveDraft", self.front)
        self.assertIn("REFER_EXTERNAL_REVIEW", self.front)

    def test_scan_receipts_are_not_releasing_legal_quarantine(self):
        self.assertIn("REVOKE ALL ON tto.cooperative_onboarding_malware_scan_receipts FROM PUBLIC,tto_app",self.malware)
        self.assertIn("REVIEWER_SESSION",self.external)
        self.assertIn("tto.resolve_session(p_session_hash)",self.malware)
        self.assertIn("FOR SHARE",self.malware)
        self.assertIn("'stillQuarantined',true",self.malware)
        self.assertIn("'authenticity','NOT_VERIFIED'",self.malware)
        self.assertNotIn("UPDATE tto.cooperative_onboarding_evidence_quarantine",self.malware)
        self.assertNotIn("INSERT INTO tto.tenants",self.malware)
        self.assertIn("zINSTREAM\\0",self.clamd)
        self.assertIn("socket.setTimeout",self.clamd)
        self.assertIn('from "./clamd-evidence"',self.api)
        self.assertIn('POST(req:NextRequest',self.scan_bff)
        self.assertIn('ORIGIN_REQUIRED',self.scan_bff)
        self.assertIn('stillQuarantined!==true',self.scan_bff)

    def test_pg17_test_files_are_rollback_only(self):
        files = (
            "tests/sql/ph10-cooperative-dossier-review-disposable.sql",
            "tests/sql/ph10-cooperative-draft-disposable.sql",
            "tests/sql/ph10-cooperative-evidence-quarantine-disposable.sql",
            "tests/sql/ph10-cooperative-external-source-review-disposable.sql",
            "tests/sql/ph10-cooperative-malware-scan-disposable.sql",
        )
        for name in files:
            sql = read(name)
            self.assertRegex(sql, r"(?m)^BEGIN;")
            self.assertRegex(sql, r"(?m)^ROLLBACK;")
            self.assertIn("tto.tenants", sql)
            self.assertIn("tto.role_assignments", sql)
            self.assertNotIn("ttoney", sql)
            self.assertNotIn("ttotsh", sql)

    def test_owner_machine_sql_runner_is_network_isolated(self):
        ps = read("scripts/ci/ph10-cooperative-dossier-local-pg17.ps1")
        self.assertIn("'--network','none'", ps)
        self.assertIn("postgres:17-alpine", ps)
        self.assertIn("$Head -ne $ExpectedHead", ps)
        self.assertIn("NO_NETWORK=TRUE NO_PORTS=TRUE", ps)
        self.assertIn("REMOVED_ONLY_OWN_CONTAINER", ps)


if __name__ == "__main__":
    unittest.main()
