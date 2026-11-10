"""Contract checks for Issue #185's incremental NAV-02 changes.

This does NOT prove live Shahkar, identity ownership, cross-tenant authorization,
production deployment or legal acceptance. Those remain separate HOLD gates.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
FORM = (ROOT / "apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx").read_text()
BFF = (ROOT / "apps/cooperative-management/app/api/commerce/nav02/shahkar-preflight/route.ts").read_text()
BACKEND = (ROOT / "services/api/src/module.ts").read_text()


class Issue185ContractTests(unittest.TestCase):
    def test_preflight_requires_authenticated_owner_query(self):
        route = BACKEND.split('  @Post("commerce/demo/nav02/shahkar-preflight")', 1)[1].split(
            "  private async checkNav02Shahkar", 1)[0]
        self.assertIn("this.db.sessionActor(auth)", route)
        self.assertIn("tto.nav02_member_collections_list($1)", route)
        self.assertLess(route.index("nav02_member_collections_list"), route.index("this.checkNav02Shahkar"))
        self.assertIn("verified:true", route)

    def test_no_bypass_and_registration_rechecks(self):
        self.assertIn('if(!identityVerified||identityChecking)', FORM)
        self.assertIn("!identityVerified||identityChecking||!personalDataConfirmed", FORM)
        self.assertIn("verifiedIdentityKey===currentIdentityKey", FORM)
        self.assertIn("await this.checkNav02Shahkar(", BACKEND)
        self.assertGreaterEqual(BACKEND.count("this.checkNav02Shahkar("), 2)

    def test_preflight_bff_rejects_unauthenticated_and_wrong_origin(self):
        self.assertIn('if(!token||!TOKEN.test(token))', BFF)
        self.assertIn('if(!origin)return fail(403,"ORIGIN_REQUIRED")', BFF)
        self.assertIn("MEMBER_SCOPE_DENIED", BFF)
        self.assertIn("SHAHKAR_MISMATCH", BFF)
        self.assertIn("SHAHKAR_UNAVAILABLE", BFF)
        self.assertNotIn("APIIR_TOKEN", BFF)

    def test_share_inputs_separate_display_and_wire_values(self):
        self.assertIn("function formattedShareNumber", FORM)
        self.assertIn("function cleanShareInput", FORM)
        for k in ("initialShares", "subscribedShares", "nominalRial", "paidRial"):
            self.assertIn("formattedShareNumber(capital."+k+")", FORM)
            self.assertIn("cleanShareInput(e.target.value)", FORM)
        self.assertIn('["متقاضی عضویت","عضو مؤسس","عضو جدید","عضو اولیه"', FORM)

    def test_preflight_return_does_not_issue_membership(self):
        preflight = BACKEND.split('  @Post("commerce/demo/nav02/shahkar-preflight")', 1)[1].split(
            "  private async checkNav02Shahkar", 1)[0]
        for forbidden in ("nav02_member_number_issue", "member_edit_all_fields", "commerce_demo_nav02_register"):
            self.assertNotIn(forbidden, preflight)


if __name__ == "__main__":
    unittest.main()
