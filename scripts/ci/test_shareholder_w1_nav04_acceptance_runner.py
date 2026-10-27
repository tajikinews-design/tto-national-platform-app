"""Exact-SHA combined NAV03/04 local QA acceptance entrypoint policy tests.

Static checks do not assert that real Docker/Chromium was executed.
"""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
PS=(ROOT/"scripts/ci/run-shareholder-w1-nav04-acceptance.ps1").read_text("utf-8")
V=(ROOT/"scripts/ci/run-review-phase3b-docker.ps1").read_text("utf-8")
NAV03=(ROOT/"scripts/ci/nav03-interactive-browser.cjs").read_text("utf-8")
NAV04=(ROOT/"scripts/ci/nav04-interactive-browser.cjs").read_text("utf-8")

class LocalNAV03NAV04Acceptance(unittest.TestCase):
 def test_01_sha_pinned_and_source_integrity(self):
  for item in ('[Parameter(Mandatory=$true)][string]$ExpectedCommit',
   'SOURCE_SHA_MISMATCH','SOURCE_WORKTREE_NOT_CLEAN',
   'UNEXPECTED_GITHUB_ORIGIN','git -C $Repository rev-parse HEAD'):
   self.assertIn(item,PS)
 def test_02_tests_full_release_then_visual(self):
  self.assertIn("-p 'test_shareholder*.py'",PS)
  self.assertIn('-Suite Release',PS)
  self.assertIn('-Nav03Interactive -Nav04Interactive',PS)
  self.assertLess(PS.index('TTO_W1_PYTHON_DISCOVERY_PASS_SHA'),
    PS.index('Full pinned PostgreSQL17/Chromium/OCI Docker Release'))
  self.assertLess(PS.index('Full pinned PostgreSQL17/Chromium/OCI Docker Release'),
    PS.index('Phase3B baseline + NAV03 18 + NAV04 10'))
 def test_03_skip_release_is_explicitly_not_acceptance(self):
  self.assertIn('[switch]$SkipFullRelease',PS)
  self.assertIn('TTO_W1_DOCKER_RELEASE_SKIPPED_NO_ACCEPTANCE',PS)
  self.assertIn('TTO_W1_VISUAL_ONLY_PASS_SHA',PS)
  self.assertIn('if($ReleasePassed)',PS)
 def test_04_verify_rendered_pngs_and_provenance(self):
  self.assertIn('SCREENSHOT_MISSING',PS)
  self.assertIn('SCREENSHOT_EMPTY',PS)
  self.assertIn('$Data.expectedSha -cne $Expected',PS)
  self.assertIn('$Dossier.screenshots.Count',PS)
  self.assertIn('$Governance.screenshots.Count',PS)
  self.assertIn('$Phase3B.screenshotsCaptured -ne 62',PS)
 def test_05_safe_cleanup_only_own_sha(self):
  self.assertIn('$Label="tto.phase3b.sha"',PS)
  self.assertIn('CLEANUP_REFUSED_CONTAINER_OWNER_MISMATCH',PS)
  self.assertIn('CLEANUP_REFUSED_VOLUME_OWNER_MISMATCH',PS)
  self.assertIn('if(-not $KeepVisualContainers -and $VisualPassed)',PS)
 def test_06_reports_outside_clean_git_source(self):
  self.assertIn('ReportsRoot=',PS)
  self.assertIn('TTO-W1-VISUAL-',PS)
  self.assertIn('acceptance-transcript.log',PS)
  self.assertIn('acceptance-summary.json',PS)
  self.assertIn('realMembershipSource="BLOCKED"',PS)
  self.assertIn('officialVoting="DISABLED"',PS)
  self.assertIn('mergedOrDeployed=$false',PS)
 def test_07_real_browser_gates_present(self):
  self.assertIn('if($Nav03Interactive) {',V)
  self.assertIn('if($Nav04Interactive) {',V)
  self.assertIn('screenshots.Count -ne 18',V)
  self.assertIn('screenshots.Count -ne 10',V)
  self.assertIn('images.length===18',NAV03)
  self.assertIn('captures.length===10',NAV04)
if __name__=="__main__":unittest.main()
