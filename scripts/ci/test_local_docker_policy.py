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

if __name__=="__main__":
    unittest.main()
