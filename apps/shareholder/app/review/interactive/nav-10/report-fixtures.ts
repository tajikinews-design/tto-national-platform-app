/** Canonical NAV10 review fixtures. Every record is fictional, never business evidence. */
export const NAV10_SECTIONS = [
 {id:"SHARES", label:"گزارش سهام من", owner:"CHILD06_CHILD07"},
 {id:"TRADES", label:"تاریخچه معاملات", owner:"CHILD07"},
 {id:"PAYMENTS", label:"سوابق پرداخت", owner:"CHILD05"},
 {id:"ORDERS", label:"خریدهای فروشگاه", owner:"CHILD16"},
 {id:"BENEFITS", label:"مزایای استفاده‌شده", owner:"CHILD15"},
 {id:"LEARNING", label:"دوره‌ها و رویدادها", owner:"CHILD14"},
 {id:"ACTIVITY", label:"فعالیت‌های من", owner:"SOURCE_DOMAIN"},
 {id:"PDF", label:"دریافت گزارش/PDF", owner:"CHILD03_CHILD11_CHILD22"},
] as const;
export type Nav10Section = typeof NAV10_SECTIONS[number]["id"];
export type Nav10Mode = "UNVERIFIED" | "SOURCE_UNAVAILABLE" | "ACCESS_DENIED" | "DEMO_CONTENT";
export type Nav10Fixture = {
 id:string; category:Nav10Section; title:string; summary:string; dateLabel:string; processState:string;
 mockOnly:true; authority:false; sourceVerified:false; officialDocument:false; downloadable:false;
};
const DENY = {mockOnly:true, authority:false, sourceVerified:false, officialDocument:false, downloadable:false} as const;
export const NAV10_FIXTURES: readonly Nav10Fixture[] = [
 {id:"DEMO-RPT-001",category:"SHARES",title:"گزارش عضویت فرضی",summary:"اطلاعات عضویت نمونه؛ هیچ وضعیت عضویت رسمی یا مانده سهم احراز نشده است.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نمونه نمایشی",...DENY},
 {id:"DEMO-RPT-002",category:"SHARES",title:"گزارش سهام فرضی",summary:"مقادیر و دفتر سهام واقعی از منبع معتبر دریافت نشده‌اند.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نامعلوم",...DENY},
 {id:"DEMO-RPT-003",category:"TRADES",title:"درخواست خرید فرضی",summary:"درخواست نمونه؛ ثبت درخواست به معنی انجام معامله نیست.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"در انتظار بررسی (فرضی)",...DENY},
 {id:"DEMO-RPT-004",category:"TRADES",title:"درخواست فروش فرضی",summary:"پرداخت یا تأیید آن به تنهایی انتقال مالکیت سهم نیست.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"ثبت‌شده (فرضی)",...DENY},
 {id:"DEMO-RPT-005",category:"PAYMENTS",title:"اعلام پرداخت فرضی",summary:"PAYMENT_REPORTED به معنای PAYMENT_VERIFIED نیست.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"اعلام‌شده (فرضی)",...DENY},
 {id:"DEMO-RPT-006",category:"PAYMENTS",title:"پیگیری رسید فرضی",summary:"هیچ کیف پول نقدی، مانده قابل برداشت یا تسویه واقعی وجود ندارد.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نامعلوم",...DENY},
 {id:"DEMO-RPT-007",category:"ORDERS",title:"خرید فروشگاهی فرضی",summary:"سفارش کالای نمونه از بازار سهام مجزاست.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"در انتظار (فرضی)",...DENY},
 {id:"DEMO-RPT-008",category:"ORDERS",title:"تحویل سفارش فرضی",summary:"تحویل فرضی، هیچ معامله واقعی را اثبات نمی‌کند.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نمونه نمایشی",...DENY},
 {id:"DEMO-RPT-009",category:"BENEFITS",title:"استفاده از مزیت فرضی",summary:"مزایای نمونه غیرنقدی‌اند و قابل برداشت نیستند.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"استفاده‌شده (فرضی)",...DENY},
 {id:"DEMO-RPT-010",category:"BENEFITS",title:"کوپن فرضی",summary:"کد، اعتبار و بازخرید واقعی وجود ندارد.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نامعلوم",...DENY},
 {id:"DEMO-RPT-011",category:"LEARNING",title:"حضور در رویداد فرضی",summary:"حضور به معنی تکمیل دوره آموزشی نیست.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"حضور (فرضی)",...DENY},
 {id:"DEMO-RPT-012",category:"LEARNING",title:"دوره آموزشی فرضی",summary:"گواهی و صلاحیت حرفه‌ای صادر نشده است.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"در حال بررسی (فرضی)",...DENY},
 {id:"DEMO-RPT-013",category:"ACTIVITY",title:"فعالیت ارتباطی فرضی",summary:"تجمیع واقعی فعالیت‌ها به قرارداد مستقل منابع وابسته است.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نمونه نمایشی",...DENY},
 {id:"DEMO-RPT-014",category:"ACTIVITY",title:"مشارکت فرضی",summary:"مشارکت نمونه، رأی یا مصوبه قانونی ایجاد نمی‌کند.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"نامعلوم",...DENY},
 {id:"DEMO-RPT-015",category:"PDF",title:"فهرست PDF فرضی",summary:"دریافت سند واقعی نیازمند مجوز مستقل فایل و نسخه است.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"دانلود غیرفعال",...DENY},
 {id:"DEMO-RPT-016",category:"PDF",title:"گزارش نمونه بدون فایل",summary:"هیچ PDF رسمی ایجاد، ذخیره، چاپ یا دانلود نمی‌شود.",dateLabel:"نمونه بدون تاریخ رسمی",processState:"دانلود غیرفعال",...DENY},
];
export const NAV10_INVARIANTS = [
 "عضویت با مالکیت سهم یکسان نیست.",
 "PAYMENT_REPORTED ≠ PAYMENT_VERIFIED ≠ BUSINESS_FINALIZED.",
 "خرید فروشگاهی با معامله سهام متفاوت است.",
 "مزایا غیرنقدی و غیرقابل برداشت هستند.",
 "حضور در رویداد با تکمیل آموزش یکسان نیست.",
 "فعالیت واقعی بدون قرارداد منبع تجمیع نمی‌شود.",
 "نمایش گزارش مجوز دریافت سند یا PDF نیست.",
 "منبع نامعلوم به معنای مقدار صفر نیست.",
 "هیچ API، سند رسمی، عملیات مالی یا اطلاعات شخصی واقعی در دمو وجود ندارد."
] as const;
