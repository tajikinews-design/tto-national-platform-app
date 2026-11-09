"""PH12 cooperative navigation must not reload the browser or show a fake login page.
Real authority stays in server endpoints; ephemeral tab cache is UI continuity only.
"""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def src(p):return (ROOT/p).read_text(encoding="utf-8")
class NavigationNoFlash(unittest.TestCase):
 def test_scoped_navigation_uses_app_router_client_links(self):
  link=src("apps/cooperative-management/app/c/[slug]/cooperative-nav-link.tsx")
  self.assertIn('import Link from "next/link"',link)
  self.assertIn('<Link href={href} prefetch={true}',link)
  ui=src("packages/ui/src/index.tsx")
  self.assertIn('NavigationLink?:ComponentType',ui)
  self.assertIn('const InternalLink=NavigationLink??"a"',ui)
  self.assertIn('<InternalLink href={navHref(i,basePath)}',ui)
  self.assertIn('href={basePath+"/settings/credentials"}',ui)
  self.assertIn('href={basePath+"/settings/users"}',ui)
  settings=src("apps/cooperative-management/app/c/[slug]/settings/settings-shell.tsx")
  self.assertIn('<Link prefetch={true} href={"/c/"+slug+"/settings/credentials"}',settings)
  self.assertIn('<Link prefetch={true} href={"/c/"+slug+"/settings/users"}',settings)
 def test_tab_only_validation_continuity_and_revocation(self):
  gate=src("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  for v in ('const verifiedWorkspaceBySlug=new Map','()=>verifiedWorkspaceBySlug.get(slug)?.kind??"checking"',
            '()=>verifiedWorkspaceBySlug.get(slug)?.workspace??null',
            'verifiedWorkspaceBySlug.delete(slug)','verifiedWorkspaceBySlug.set(slug,{kind:"demo",workspace:found})',
            'verifiedWorkspaceBySlug.set(slug,{kind:"manager"})','"/api/commerce/workspaces"',
            '"/api/auth/password/session"','NavigationLink={CooperativeNavLink}'):
   self.assertIn(v,gate)
  self.assertNotIn('localStorage',gate)
  self.assertNotIn('sessionStorage',gate)
 def test_scoped_manager_routes_share_same_navigation(self):
  for p in ('apps/cooperative-management/app/c/[slug]/page.tsx',
            'apps/cooperative-management/app/c/[slug]/modules/[moduleId]/page.tsx',
            'apps/cooperative-management/app/c/[slug]/settings/[section]/page.tsx'):
   self.assertIn('NavigationLink={CooperativeNavLink}',src(p))
 def test_server_authority_remains_enforced(self):
  api=src("apps/cooperative-management/app/api/commerce/workspaces/route.ts")
  self.assertIn('Authorization:"Bearer "+token',api)
  self.assertIn('cache:"no-store"',api)
  gate=src("apps/cooperative-management/app/c/[slug]/entry-gate.tsx")
  self.assertIn('found.staff===true',gate)
  self.assertIn('!found.permissions.includes(moduleId)',gate)
  self.assertIn('settingsSection!==undefined',gate)
if __name__=="__main__":unittest.main()
