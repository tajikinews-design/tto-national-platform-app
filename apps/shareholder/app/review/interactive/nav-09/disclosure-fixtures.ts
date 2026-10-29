/** NAV09: synthetic statutory document review; no source admission or permissions. */
export type Nav09Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT";
export const NAV09_SECTIONS=[
 {id:"TRANSPARENCY",label:"شفافیت شرکت",owner:"CHILD11_TRANSPARENCY"},
 {id:"FINANCIAL",label:"گزارش‌های مالی",owner:"CHILD11_FINANCIAL"},
 {id:"BOARD",label:"گزارش هیئت‌مدیره",owner:"CHILD11_BOARD"},
 {id:"AUDITOR",label:"گزارش بازرس",owner:"CHILD11_AUDITOR"},
 {id:"LEGAL",label:"اسناد قانونی",owner:"CHILD11_LEGAL"},
 {id:"RIGHTS",label:"حقوق و مقررات سهامدار",owner:"CHILD11_MEMBER_RIGHTS"},
 {id:"PRIVACY",label:"سیاست حریم خصوصی",owner:"CHILD22_PRIVACY"},
 {id:"WARNINGS",label:"هشدارهای مهم شرکت",owner:"CHILD09_NOTICE"},
] as const;
export type Nav09Section=typeof NAV09_SECTIONS[number]["id"];
export type Nav09Owner=typeof NAV09_SECTIONS[number]["owner"];
export type Nav09Fixture={id:string;section:Nav09Section;owner:Nav09Owner;title:string;summary:string;status:string;label:string;publication:"DEMO_ONLY";mockOnly:true;authority:false;disclosureApproved:false;documentDownload:false;statementOfficial:false;noticeAck:false;accountingEntry:false};
const DENY={publication:"DEMO_ONLY",mockOnly:true,authority:false,disclosureApproved:false,documentDownload:false,statementOfficial:false,noticeAck:false,accountingEntry:false} as const;
export const NAV09_FIXTURES:readonly Nav09Fixture[]=[
 {id:"DEMO-DISC-001",section:"TRANSPARENCY",owner:"CHILD11_TRANSPARENCY",title:"شفافیت شرکت — نمونه 1",summary:"نسخه آزمایشی معرفی افشا؛ منبع معتبر موجود نیست.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-002",section:"TRANSPARENCY",owner:"CHILD11_TRANSPARENCY",title:"شفافیت شرکت — نمونه 2",summary:"نسخه فرضی فهرست اطلاع‌رسانی مجاز شرکت.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-003",section:"FINANCIAL",owner:"CHILD11_FINANCIAL",title:"گزارش‌های مالی — نمونه 1",summary:"گزارش مالی فرضی؛ رقم و دوره رسمی تأیید نشده است.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-004",section:"FINANCIAL",owner:"CHILD11_FINANCIAL",title:"گزارش‌های مالی — نمونه 2",summary:"صورت‌وضعیت نمایشی؛ پیشنهاد، تصویب و پرداخت یکسان نیستند.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-005",section:"BOARD",owner:"CHILD11_BOARD",title:"گزارش هیئت‌مدیره — نمونه 1",summary:"گزارش عملکرد نمایشی؛ هیچ مصوبه رسمی صادر نشده است.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-006",section:"BOARD",owner:"CHILD11_BOARD",title:"گزارش هیئت‌مدیره — نمونه 2",summary:"نمونه یادداشت هیئت‌مدیره؛ اصالت و نسخه تأیید نشده است.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-007",section:"AUDITOR",owner:"CHILD11_AUDITOR",title:"گزارش بازرس — نمونه 1",summary:"گزارش بازرس ساختگی؛ تأیید بازرس واقعی وجود ندارد.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-008",section:"AUDITOR",owner:"CHILD11_AUDITOR",title:"گزارش بازرس — نمونه 2",summary:"نمونه پیگیری بازرسی؛ هیچ یافته قانونی واقعی اعلام نمی‌شود.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-009",section:"LEGAL",owner:"CHILD11_LEGAL",title:"اسناد قانونی — نمونه 1",summary:"سند حقوقی نمونه؛ مدرک رسمی و اجازه دانلود وجود ندارد.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-010",section:"LEGAL",owner:"CHILD11_LEGAL",title:"اسناد قانونی — نمونه 2",summary:"صورت‌جلسه نمایشی؛ اعتبار ثبت یا امضا ندارد.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-011",section:"RIGHTS",owner:"CHILD11_MEMBER_RIGHTS",title:"حقوق و مقررات سهامدار — نمونه 1",summary:"راهنمای حقوق فرضی؛ جایگزین قانون و اساسنامه نیست.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-012",section:"RIGHTS",owner:"CHILD11_MEMBER_RIGHTS",title:"حقوق و مقررات سهامدار — نمونه 2",summary:"نمونه پرسش‌وپاسخ؛ نظر حقوقی لازم‌الاجرا نیست.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-013",section:"PRIVACY",owner:"CHILD22_PRIVACY",title:"سیاست حریم خصوصی — نمونه 1",summary:"سیاست حریم خصوصی نمونه؛ نسخه و مبنای قانونی احراز نشده‌اند.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-014",section:"PRIVACY",owner:"CHILD22_PRIVACY",title:"سیاست حریم خصوصی — نمونه 2",summary:"دوره نگهداری ساختگی؛ بایگانی برابر حذف نیست.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-015",section:"WARNINGS",owner:"CHILD09_NOTICE",title:"هشدارهای مهم شرکت — نمونه 1",summary:"هشدار شرکت نمونه؛ ارسال پیام برابر مطالعه یا تأیید نیست.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
 {id:"DEMO-DISC-016",section:"WARNINGS",owner:"CHILD09_NOTICE",title:"هشدارهای مهم شرکت — نمونه 2",summary:"اخطار فرضی؛ ابلاغ و تصدیق قانونی انجام نشده است.",status:"منبع و اعتبار: نامعلوم",label:"فقط داده آزمایشی",...DENY},
];
export const NAV09_RELEASE_GATES=[
 "Child11: سند قانونی و مالی نیازمند منبع، دوره، وضعیت و بسته افشای نسخه‌دار است",
 "Child11: پیشنهادی ≠ تصویب‌شده ≠ پرداخت‌شده؛ نامعلوم ≠ صفر",
 "اصلاح گزارش با نسخه جدید و سابقه تغییر؛ بدون دستکاری سند پیشین",
 "پلتفرم حسابداری عمومی، journal posting یا دفترکل مالی داخلی ندارد",
 "مجوز انتشار و طبقه‌بندی سهامدار/عمومی/داخلی با Tenant و نقش ارزیابی می‌شوند",
 "گزارش بازرس فقط‌خواندنی و مستندات محدود محرمانه باقی می‌مانند",
 "CF03: منبع سند، نسخه، شواهد و Audit برای افشای رسمی لازم‌اند",
 "Child20 GRC: خوداظهاری انطباق قانونی به معنی تأیید نیست",
 "Child09: DELIVERED ≠ READ ≠ ACKNOWLEDGED؛ پیام هشدار سند منبع مستقل دارد",
 "Child22: Classification ≠ Authorization و ARCHIVED ≠ DELETED",
 "Child22: Legal Hold نسبت به پاک‌سازی داده اولویت دارد",
 "سیاست حریم خصوصی با مبنای حقوقی، هدف و نسخه مصوب منتشر می‌شود",
 "هیچ سند، PDF، تایید دریافت، پرداخت یا انتشار واقعی در دمو انجام نمی‌شود",
 "پیش از راه‌اندازی، گیت قانونی/دسترسی/امنیت/آزمون Chromium لازم است",
] as const;
