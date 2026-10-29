#!/usr/bin/env python3
"""Review-only BFF/Nest seam safety regression; no live endpoint or datastore."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def source(path):
    return (ROOT/path).read_text(encoding="utf-8")

class TestW1SyntheticServerBoundary(unittest.TestCase):
    def test_bff_closed_read_never_grants_source(self):
        s=source("apps/shareholder/lib/source-read-access.ts")
        self.assertIn("return DENIED;",s)
        self.assertIn("source remain unapproved",s)
        self.assertIn('cache:"no-store"',s)
        self.assertIn('redirect:"error"',s)
        self.assertIn("trustedBackendHeaders(request)",s)

    def test_trade_requests_still_cannot_mutate(self):
        s=source("apps/shareholder/app/api/tenants/[tenantId]/me/trade-requests/route.ts")
        self.assertIn("export async function GET(",s)
        self.assertNotIn("export async function POST(",s)
        self.assertNotIn("export async function PATCH(",s)
        self.assertNotIn("export async function DELETE(",s)
        self.assertIn("return deny(rejected.status,rejected.code)",s)

    def test_existing_identity_binding_is_server_side(self):
        s=source("services/api/src/module.ts")
        self.assertIn("async sessionActor(",s)
        self.assertIn("tto.resolve_session",s)
        self.assertIn("async inTenant<",s)
        self.assertIn("set_config('tto.actor_id'",s)
        self.assertIn("set_config('tto.tenant_id'",s)

    def test_no_proposed_route_becomes_authoritative(self):
        s=source("docs/analysis/NAVIGATION_CONTRACT.json")
        self.assertIn('"implementation_status": "NOT_IMPLEMENTED"',s)
        self.assertEqual(s.count('"authoritative_routes": null'),11)
        self.assertEqual(s.count('"permission_policy": null'),11)

if __name__ == "__main__":
    unittest.main()
