import "@tto/ui/styles.css";
import type { ReactNode } from "react";
import { Vazirmatn } from "next/font/google";
const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"], display: "swap", variable: "--tto-font" });
export const metadata = { title: "TTO — مدیریت تعاونی", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="fa" dir="rtl" className={vazirmatn.variable}><body>{children}</body></html>; }
