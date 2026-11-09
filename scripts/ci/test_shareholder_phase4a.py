"""Phase 4A read-only, authenticated shareholder module routing contracts.

Offline static checks protect invariants; runtime/real E2E approval remains separate.
"""
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
UI=ROOT/"packages/ui/src/shareholder-workspace.tsx"
LOGIN=ROOT/"packages/ui/src/otp-login.tsx"
MODULE=ROOT/"apps/shareholder/app/modules/[id]/page.tsx"
RULES=ROOT/"packages/ui/src/shareholder-section-config.ts"
NAV=ROOT/"packages/ui/src/shareholder-navigation.ts"
INDEX=ROOT/"packages/ui/src/index.tsx"
STYLE=ROOT/"packages/ui/src/styles.css"
SMOKE=ROOT/"scripts/smoke-next-otp.mjs"
PACKET=ROOT/"docs/contracts/shareholder-source-authority-readiness-v1.json"
GATED_IDS={"NAV-04","NAV-06","NAV-07","NAV-08","NAV-09","NAV-10","NAV-11"}

class Phase4A(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui=UI.read_text(encoding="utf-8")
        cls.login=LOGIN.read_text(encoding="utf-8")
        cls.module=MODULE.read_text(encoding="utf-8")
        cls.rules=RULES.read_text(encoding="utf-8")
        cls.nav=NAV.read_text(encoding="utf-8")
        cls.index=INDEX.read_text(encoding="utf-8")
        cls.css=STYLE.read_text(encoding="utf-8")
        cls.smoke=SMOKE.read_text(encoding="utf-8")

    def test_all_seven_remaining_sections_are_explicitly_closed(self):
        for ident in GATED_IDS:
            with self.subTest(section=ident):
                self.assertIn('"'+ident+'":{',self.rules)
        for forbidden in ('"NAV-02":{','"NAV-03":{','"NAV-05":{',
                          'paymentUrl','submitTrade','executeTransfer'):
            self.assertNotIn(forbidden,self.rules)

    def test_canonical_labels_stay_single_source(self):
        self.assertIn('export const shareholderNavigation',self.nav)
        self.assertIn('export {shareholderNavigation} from "./shareholder-navigation"',self.index)
        self.assertNotIn('export const shareholderNavigation = [',self.index)
        self.assertIn('import {shareholderNavigation} from "./shareholder-navigation"',self.ui)
        self.assertIn('shareholderNavigation,',self.index)
        for label in ('مجامع و انتخابات','خدمات من','فروشگاه و فرصت‌ها',
                      'پروژه‌های شرکت','شفافیت و اسناد شرکت','گزارش‌های من',
                      'تنظیمات حساب'):
            self.assertIn(label,self.nav)

    def test_route_gate_is_not_just_anonymous_preview(self):
        self.assertIn('if(!moduleId)notFound()',self.module)
        self.assertIn('shareholderSectionId(moduleId)',self.module)
        self.assertIn('initialSectionId:sectionId',self.module)
        self.assertIn('PortalSessionGate surface="shareholder"',self.module)
        self.assertIn('ShareholderWorkspace',self.module)
        self.assertNotIn('OtpLogin',self.module)
        self.assertIn('سطح',self.rules)
        self.assertIn('بدون استعلام معتبر',self.module)
        self.assertIn('verified?<div>',self.login)
        self.assertIn('initialSectionId={initialShareholderSectionId}',self.login)

    def test_tenant_context_is_required_before_no_data_indication_changes(self):
        for marker in ('section?"section":initialView',
                       'view==="section"&&section&&initialSectionId',
                       'const verified=scope==="verified"',
                       'result.tenantContextVerified!==true',
                       'result.tenantId!==tenantId',
                       'pending.current?.abort()','sequence.current===generation',
                       'credentials:"same-origin"','cache:"no-store"',
                       'حوزه مستقل','فاقد منبع عملیاتی تأییدشده'):
            self.assertIn(marker,self.ui)
        self.assertIn('ایجاد نمی‌کند',self.ui)
        self.assertIn('if(view==="section")return;',self.ui)

    def test_new_sections_contain_no_synthetic_data_or_write_controls(self):
        for invalid in ('fetch(', 'axios(', 'localStorage',
                        'sessionStorage','Authorization','paymentAmount',
                        'userId', 'partyId','wallet','accountBalance',
                        'dangerouslySetInnerHTML'):
            with self.subTest(marker=invalid):
                self.assertNotIn(invalid,self.rules)
        for marker in ('سامانه رسمی رأی‌گیری نیست',
                       'بازارچه کالا و خدمات با بازار نقل‌وانتقال سهام متفاوت است',
                       'سامانه حسابداری عمومی',
                       'این بخش فقط‌خواندنی است',
                       'دانلود سند','پرداخت'):
            self.assertIn(marker,self.rules+self.ui)
        packet=json.loads(PACKET.read_text(encoding="utf-8"))
        self.assertEqual(packet["authorizationState"],"LEGAL_AND_SOURCE_NOT_APPROVED")
        self.assertIs(packet["runtimeActivationSupported"],False)
        self.assertTrue(all(d["decision"]=="BLOCKED" for d in packet["domains"]))

    def test_existing_core_behaviors_and_preview_unmodified(self):
        for marker in ('const [m,h]=await Promise.all',
                       'readEvidence(root+"member-record"',
                       'readEvidence(root+"shareholding"',
                       '<ShareholderReadModels tenantId=', 'ثبت و پیگیری غیرفعال'):
            self.assertIn(marker,self.ui)
        self.assertIn('focus=moduleId',self.module)
        self.assertIn('PortalSessionGate surface="shareholder"',self.module)
        self.assertIn('.sw-closed-section',self.css)
        self.assertIn('@media(max-width:640px)',self.css)
        self.assertIn('authenticated module leaked data or bypassed session gate',self.smoke)

if __name__=="__main__":
    unittest.main()
