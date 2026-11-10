"""Issue185 accessible submenu animation and cooperative routing contract."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def src(p):return (R/p).read_text()
NAV=src("packages/ui/src/index.tsx")
MOTION=src("packages/ui/src/animated-sidebar-group.tsx")
CSS=src("packages/ui/src/control-system.css")
PROXY=src("apps/cooperative-management/proxy.ts")
class Menus(unittest.TestCase):
 def test_mounted_animated_groups(self):
  self.assertIn('key="cooperative-members"',NAV)
  self.assertIn('key="cooperative-settings"',NAV)
  self.assertEqual(NAV.count("<AnimatedSidebarGroup"),2)
  self.assertNotIn('<details key="cooperative-',NAV)
  self.assertIn("useState(active)",MOTION)
  self.assertIn("setExpanded(v=>!v)",MOTION)
  self.assertIn("aria-expanded={expanded}",MOTION)
  self.assertIn("aria-controls={id}",MOTION)
  self.assertIn("inert={!expanded}",MOTION)
  self.assertIn("aria-hidden={!expanded}",MOTION)
  self.assertIn('type="button"',MOTION)
 def test_independent_sidebar_colors_and_both_direction_motion(self):
  for k in ("tto-animated-tree.is-expanded","grid-template-rows:0fr",
            "grid-template-rows:1fr","translateY(-9px)",
            "transition:grid-template-rows","rotate(180deg)",
            "prefers-reduced-motion:reduce","focus-visible"):
   self.assertIn(k,CSS)
  self.assertIn("tto-settings-sublink.selected",CSS)
 def test_officers_reachable_on_submenu_and_wildcard_host(self):
  self.assertIn('href={basePath+"/settings/officers"}',NAV)
  self.assertIn('settingsSection==="officers"',NAV)
  self.assertIn('path==="/c/"+slug+"/settings/officers"',PROXY)
  self.assertIn('"/api/commerce/nav02/officers"',PROXY)
  self.assertIn('"/api/commerce/nav02/shahkar-preflight"',PROXY)
if __name__=="__main__":unittest.main()
