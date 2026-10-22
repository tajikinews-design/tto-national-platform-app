"""Offline policy/regression checks for the one-shot PowerShell CI script."""
from pathlib import Path
import unittest

RUNNER=Path(__file__).with_name("run-local-docker.ps1")

class TestLocalDockerRunnerPolicy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=RUNNER.read_text(encoding="utf-8")

    def test_source_is_exact_commit_and_private(self):
        s=self.data
        for required in (
            "git -C $Repository archive",
            "ExpectedCommit",
            "POTENTIAL_TRACKED_SECRET_FILES_REFUSE_LOCAL_CI_ARCHIVE",
            "TTO_LOCAL_SOURCE_ARCHIVE_SHA256",
            "pnpm install --frozen-lockfile",
            "node scripts/e2e-cf02-identity-authority.cjs",
            "TTO_LOCAL_CORE_PASS_SHA=",
        ):
            with self.subTest(required=required):
                self.assertIn(required,s)

    def test_single_well_delimited_script(self):
        s=self.data
        self.assertEqual(s.count("Start-Transcript -Path"),1)
        self.assertEqual(s.count("Stop-Transcript | Out-Null"),1)
        self.assertEqual(s.count("git -C $Repository archive"),1)
        self.assertEqual(s.count("TTO_LOCAL_CORE_PASS_SHA="),1)
        self.assertTrue(s.rstrip().endswith("}"))
        # Old corrupted revision had an unterminated credential guard
        # followed by a duplicate copy of the remaining script.
        self.assertNotIn("$base -ne '.env.example\n",s)

    def test_no_host_ports_or_broad_docker_cleanup(self):
        s=self.data
        for required in (
            '"--network", $networkName',
            '"--network", ("container:" + $pgContainer)',
            '"--network", "none"',
            'docker rm -f $nodeContainer',
            'docker rm -f $pgContainer',
            'docker network rm $networkName',
            'docker volume rm -f $sourceVolume',
            'APIIR_TOKEN=',
        ):
            with self.subTest(required=required):
                self.assertIn(required,s)
        for forbidden in (
            "docker system prune", "docker compose down",
            "docker volume prune", "--privileged", "--publish",
            "-p 5432:5432", "-p 0.0.0.0", "GITHUB_TOKEN",
            "SUPABASE_SERVICE_ROLE_KEY",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden,s)

class TestReleaseSuitePolicy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.core=RUNNER.read_text(encoding="utf-8")
        cls.release=RUNNER.with_name("local-release-helper.ps1").read_text(encoding="utf-8")

    def test_core_default_and_explicit_release(self):
        c=self.core
        for required in (
            '[ValidateSet("Core","Release")][string]$Suite = "Core"',
            'if ($Suite -eq "Release")',
            '@releaseParameters -AttestationOnly',
            'local-release-helper.ps1',
            'TTO_LOCAL_CORE_PHASE_PASS_SHA=',
            'TTO_LOCAL_RELEASE_PASS_SHA=',
            'TTO_LOCAL_CORE_PASS_SHA=',
        ):
            with self.subTest(required=required):self.assertIn(required,c)

    def test_release_legacy_security_coverage(self):
        r=self.release
        for required in (
            'TTO_RELEASE_RESOURCE_SCOPE_REJECTED',
            'TTO_RELEASE_DISPOSABLE_CONTAINER_IDENTITY_MISMATCH',
            'DROP DATABASE IF EXISTS tto WITH (FORCE)',
            'tests/sql/tenant-isolation.sql',
            'tests/sql/cf01-cf03-v2.sql',
            'tests/sql/cf01-cf03-v3.sql',
            'tests/sql/cf02-cf03-v4.sql',
            'services/api/test/identity-workflows.integration.cjs',
            'services/api/test/tenant-auth.integration.cjs',
            'tests/sql/cf01-smsotp-issuance.sql',
            'services/api/test/smsotp-request.integration.cjs',
            'scripts/e2e-cf01-three-portal-login-logout.cjs',
            'TTO_LOCAL_RELEASE_HISTORICAL_PASS',
        ):
            with self.subTest(required=required):self.assertIn(required,r)

    def test_docker_attestation_accepts_id_and_declared_unpublished_ports(self):
        r=self.release
        # Docker normalizes 'container:<name>' to 'container:<id>' on some engines.
        # The target must still match the verified PG container full/short ID.
        for required in (
            'Inspect-DisposableContainer',
            'docker inspect --type container',
            'ConvertFrom-Json',
            'Has-PublishedHostPorts',
            'TTO_RELEASE_DISPOSABLE_RESOURCE_ATTESTATION_PASS',
            'TTO_RELEASE_NO_HOST_PORTS_VERIFIED',
            'TTO_LOCAL_RELEASE_EARLY_ATTESTATION_PASS',
            'if ($AttestationOnly)',
            'TTO_RELEASE_HOST_PORT_PUBLICATION_FORBIDDEN',
            'TTO_RELEASE_DISPOSABLE_NODE_NAMESPACE_MISMATCH',
            'TTO_RELEASE_DISPOSABLE_POSTGRES_NETWORK_MISMATCH',
            'TTO_RELEASE_DISPOSABLE_CONTAINER_IDENTITY_MISMATCH',
            'StartsWith($target, [StringComparison]::OrdinalIgnoreCase)',
            '$pgNetworks.Count -ne 1',
            '$pgMode -notin @($PrivateNetwork,$privateNetworkId)',
            '$Info.HostConfig.PublishAllPorts',
            '$Info.NetworkSettings.Ports',
        ):
            with self.subTest(required=required):
                self.assertIn(required,r)
        self.assertNotIn('$nodeNetwork -ne ("container:" + $PostgresContainer)',r)
        self.assertNotIn('$pgPorts -notin @("null","{}")',r)

    def test_release_four_images_no_open_port_or_registry_push(self):
        r=self.release
        for required in (
            'apps/shareholder/Dockerfile',
            'apps/cooperative-management/Dockerfile',
            'apps/national-admin/Dockerfile',
            'services/api/Dockerfile',
            '"--network","none"',
            'TTO_LOCAL_RELEASE_OCI_FOUR_IMAGE_PASS',
            'TTO_LOCAL_RELEASE_OCI_API_DENY_PASS',
            'docker image rm -f $image',
            'docker rm -f $runtime',
            'TTO_LOCAL_RELEASE_EXTRA_PASS',
            'TTO_LOCAL_RELEASE_ARVAN_STATIC_PASS',
        ):
            with self.subTest(required=required):self.assertIn(required,r)
        for forbidden in (
            'docker compose down','docker system prune','docker volume prune',
            '--privileged','--publish','-p 5432:5432',
            'docker push','docker login','GITHUB_TOKEN',
            'SUPABASE_SERVICE_ROLE_KEY','ARVAN_TOKEN',
        ):
            with self.subTest(forbidden=forbidden):self.assertNotIn(forbidden,r)
        self.assertEqual(r.count('TTO_LOCAL_RELEASE_EXTRA_PASS'),1)
        self.assertTrue(r.rstrip().endswith("}"))

if __name__=="__main__":
    unittest.main()
