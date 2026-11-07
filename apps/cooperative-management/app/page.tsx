import { PortalShell, OtpLogin } from "@tto/ui";
// Availability of the protected API is resolved at runtime, never frozen at build time.
export const dynamic = "force-dynamic";
export default function Home() { return <PortalShell surface="cooperative"><OtpLogin surface="cooperative" enabled={Boolean(process.env.TTO_API_BASE_URL)}/><p style={{padding:16}}><a href="/official-records">ثبت مستندات رسمی هیئت‌مدیره، مدیرعامل و حدود اختیارات</a></p><p style={{padding:"0 16px 16px"}}><a href="/share-market/tariffs">آماده‌سازی تعرفه‌های نقل‌وانتقال سهام برای بررسی مصوبات و پذیرش مستقل (بدون ثبت مالی)</a></p></PortalShell>; }
