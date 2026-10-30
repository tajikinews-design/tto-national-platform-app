import "@tto/ui/styles.css";
import type { ReactNode } from "react";
import "@fontsource-variable/vazirmatn/wght.css";
export const metadata = { title: "TTO — مدیریت تعاونی", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
