"""Read-only national cooperative directory regression contracts.

The preflight does not claim live DB acceptance or legal tenant activation.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class CooperativeDirectoryContract(unittest.TestCase):
    def test_backend_requires_real_root_session_and_returns_only_reserved_workspace_metadata(self):
        api = source("services/api/src/module.ts")
        start = api.index('@Get("national/cooperative-registry")')
        end = api.index('@Get("national/cooperative-workspaces/:slug")', start)
        route = api[start:end]
        for marker in (
            'TTO_ISOLATED_DEMO_DB', 'this.db.sessionActor(auth)',
            'this.db.withActor(actor', 'tto.has_national_root()',
            'FROM tto.cooperative_workspace_addresses',
            "WHERE state='RESERVED'", 'LIMIT 201', "slice(0,200)",
            'containsActivatedTenants:false',
        ):
            self.assertIn(marker, route)
        self.assertNotIn("FROM tto.tenants", route)
        self.assertNotIn("cooperative_onboarding_dossiers", route)
        self.assertNotIn("INSERT INTO", route)
        self.assertNotIn("UPDATE tto.", route)

    def test_bff_keeps_cookie_private_and_verifies_upstream_shape(self):
        bff = source("apps/national-admin/app/api/cooperatives/route.ts")
        for marker in (
            'cookies.get("tto_session")', 'trustedBackendHeaders(request)',
            'Bearer ', 'cache:"no-store"',
            'GET(request:NextRequest)',
            'ISOLATED_DEMO_DATABASE_REQUIRED', 'NATIONAL_ROOT_REQUIRED',
            'RESERVED_WORKSPACES', 'containsActivatedTenants:false',
        ):
            self.assertIn(marker, bff)
        self.assertNotIn("export async function POST", bff)
        self.assertNotIn("NEXT_PUBLIC_", bff)

    def test_directory_requires_national_session_gate_and_displays_honest_status(self):
        page = source("apps/national-admin/app/cooperatives/page.tsx")
        directory = source("apps/national-admin/app/cooperatives/cooperative-directory.tsx")
        self.assertIn('<PortalSessionGate surface="national">', page)
        self.assertIn('activeId="NAV-02"', page)
        self.assertIn('fetch("/api/cooperatives"', directory)
        self.assertIn("نشانی رزروشده", directory)
        self.assertIn("فهرست تعاونی‌ها", directory)
        self.assertIn('href="/cooperatives/onboarding"', directory)
        self.assertIn('href="/cooperatives/new"', directory)
        self.assertNotIn("ttotsh", directory)
        self.assertNotIn("ttoney", directory)

    def test_navigation_and_dashboard_link_to_directory(self):
        nav = source("packages/ui/src/index.tsx")
        workbench = source("packages/ui/src/portal-module-workbench.tsx")
        dashboard = source("packages/ui/src/approved-dashboard.tsx")
        self.assertIn('const nationalNavigation = ["داشبورد", "تعاونی‌ها",', nav)
        self.assertIn('navigation: nationalNavigation', nav)
        self.assertIn('title:"فهرست تعاونی‌ها",href:"/cooperatives"', workbench)
        self.assertIn('href:"/cooperatives"}', dashboard)
        self.assertIn('national:["/cooperatives","/cooperatives/new"', dashboard)


if __name__ == "__main__":
    unittest.main()
