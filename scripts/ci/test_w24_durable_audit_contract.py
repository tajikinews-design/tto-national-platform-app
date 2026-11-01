"""W2.4 synthetic durable audit: CI-only privacy and fail-closed invariants.

The Node tests execute actual fsync/temp-file persistence and ephemeral
NextRequest/Nest/Python PDP HTTP chain; this file prevents accidental production
wiring, source/credential exposure, Docker activation and gate removal.
"""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
JOURNAL=ROOT/"scripts/security/w24-durable-synthetic-audit.cjs"
LEDGER_TEST=ROOT/"scripts/ci/w24-durable-audit-ledger.test.cjs"
HTTP_TEST=ROOT/"scripts/ci/w24-bff-nest-pdp-audit-chain.test.cjs"
WORKFLOW=ROOT/".github/workflows/tto-adaptive-ci.yml"
CONTRACT=ROOT/"docs/contracts/shareholder-w2-4-durable-security-audit-v0.1.json"

class W24AuditContractSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.j=JOURNAL.read_text(encoding="utf8")
        cls.l=LEDGER_TEST.read_text(encoding="utf8")
        cls.h=HTTP_TEST.read_text(encoding="utf8")
        cls.w=WORKFLOW.read_text(encoding="utf8")

    def test_01_event_allowlist_and_lab_only(self):
        for x in (
            'process.env.CI==="true"',
            'process.env.NODE_ENV==="test"',
            'process.env.TTO_W24_AUDIT_LAB==="1"',
            '!process.env.VERCEL',
            '!process.env.DATABASE_URL',
            '!process.env.APIIR_TOKEN',
            '!process.env.TTO_API_BASE_URL',
            '!process.env.TEST_ADMIN_DATABASE_URL',
            'const EVENT_KEYS=', 'const PHASES=new Set(',
            'const DECISIONS=new Set(', 'const REASONS=new Set(',
            'exact(v,["decision","phase","reasonCode","requestId"])',
            'return {schemaVersion:e.schemaVersion,sequence:e.sequence,requestId:e.requestId,',
            'requestId:input.requestId,phase:input.phase,decision:input.decision',
            'No database, external network, real identity',
        ):
            with self.subTest(x=x):self.assertIn(x,self.j)
        for forbidden in (
            'require("pg")', 'require("postgres")',
            'new Pool(', 'fetch(', 'http.request(',
            'https.request(', 'process.env.DATABASE_URL||"',
            'canGrantPermission:true','legalOperationalEffect:"REAL"',
            'shareQuantity', 'sourceConnector', 'realShareholder'
        ):
            with self.subTest(forbidden=forbidden):self.assertNotIn(forbidden,self.j)

    def test_02_durable_hash_checkpoint_fsync_and_single_writer(self):
        for x in (
            'const GENESIS="0".repeat(64)',
            'return sha256(e.prevHash+"\\n"+JSON.stringify(unsigned(e)))',
            'fh=await fs.open(temporary,"wx",0o600)',
            'await fh.sync()', 'await fs.rename(temporary,path)',
            'await fsyncDir(dir)', 'handle.sync()',
            'await fs.open(join(dir,"writer.lock"),"wx",0o600)',
            'this.queue.then(async()=>', 'this.poisoned=true',
            'throw fail("AUDIT_STORE_UNAVAILABLE")',
            'if(input&& !input.endsWith("\\n"))throw fail("AUDIT_TORN_WRITE")',
            'anchor.sequence!==lines.length',
            'anchor.headHash!==previous',
            '!st.isFile()||st.isSymbolicLink()',
            'constants.O_NOFOLLOW',
            'async verifyTraces()',
            'AUDIT_TRACE_INCOMPLETE',
            'AUDIT_TRACE_INVALID',
        ):
            with self.subTest(x=x):self.assertIn(x,self.j)
        self.assertNotIn('fs.appendFile(',self.j)
        self.assertNotIn('O_TRUNC',self.j)

    def test_03_real_temp_file_tamper_and_restart_tests(self):
        for x in (
            'TTO_W24_DURABLE_FSYNC_RESTART_TRACE=PASS',
            'TTO_W24_CONCURRENT_APPEND_SEQUENCED=PASS',
            'TTO_W24_EXCLUSIVE_WRITER_LOCK=PASS',
            'TTO_W24_STRICT_AUDIT_METADATA_ALLOWLIST=PASS',
            'TTO_W24_HASH_CHAIN_TAMPER_DETECTED=PASS',
            'TTO_W24_ANCHOR_ROLLBACK_DETECTED=PASS',
            'TTO_W24_TAIL_TRUNCATION_CLOSED=PASS',
            'TTO_W24_TORN_WRITE_RESTART_DENIED=PASS',
            'TTO_W24_SYMLINK_SWAP_DENIED=PASS',
            'TTO_W24_CAUSAL_TRACE_COMPLETENESS_REQUIRED=PASS',
            'TTO_W24_FAIL_CLOSED_AFTER_PERSISTENCE_OUTAGE=PASS',
            'TTO_W24_PRODUCTION_LAB_GUARD_DISABLED=PASS'
        ):
            with self.subTest(x=x):self.assertIn(x,self.l)
        self.assertIn('fs.mkdtemp(',self.l)
        self.assertIn('W24SyntheticAuditJournal.open(dir,{create:true})',self.l)
        self.assertIn('W24SyntheticAuditJournal.open(dir)',self.l)

    def test_04_real_next_nest_pdp_tracing_and_deny_on_audit_outage(self):
        for x in (
            'NextRequest,NextResponse',
            'NestFactory.create(W24TestModule',
            'prepareW1SyntheticBffCandidate',
            'prepareW23DormantBffEnvelope',
            'verifyW23DormantNestEnvelope',
            'normalizeW23SyntheticNestPolicyVerdict',
            'runW22CancellablePDP("read",checked.context',
            'journal.append(marker(id,"BFF_PREFLIGHT"',
            'journal.append(marker(id,"BFF_RESPONSE"',
            'journal.append(marker(checked.requestId,"NEST_SCOPE"',
            'journal.append(marker(checked.requestId,"PDP_RESULT"',
            'TTO_W24_BFF_NEST_PDP_CORRELATED_DURABLE_TRACE=PASS',
            'TTO_W24_DENIED_REQUEST_TRACE_NO_NEST_NO_SOURCE=PASS',
            'TTO_W24_NO_CREDENTIAL_OR_PII_IN_PERSISTED_LOG=PASS',
            'TTO_W24_NEST_SOURCE_REVOCATION_AUDITED_DENY=PASS',
            'TTO_W24_PDP_TIMEOUT_CORRELATED_DENY=PASS',
            'TTO_W24_CORRUPT_UPSTREAM_NO_LOG_DISCLOSURE=PASS',
            'TTO_W24_RESTART_VERIFIED_CHAIN_COMPLETE=PASS',
            'TTO_W24_AUDIT_FAILURE_BLOCKS_NEST_AND_RESOURCE=PASS'
        ):
            with self.subTest(x=x):self.assertIn(x,self.h)
        self.assertIn('sourceTouches=0',self.h)
        self.assertIn('assert.equal(sourceTouches,0)',self.h)
        self.assertNotIn('services/api/dist/main.js',self.h)
        self.assertNotIn('postgresql://',self.h)
        self.assertNotIn('docker run',self.h)

    def test_05_never_import_synthetic_audit_into_routes_or_appmodule(self):
        for root in (
            ROOT/"apps/shareholder/app",
            ROOT/"apps/cooperative-management",
            ROOT/"apps/national-admin",
            ROOT/"services/api/src"
        ):
            for ext in ("*.ts","*.tsx"):
                for file in root.rglob(ext):
                    text=file.read_text(encoding="utf8")
                    self.assertNotIn("w24-durable-synthetic-audit",text,str(file))
                    self.assertNotIn("TTO_W24_AUDIT_LAB",text,str(file))
        self.assertNotIn('@Controller(',self.j)
        self.assertNotIn('NextResponse',self.j)
        self.assertNotIn('AppModule',self.j.split("class W24SyntheticAuditJournal",1)[-1])

    def test_06_exact_draft_github_ci_without_docker_but_full_security_replay(self):
        s=self.w
        branch="test/w2-4-durable-audit-no-docker-20261101"
        self.assertIn("github.event.pull_request.draft && github.head_ref == '"+branch+"'",s)
        self.assertIn('TTO_W24_AUDIT_LAB: "1"',s)
        self.assertIn('TTO_W24_GITHUB_ACTIONS_NO_DOCKER=PASS',s)
        self.assertIn('node --test scripts/ci/w24-durable-audit-ledger.test.cjs scripts/ci/w24-bff-nest-pdp-audit-chain.test.cjs',s)
        self.assertIn('node --test scripts/ci/w2-inline-lab-http.test.cjs',s)
        self.assertIn('node --test scripts/ci/w2-2-cancellable-pdp.test.cjs',s)
        self.assertIn('node --test scripts/ci/w23-dormant-boundary-contract.test.cjs',s)
        for label in (
            "Start a single disposable local PostgreSQL 17 container",
            "Apply migrations 0001-0010 to disposable PG17 only",
            "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
            "Complete historical SQL, OTP, login/logout and authority regression",
            "Build and smoke all four OCI images without registry push",
            "Stop isolated PostgreSQL even on failure"
        ):
            span=s.split("- name: "+label,1)
            self.assertEqual(len(span),2,label)
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",
                          span[1].split("- name:",1)[0],label)
        self.assertIn('permissions:\n  contents: read',s)

    def test_07_audit_contract_explicit_non_operational_limits(self):
        d=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(d["schemaVersion"],"0.1-DRAFT")
        self.assertEqual(d["capabilityState"],"ISOLATED_GITHUB_CI_AUDIT_ONLY")
        self.assertEqual(d["legalOperationalEffect"],"NONE")
        self.assertFalse(d["operationalAuditProviderRegistered"])
        self.assertFalse(d["productionRouteWired"])
        self.assertFalse(d["nestAppModuleRegistered"])
        self.assertFalse(d["canGrantPermission"])
        self.assertFalse(d["databaseOrDockerUsed"])
        self.assertFalse(d["storage"]["cryptographicNonRepudiation"])
        self.assertEqual(d["storage"]["persistenceScope"],
                         "LOCAL_RESTART_IN_SINGLE_GITHUB_RUN_ONLY")
        self.assertEqual(d["storage"]["retention"],"EPHEMERAL_TEST_CLEANUP")
        self.assertEqual(d["eventSchema"]["allowedIdentityFields"],[])
        self.assertFalse(d["failClosed"]["successMayProceedWithoutAudit"])
        self.assertEqual(d["storage"]["exclusivity"][:21],
                         "lock file created with")
        self.assertTrue(d["failClosed"]["hashChainMismatch"])

if __name__=="__main__":
    unittest.main()
