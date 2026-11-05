"""PH03 three-portal structural contracts; runtime browser/DB tests required separately."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
UI=ROOT/"packages"/"ui"/"src"
APPS=ROOT/"apps"
SURFACES={"shareholder":"shareholder","cooperative-management":"cooperative","national-admin":"national"}

class ThreePortalBoundary(unittest.TestCase):
    def test_11_source_navigation_slots_and_protected_module_routes(self):
        shell=(UI/"index.tsx").read_text(encoding="utf-8")
        self.assertIn("NAV_IDS = Array.from({ length: 11 }",shell)
        self.assertIn('parsePortalModuleId',shell)
        self.assertIn('href="#main-content"',shell)
        self.assertIn('aria-current={selection === i ? "page" : undefined}',shell)
        for app,surface in SURFACES.items():
            mod=(APPS/app/"app/modules/[id]/page.tsx").read_text(encoding="utf-8")
            self.assertIn("parsePortalModuleId(id)",mod)
            self.assertIn("if(!moduleId)notFound();",mod)
            self.assertIn('export const dynamic = "force-dynamic"',mod)
            self.assertIn('surface="'+surface+'"',mod)

    def test_all_three_pages_use_server_authorized_session_not_url_role(self):
        login=(UI/"otp-login.tsx").read_text(encoding="utf-8")
        self.assertIn('if(!enabled||!verified)return;',login)
        self.assertNotIn('surface!=="shareholder"',login)
        self.assertIn('method:"GET",credentials:"same-origin",cache:"no-store"',login)
        self.assertIn('if((data as {authenticated:boolean}).authenticated!==true)invalidateSession();',login)
        for app,surface in SURFACES.items():
            home=(APPS/app/"app/page.tsx").read_text(encoding="utf-8")
            if app == "national-admin":
                # The national root uses a separately verified credential flow.
                # Preserve independent server validation, forced rotation, and OTP deny.
                self.assertIn("import NationalRootLogin",home)
                self.assertIn("<NationalRootLogin/>",home)
                self.assertNotIn('OtpLogin surface="national"',home)
                root_login=(APPS/app/"app/national-root-login.tsx").read_text(encoding="utf-8")
                self.assertIn('fetch("/api/auth/session"',root_login)
                self.assertIn('x.authenticated===true&&x.nationalRoot===true',root_login)
                self.assertIn('x.mustChangeCredentials===true',root_login)
                self.assertIn('phase==="unavailable"',root_login)
                self.assertIn('fetch("/api/national-login"',root_login)
                password_bff=(APPS/app/"app/api/national-login/route.ts").read_text(encoding="utf-8")
                self.assertIn('ORIGIN_REQUIRED',password_bff)
                self.assertIn('httpOnly:true',password_bff)
                self.assertIn('"/v1/national/root/login"',password_bff)
                for action in ("request","verify"):
                    otp_bff=(APPS/app/f"app/api/auth/otp/{action}/route.ts").read_text(encoding="utf-8")
                    self.assertIn('NATIONAL_ROOT_CREDENTIALS_ONLY',otp_bff)
                    self.assertIn("status:403",otp_bff)
            else:
                self.assertIn('OtpLogin surface="'+surface+'"',home)
            bff=(APPS/app/"app/api/auth/session/route.ts").read_text(encoding="utf-8")
            self.assertIn('request.cookies.get("tto_session")',bff)
            self.assertIn("httpOnly:true",bff)
            self.assertIn('"Cache-Control":"no-store, private"',bff)
            self.assertIn('SESSION_CHECK_UNAVAILABLE',bff)

    def test_management_modules_require_authentication_and_restrict_scope(self):
        picker=(UI/"tenant-scope-picker.tsx").read_text(encoding="utf-8")
        login=(UI/"otp-login.tsx").read_text(encoding="utf-8")
        self.assertIn('moduleId?:string',picker)
        self.assertIn('initialManagementModuleId?:string',login)
        self.assertIn('moduleId={initialManagementModuleId}',login)
        self.assertIn('setScopeVerified(false)',picker)
        self.assertIn('document.addEventListener("visibilitychange",onVisible)',picker)
        self.assertIn('window.setTimeout(expire,60000)',picker)
        self.assertIn('current.evidenceStatus!=="ROLE_AUTHORITY_EVIDENCE"',picker)
        self.assertIn('current.evidenceStatus!=="JIT_DOCUMENT_REVIEW_ONLY"',picker)
        self.assertIn('محدوده بررسی شد؛ عملیات ماژول فعال نیست',picker)
        for app in ("cooperative-management","national-admin"):
            mod=(APPS/app/"app/modules/[id]/page.tsx").read_text(encoding="utf-8")
            self.assertIn('initialManagementModuleId={moduleId}',mod)
            self.assertIn('OtpLogin',mod)
            self.assertNotIn('PortalModulePreview',mod)

    def test_accessibility_keyboard_rtl_and_readable_action_controls(self):
        css=(UI/"styles.css").read_text(encoding="utf-8")
        shell=(UI/"index.tsx").read_text(encoding="utf-8")
        self.assertIn('className="skip-to-content"',shell)
        self.assertIn('id="main-content"',shell)
        self.assertIn('aria-label={"منوی اصلی "+cfg.title}',shell)
        for rule in (".skip-to-content:focus",".tenant-picker button:disabled",
                     ".tenant-picker :is(select,button):focus-visible","@media (max-width:780px)"):
            self.assertIn(rule,css)
        for app in SURFACES:
            layout=(APPS/app/"app/layout.tsx").read_text(encoding="utf-8")
            self.assertIn('lang="fa" dir="rtl"',layout)
            self.assertIn('index: false, follow: false',layout)

    def test_no_synthetic_data_as_authoritative_management_balance(self):
        for app in ("cooperative-management","national-admin"):
            mod=(APPS/app/"app/modules/[id]/page.tsx").read_text(encoding="utf-8")
            self.assertNotIn("Math.random",mod)
            self.assertNotIn("fetch(",mod)
            self.assertNotIn("shareQuantity:",mod)
            self.assertNotIn("walletBalance",mod)
            self.assertIn("فعال می‌شوند",mod)
        scope=(UI/"tenant-scope-picker.tsx").read_text(encoding="utf-8")
        self.assertIn('credentials:"same-origin",cache:"no-store"',scope)

    def test_domain_and_real_trade_approval_remains_separate(self):
        contract=(ROOT/"docs/architecture/TTO_PH01_PH02_OWNER_ACCEPTED_DESIGN_EXIT.json").read_text(encoding="utf-8")
        self.assertIn('source_155_acceptance',contract)
        self.assertIn('source_148_physical_contracts',contract)
        self.assertIn('"production_release": "BLOCKED"',contract)

if __name__=="__main__":
    unittest.main()
