"""Static safety rails for Windows one-shot local Core runner."""
from pathlib import Path
import unittest

RUNNER=Path(__file__).with_name("run-local-docker.ps1")
class TestLocalDockerRunnerPolicy(unittest.TestCase):
    def test_source_is_exact_commit(self):
        data=RUNNER.read_text(encoding="utf-8")
        self.assertIn("git -C $Repository archive",data)
        self.assertIn("ExpectedCommit",data)
        self.assertIn("scripts/e2e-cf02-identity-authority.cjs",data)
        self.assertIn("pnpm --frozen-lockfile",data.replace("pnpm install --frozen-lockfile","pnpm --frozen-lockfile"))
    def test_no_host_port_no_global_docker_cleanup(self):
        data=RUNNER.read_text(encoding="utf-8")
        self.assertIn('"--network","container:$pg"',data)
        self.assertIn('"--network","none"',data)
        for forbidden in ("docker system prune","docker compose down","docker volume prune","--privileged","-p 5432:5432","--publish","-p 0.0.0.0","GITHUB_TOKEN","SUPABASE_SERVICE_ROLE_KEY"):
            self.assertNotIn(forbidden,data)
        for must in ('docker rm -f $runner','docker rm -f $pg','docker volume rm -f $sourceVolume','APIIR_TOKEN=','TTO_LOCAL_CORE_PASS_SHA='):
            self.assertIn(must,data)
if __name__=="__main__":unittest.main()
