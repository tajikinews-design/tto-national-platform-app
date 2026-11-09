import "@tto/ui/styles.css";
import "@tto/ui/control-system.css";
import "./management-settings.css";
import "./member-intake.css";
import type { ReactNode } from "react";
import localFont from "next/font/local";
// Pinned Vazirmatn v33.003, OFL-1.1; identical shared local asset across all 3 portals.
// No Google Fonts request at build or runtime. Keep --tto-font and typography stable.
const vazirmatn = localFont({
  src: "../../../packages/ui/assets/Vazirmatn[wght].woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--tto-font"
});
export const metadata = { title: "TTO — مدیریت تعاونی", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="fa" dir="rtl" className={vazirmatn.variable}><body>{children}</body></html>; }
