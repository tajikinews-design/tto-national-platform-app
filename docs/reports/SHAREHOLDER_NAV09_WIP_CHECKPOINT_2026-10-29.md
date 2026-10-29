# NAV09 shareholder — work-in-progress checkpoint

Date: 2026-10-29
Base: NAV08 Draft PR54, SHA 15127083fe5e734c1229d4ba33f83a35c8170158.
Branch: feat/shareholder-nav09-transparency-documents-synthetic-20261029.

## Locked scope
8 navigation entries: شفافیت شرکت، گزارش‌های مالی، گزارش هیئت‌مدیره، گزارش بازرس، اسناد قانونی، حقوق و مقررات سهامدار، سیاست حریم خصوصی، هشدارهای مهم شرکت.
Child 11 owns legal/statutory/financial shareholder disclosure; Child09 owns notices; Child22 governs privacy/retention; Child20 is source of restricted GRC evidence. No general accounting, document authority inference, auto-ACK, or unauthorized publication.

## Delivered so far
New NAV09 fixture (16 fabricated records), page, CSS, inherited sidebar/header, eight-section navigation, default UNVERIFIED, opt-in demonstration. Dedicated Chromium test file added but not integrated in release yet. Previous root routes partially linked.

## Blockers / remaining exact steps
- Replace legacy NAV08 copy in NAV09 review component (at minimum company project phrasing in explanatory body and disclaimer).
- Verify and repair all sibling NAV09 route links and dashboard link.
- Register NAV09 files in TSX parser, anonymous Next SSR smoke test and mandatory private Chromium Docker Release.
- Add focused offline Python architecture tests; adapt exact SHA screenshot ZIP PowerShell wrapper; run hosted and local gates.
- Inspect five actual screenshots against NAV08 and accepted common shell.
- Product-owner acceptance separate. No merge, deployment, or real financial/legal document activation.

Status: WIP / NOT VERIFIED / NO RELEASE.
