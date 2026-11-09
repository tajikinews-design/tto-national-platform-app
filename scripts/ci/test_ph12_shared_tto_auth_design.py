"""Regression contracts for consistent three-role TTO authentication UI.

The shared design must not accidentally bypass any role-specific identity flow.
"""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

class SharedTtoAuthenticationUi(unittest.TestCase):
    def test_all_three_portals_have_same_frame(self):
        pages = [
            "apps/national-admin/app/login/page.tsx",
            "apps/cooperative-management/app/login/page.tsx",
            "apps/shareholder/app/login/page.tsx",
            "apps/cooperative-management/app/customer-register/page.tsx",
        ]
        for page in pages:
            with self.subTest(page=page):
                contents=source(page)
                self.assertIn("AuthFrame",contents)
                self.assertIn('surface=',contents)
        frame=source("packages/ui/src/auth-frame.tsx")
        self.assertIn('type AuthSurface="national"|"cooperative"|"shareholder"',frame)
        self.assertIn("children:ReactNode",frame)
        self.assertIn('data-tto-auth-surface={surface}',frame)
        self.assertIn('lang="fa" dir="rtl"',frame)

    def test_auth_does_not_lose_security_boundaries(self):
        national=source("apps/national-admin/app/national-root-login.tsx")
        cooperative=source("packages/ui/src/portal-password-login.tsx")
        self.assertIn('/api/national-login',national)
        self.assertIn('/api/national-change-credentials',national)
        self.assertIn('rememberDevice',national)
        self.assertIn('disabled title="OTP مدیر ملی',national)
        self.assertIn('/api/auth/password/login',cooperative)
        self.assertIn('OtpLogin enabled={true} surface={surface}',cooperative)
        self.assertIn('workspaceSlug',cooperative)

    def test_otp_timer_and_signup(self):
        otp=source("packages/ui/src/otp-login.tsx")
        signup=source("apps/cooperative-management/app/customer-register/page.tsx")
        self.assertIn('expiresInSeconds',otp)
        self.assertIn('remainingSeconds<=0',otp)
        self.assertIn('maxLength={6} pattern="[0-9]{6}"',otp)
        self.assertIn('role="timer"',otp)
        self.assertIn('/api/commerce/register',signup)
        self.assertIn('Date.now()',signup)
        self.assertIn('remaining<=0',signup)

    def test_responsive_shared_styles(self):
        css=source("packages/ui/src/styles.css")
        self.assertIn(".tto-auth-page",css)
        self.assertIn(".tto-auth-layout",css)
        self.assertIn(".tto-auth-method-tabs",css)
        self.assertIn("width:min(870px,100%)",css)
        self.assertIn("min-height:min(615px,calc(100svh - 44px))",css)
        self.assertIn("place-items:center",css)
        self.assertIn("@media (min-width:681px) and (max-height:720px)",css)
        self.assertIn("@media(max-width:680px)",css)
        self.assertIn("@media(prefers-reduced-motion:reduce)",css)

    def test_checkout_reuses_compact_branding_without_changing_payment_contract(self):
        frame=source("packages/ui/src/auth-frame.tsx")
        order=source("apps/cooperative-management/app/subscribe/page.tsx")
        backend=source("apps/cooperative-management/app/api/commerce/route.ts")
        css=source("packages/ui/src/styles.css")
        self.assertIn('export type AuthMode="login"|"register"|"order"',frame)
        self.assertIn('mode="order"',order)
        self.assertIn('AuthFrame',order)
        self.assertIn('type Step="details"|"confirm"|"done"',order)
        for label in ("نام دلخواه تعاونی نمونه","پلن آزمایشی",
                      "ساخت خودکار و یکتا پس از تأیید","ایجاد فضای آزمایشی"):
            self.assertIn(label,order)
        self.assertNotIn('id="order-slug"',order)
        self.assertNotIn('id="order-mobile"',order)
        self.assertNotIn('id="order-amount"',order)
        for guard in ("/api/commerce","response.status===409",
                      'response.status===401','response.status===403',
                      'data.tenantActivated!==true'):
            self.assertIn(guard,order)
        for boundary in ("پرداخت واقعی غیرفعال","وجهی دریافت نمی‌شود",
                         "managerRoleGranted!==false","DEMO_AMOUNT_ATTESTED"):
            self.assertTrue(boundary in frame or boundary in order or boundary in backend)
        self.assertIn(".tto-checkout-progress",css)
        self.assertIn(".tto-checkout-domain",css)
        self.assertIn(".tto-checkout-warning",css)

if __name__=="__main__":
    unittest.main()
