"""W2.3 dormant contract: source-layout, release and no-operational-registration invariants.

Executable JS/NextRequest/Nest Fastify tests prove the synthetic HTTP path.
These Python tests guard against accidental production import/activation.
"""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
BFF=ROOT/"apps/shareholder/lib/w23-dormant-policy-boundary.ts"
NEST=ROOT/"services/api/src/w23-dormant-policy-boundary.ts"
TEST=ROOT/"scripts/ci/w23-dormant-boundary-contract.test.cjs"
CI=ROOT/".github/workflows/tto-adaptive-ci.yml"
CONTRACT=ROOT/"docs/contracts/shareholder-w2-3-dormant-bff-nest-adapter-v0.1.json"

class W23DormantSecuritySeam(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bff=BFF.read_text(encoding="utf8")
        cls.nest=NEST.read_text(encoding="utf8")
        cls.t=TEST.read_text(encoding="utf8")
        cls.ci=CI.read_text(encoding="utf8")

    def test_01_actual_location_files_have_dormant_only_capability(self):
        for s in (self.bff,self.nest):
            for marker in (
                "W2_3_DORMANT_BOUNDARY_V0_1",
                'process.env.CI === "true"',
                'process.env.NODE_ENV === "test"',
                'process.env.TTO_W23_CONTRACT_LAB === "1"',
                '!process.env.VERCEL',
                '!process.env.DATABASE_URL',
                '!process.env.TTO_API_BASE_URL',
                '!process.env.APIIR_TOKEN',
                '!process.env.TEST_ADMIN_DATABASE_URL',
            ):
                with self.subTest(marker=marker):self.assertIn(marker,s)
            for forbidden in (
                "fetch(", "new Pool(", "Prisma", "DATABASE_URL ??",
                "SupabaseClient", "next/headers", 'return { available: true',
                'canGrantPermission: true', 'legalOperationalEffect: "REAL"',
                'authorizationApproved: true', "tradingEnabled"
            ):
                with self.subTest(forbidden=forbidden):self.assertNotIn(forbidden,s)
        self.assertIn('import type { W1BffResult } from "./w1-boundary-seam"',self.bff)
        self.assertIn('import type { W1PdpContext, W1ServerLabProof } from "./w1-boundary-seam"',self.nest)

    def test_02_bff_six_field_envelope_and_closed_response(self):
        s=self.bff
        for marker in (
            'kind: "DRAFT_CANDIDATE"',
            'operation: "read"',
            'requestId: randomUUID()',
            'signal: request.signal',
            'kind: "DENY"',
            'W23_OPERATIONAL_NOT_APPROVED',
            'W23_UPSTREAM_CONTRACT_INVALID',
            'raw.canGrantPermission !== false',
            'raw.hasActualRecord !== false',
            'raw.legalOperationalEffect !== "NONE"',
            'raw.requestId !== expectedRequestId',
            'raw.auditCount !== 1',
            'Object.keys(raw).sort()',
            'status: 403',
            'available: false'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn('authorization: ',s.lower())
        self.assertNotIn('return { available: true',s)

    def test_03_nest_independent_scope_and_no_operational_policy(self):
        s=self.nest
        for marker in (
            'verifyW23DormantNestEnvelope(',
            'normalizeW23SyntheticNestPolicyVerdict(',
            'kind: "SYNTHETIC_PDP_CANDIDATE"',
            'kind: "SIMULATED_ONLY"',
            'wire.tenantKey !== serverProof.tenantKey',
            'wire.ownerKey !== serverProof.ownerKey',
            'serverProof.partyBound !== true',
            'serverProof.membershipSourceApproved !== true || serverProof.sourceApproved !== true',
            'serverProof.readPermission !== true',
            'serverProof.sourceFresh !== true',
            'wire.operation !== "read"',
            'signal.aborted',
            'raw.canGrantPermission !== false',
            'raw.hasActualRecord !== false',
            'raw.legalOperationalEffect !== "NONE"'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn('@Controller(',s)
        self.assertNotIn('@Injectable(',s)
        self.assertNotIn('NestFactory',s)
        self.assertNotIn('new Pool(',s)

    def test_04_no_real_next_route_or_nest_module_imports_w23(self):
        for root in (ROOT/"apps/shareholder/app",ROOT/"services/api/src"):
            for f in root.rglob("*.ts"):
                if f==NEST:continue
                text=f.read_text(encoding="utf8")
                self.assertNotIn("w23-dormant-policy-boundary",text,str(f))
                self.assertNotIn("W23_CONTRACT_VERSION",text,str(f))
                self.assertNotIn("W23_NEST_CONTRACT_VERSION",text,str(f))
            for f in root.rglob("*.tsx"):
                self.assertNotIn("w23-dormant-policy-boundary",f.read_text(encoding="utf8"),str(f))
        module=(ROOT/"services/api/src/module.ts").read_text(encoding="utf8")
        self.assertNotIn('W23',module)
        self.assertNotIn('w23-dormant',module)
        for path in (ROOT/"apps/shareholder/app/api/tenants").rglob("route.ts"):
            self.assertNotIn("w23",path.read_text(encoding="utf8").lower(),str(path))

    def test_05_full_synthetic_http_attack_suite_exists(self):
        s=self.t
        for marker in (
            'NextRequest,NextResponse',
            'NestFactory.create(W23TestOnlyModule',
            'apps/shareholder/lib/w23-dormant-policy-boundary.ts',
            'services/api/src/w23-dormant-policy-boundary.ts',
            'prepareW1SyntheticBffCandidate',
            'runW22CancellablePDP("read",checked.context',
            'TTO_W23_SIMULATED_ALLOW_CANNOT_GRANT_REAL_READ=PASS',
            'TTO_W23_W1_BFF_PRE_SOURCE_DENIAL=PASS',
            'TTO_W23_BROWSER_IDENTITY_HEADERS_IGNORED=PASS',
            'TTO_W23_ALL_MUTATING_AND_EXPORT_OPERATIONS_BLOCKED=PASS',
            'TTO_W23_NEST_INDEPENDENT_TENANT_OWNER_SOURCE_GATES=PASS',
            'TTO_W23_UPSTREAM_EXACT_ALLOWLIST_NO_DISCLOSURE=PASS',
            'TTO_W23_NEST_PDP_TIMEOUT_FAIL_CLOSED=PASS',
            'TTO_W23_ABORT_SIGNAL_NOT_SERIALIZED=PASS',
            'TTO_W23_RUNTIME_NOT_REGISTERED_DENY=PASS',
            'TTO_W23_NO_SOURCE_TOUCHES_NO_OPERATIONAL_ALLOW=PASS'
        ):
            with self.subTest(marker=marker):self.assertIn(marker,s)
        self.assertNotIn('dist/main.js',s)
        self.assertNotIn('docker run',s)
        self.assertNotIn('postgresql://',s)
        self.assertNotIn('Dockerfile',s)

    def test_06_github_actions_exact_draft_no_docker_and_no_deploy(self):
        s=self.ci
        self.assertIn("github.event.pull_request.draft && github.head_ref == 'spec/w2-3-dormant-boundary-contract-no-docker-20261101'",s)
        self.assertIn('TTO_W23_CONTRACT_LAB: "1"',s)
        self.assertIn('node --test scripts/ci/w23-dormant-boundary-contract.test.cjs',s)
        self.assertIn('TTO_W23_GITHUB_ACTIONS_NO_DOCKER=PASS',s)
        for name in (
            "Start a single disposable local PostgreSQL 17 container",
            "Apply migrations 0001-0010 to disposable PG17 only",
            "Real Next Nest PostgreSQL identity, tenant, source and share quarantine E2E",
            "Complete historical SQL, OTP, login/logout and authority regression",
            "Build and smoke all four OCI images without registry push",
            "Stop isolated PostgreSQL even on failure"
        ):
            span=s.split("- name: "+name,1)
            self.assertEqual(len(span),2,name)
            self.assertIn("env.TTO_W2_NO_DOCKER_BRANCH != 'true'",
                         span[1].split("- name:",1)[0],name)
        self.assertIn('permissions:\n  contents: read',s)
        self.assertNotIn('actions/deploy',s)

    def test_07_contract_no_permission_no_route_activation(self):
        v=json.loads(CONTRACT.read_text(encoding="utf8"))
        self.assertEqual(v["schemaVersion"],"0.1-DRAFT")
        self.assertEqual(v["capabilityState"],"UNREGISTERED_CONTRACT")
        for key in ("productionRouteWired","nestAppModuleRegistered",
                    "operationalReadAllowed","operationalTradeAllowed",
                    "liveDataOrDbUsed","sourceAdmissionApproved","canGrantPermission"):
            self.assertFalse(v[key],key)
        self.assertEqual(v["legalOperationalEffect"],"NONE")
        self.assertEqual(len(v["envelope"]["fields"]),6)
        self.assertTrue(v["bffInterpreter"]["neverReturns200"])
        self.assertTrue(v["bffInterpreter"]["neverReturnsAvailableTrue"])
        self.assertTrue(v["bffInterpreter"]["neverReturnsOperationalAllow"])

if __name__=="__main__":
    unittest.main()
