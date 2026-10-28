"""Approved NAV04 visual-shell invariants; synthetic-only and non-operational."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
NAV = ROOT / "apps/shareholder/app/review/interactive/nav-04"
UI = (NAV / "synthetic-assemblies.tsx").read_text(encoding="utf-8")
CSS = (NAV / "assemblies.css").read_text(encoding="utf-8")
FIX = (NAV / "assembly-fixtures.ts").read_text(encoding="utf-8")

class ApprovedNav04Visual(unittest.TestCase):
    def test_approved_page_regions(self):
        for marker in (
            "ReviewSidebar", "ReviewTopbar", "ApprovedVisualOverview",
            "w1a-next-meeting", "w1a-kpi-row", "w1a-four-panels",
            "w1a-actions-row", "w1a-global-header", "w1a-meeting-info",
            "مجامع پیش‌رو", "انتخابات فعال", "اقدامات موردنیاز من",
            "اسناد و مصوبات جدید", "آخرین اطلاعیه‌ها", "مجامع و انتخابات",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, UI + CSS)

    def test_eleven_navigation_roots_kept(self):
        for label in (
            "داشبورد", "سهام و عضویت من", "خرید و فروش سهام",
            "مجامع و انتخابات", "اخبار و ارتباط با شرکت", "خدمات من",
            "فروشگاه و فرصت‌ها", "پروژه‌های شرکت",
            "شفافیت و اسناد شرکت", "گزارش‌های من", "تنظیمات حساب",
        ):
            self.assertIn(label, UI)
        self.assertIn('href?', UI)
        self.assertIn('w1a-not-linked', UI)

    def test_only_explicit_demo_renders_approved_fixture_overview(self):
        self.assertIn('useState<DemoSourceState>("UNVERIFIED")', UI)
        self.assertIn('const fake=mode==="DEMO_CONTENT"', UI)
        self.assertIn('{fake?<ApprovedVisualOverview/>:', UI)
        self.assertIn('{fake?<div className="w1a-content">', UI)
        self.assertIn('legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false', FIX)
        self.assertIn('انتشار رسمی نشده', UI)
        self.assertIn('بدون اتصال عملیاتی', UI)

    def test_no_operational_authority_or_uploads(self):
        for prohibited in (
            'fetch(', 'axios', 'XMLHttpRequest', 'WebSocket(', 'localStorage',
            'sessionStorage', 'document.cookie', '<form', 'type="submit"',
            'dangerouslySetInnerHTML', '/api/', 'method="POST"',
        ):
            with self.subTest(prohibited=prohibited):
                self.assertNotIn(prohibited, UI)
        for blocked in ("ثبت رأی (غیرفعال)", "تأیید حضور (غیرفعال)", "انتشار نتیجه (غیرفعال)"):
            self.assertIn(blocked, UI)

    def test_nav03_preview_css_has_no_literal_newline_escape(self):
        # A literal backslash-n appended to a stylesheet breaks Turbopack/PostCSS.
        css = (ROOT / "apps/shareholder/app/review/interactive/nav-03/case-demo/case.css").read_text(encoding="utf-8")
        self.assertNotIn(chr(92) + "n", css)
        self.assertEqual(css.count("{"), css.count("}"))

    def test_approved_meeting_photo_and_full_size_browser_capture(self):
        photo = ROOT / "apps/shareholder/public/nav04-approved-meeting-demo.webp"
        self.assertTrue(photo.is_file())
        self.assertGreater(photo.stat().st_size, 6000)
        self.assertIn('/nav04-approved-meeting-demo.webp', UI)
        for token in (
            'w1a-cooperative-switch', 'w1a-meeting-controls',
            'w1a-attendance-state', 'PREVIEW_DOC_ROWS',
            'PREVIEW_NOTICE_ROWS', 'اعلام حضور (غیرفعال)',
            'حضور احراز نشده', 'دعوت‌نامه تأیید نشده'
        ):
            self.assertIn(token, UI)
        browser = (ROOT / "scripts/e2e-shareholder-nav04-review.cjs").read_text(encoding="utf-8")
        self.assertIn('verify(1536,1024,false)', browser)
        self.assertIn('fullPage:width===1536', browser)
        self.assertIn('APPROVED_MEETING_PHOTO_LOADED_', browser)
        self.assertIn('UNVERIFIED_ATTENDANCE_CANNOT_SUBMIT_', browser)

    def test_diagnostics_are_collapsed_without_dropping_legal_gates(self):
        self.assertIn('useState(false)', UI)
        self.assertIn('id="w1a-review-detail-panels"', UI)
        self.assertIn('hidden={!showReviewDetails}', UI)
        self.assertIn('aria-expanded={showReviewDetails}', UI)
        self.assertIn('ابزار بررسی توسعه‌دهنده', UI)
        self.assertIn('w1a-review-detail-panels[hidden]', CSS)
        self.assertIn('REFERENCE_REVIEW_GATES.map', UI)
        browser = (ROOT / "scripts/e2e-shareholder-nav04-review.cjs").read_text(encoding="utf-8")
        for token in (
            'REVIEW_DIAGNOSTICS_HIDDEN_BY_DEFAULT_',
            'REVIEW_DIAGNOSTICS_OPEN_ON_REQUEST_',
            'APPROVED_SCREENSHOT_NO_DEBUG_PANELS',
            'APPROVED_OVERVIEW_COMPACT_HEIGHT',
        ):
            self.assertIn(token, browser)

    def test_responsive_and_anchors(self):
        for token in (
            ".w1a-frame", ".w1a-sidebar", ".w1a-approved-overview",
            ".w1a-four-panels", "@media(max-width:980px)",
            "@media(max-width:680px)", "grid-template-columns:1fr"
        ):
            self.assertIn(token, CSS)
        self.assertIn('id="w1a-records"', UI)
        self.assertIn('href="#w1a-records"', UI)

if __name__ == "__main__":
    unittest.main()
