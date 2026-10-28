/** NAV06: entirely synthetic navigation/visual fixture. Do NOT admit source/entitlement/seat/voucher. */
export type Nav06Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT";
export const NAV06_SECTIONS=[
 {id:"SERVICES",label:"خدمات من",owner:"COOPERATIVE_SERVICE",type:"خدمت مجاز شخصی"},
 {id:"REQUESTS",label:"درخواست‌های من",owner:"SERVICE_REQUEST",type:"درخواست خدمت"},
 {id:"ACADEMY",label:"آکادمی",owner:"CHILD14_ACADEMY",type:"مسیر یادگیری"},
 {id:"MY_COURSES",label:"دوره‌های من",owner:"CHILD14_ACADEMY",type:"سوابق آموزشی شخصی"},
 {id:"EVENTS",label:"رویدادها",owner:"CHILD14_EVENTS",type:"رویداد و ظرفیت"},
 {id:"BOOKINGS",label:"رزروهای من",owner:"CHILD14_EVENTS",type:"رزرو شخصی"},
 {id:"CERTIFICATES",label:"گواهی‌های آموزشی",owner:"CHILD14_ACADEMY",type:"گواهی آموزشی"},
 {id:"BENEFITS",label:"مزایای من",owner:"CHILD15_BENEFITS",type:"استحقاق منفعت غیرنقدی"},
 {id:"VOUCHERS",label:"Voucherها",owner:"CHILD15_BENEFITS",type:"ووچر غیرنقدی"},
 {id:"COMPANY",label:"خدمات شرکت",owner:"COOPERATIVE_SERVICE",type:"فهرست خدمات تعاونی"},
 {id:"CALENDAR",label:"تقویم من",owner:"ACTION_CALENDAR_PROJECTION",type:"نمای تجمیعی رویداد"}
] as const;
export type Nav06Section=typeof NAV06_SECTIONS[number]["id"];
export type Nav06Owner=typeof NAV06_SECTIONS[number]["owner"];
export type Nav06Fixture={
 id:string;section:Nav06Section;owner:Nav06Owner;title:string;summary:string;sampleTime:string;
 sampleState:string;audience:"نمونه اختصاصی"|"نمونه عمومی";
 publication:"DEMO_ONLY";mockOnly:true;authority:false;eligible:false;payment:false;
 reservation:false;certification:false;redeem:false;download:false;
};
const guard={publication:"DEMO_ONLY",mockOnly:true,authority:false,eligible:false,payment:false,
 reservation:false,certification:false,redeem:false,download:false} as const;
export const NAV06_FIXTURES:readonly Nav06Fixture[]=[
 {id:"DEMO-SVC-01",section:"SERVICES",owner:"COOPERATIVE_SERVICE",title:"خدمت آزمایشی مشاوره اعضا",summary:"صرفاً نمایش نمونه نحوه معرفی خدمت. اهلیت یا حق استفاده برای هیچ شخصی احراز نشده است.",sampleTime:"زمان فرضی",sampleState:"واجد شرایط: نامعلوم",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-SVC-02",section:"SERVICES",owner:"COOPERATIVE_SERVICE",title:"راهنمای آزمایشی خدمات سهامداران",summary:"این کارت دفترچه خدمات واقعی شرکت یا فهرست تصویب‌شده تعاونی نیست.",sampleTime:"زمان فرضی",sampleState:"منبع: تأییدنشده",audience:"نمونه عمومی",...guard},
 {id:"DEMO-REQ-01",section:"REQUESTS",owner:"SERVICE_REQUEST",title:"درخواست فرضی استفاده از خدمت",summary:"شماره پرونده و ارجاعی تولید نمی‌شود؛ ثبت و پیگیری واقعی فعال نیست.",sampleTime:"زمان فرضی",sampleState:"در حال بررسی ـ ساختگی",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-ACA-01",section:"ACADEMY",owner:"CHILD14_ACADEMY",title:"مسیر آموزشی نمونه آشنایی با تعاونی",summary:"نمونه یادگیری شامل محتوا، ارزیابی و مسیر تکمیل؛ هیچ دوره واقعی منتشر نشده است.",sampleTime:"زمان فرضی",sampleState:"انتشار: ساختگی",audience:"نمونه عمومی",...guard},
 {id:"DEMO-ACA-02",section:"ACADEMY",owner:"CHILD14_ACADEMY",title:"معرفی آزمایشی مهارت‌های مشارکت",summary:"نمونه نمایش محتوا و مهارت؛ امکان ثبت‌نام و ارزیابی واقعی وجود ندارد.",sampleTime:"زمان فرضی",sampleState:"دسترسی: نامعلوم",audience:"نمونه عمومی",...guard},
 {id:"DEMO-CRS-01",section:"MY_COURSES",owner:"CHILD14_ACADEMY",title:"دوره نمونه مدیریت مشارکتی",summary:"پیشرفت و وضعیت تکمیل صرفاً ساختگی‌اند و نتیجه آموزشی صادر نمی‌کنند.",sampleTime:"زمان فرضی",sampleState:"تکمیل: تأییدنشده",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-EVT-01",section:"EVENTS",owner:"CHILD14_EVENTS",title:"رویداد آزمایشی آشنایی با خدمات",summary:"ظرفیت، فهرست انتظار و حضور فقط توسط مرجع رویداد مدیریت می‌شوند؛ این یک نمونه نمایشی است.",sampleTime:"تاریخ فرضی ۱۴۰۵/۰۸/۲۰",sampleState:"ظرفیت واقعی: نامعلوم",audience:"نمونه عمومی",...guard},
 {id:"DEMO-EVT-02",section:"EVENTS",owner:"CHILD14_EVENTS",title:"نشست نمونه آموزش کاربردی",summary:"هیچ نشستی در واقعیت برنامه‌ریزی یا برای کاربر رزرو نشده است.",sampleTime:"تاریخ فرضی ۱۴۰۵/۰۸/۲۵",sampleState:"ثبت‌نام: غیرفعال",audience:"نمونه عمومی",...guard},
 {id:"DEMO-BOOK-01",section:"BOOKINGS",owner:"CHILD14_EVENTS",title:"رزرو نمونه یک رویداد آموزشی",summary:"شناسه رزرو و ظرفیت قطعی وجود ندارد؛ حضور به معنی تکمیل یادگیری نیست.",sampleTime:"تاریخ فرضی",sampleState:"رزرو: فاقد اعتبار",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-CERT-01",section:"CERTIFICATES",owner:"CHILD14_ACADEMY",title:"گواهی آموزشی صرفاً آزمایشی",summary:"نمونه جایگاه نمایش گواهی؛ نه گواهی صادر شده و نه صلاحیت قانونی یا حرفه‌ای احراز می‌شود.",sampleTime:"بدون تاریخ صدور",sampleState:"صدور: ممنوع در نمونه",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-BEN-01",section:"BENEFITS",owner:"CHILD15_BENEFITS",title:"مزیت آزمایشی ویژه اعضا",summary:"نمایش الگویی از مزایای غیرنقدی؛ تصمیم احراز اهلیت و تخصیص از منبع معتبر نیامده است.",sampleTime:"بدون بازه معتبر",sampleState:"استحقاق: نامعلوم",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-BEN-02",section:"BENEFITS",owner:"CHILD15_BENEFITS",title:"خدمت حمایتی نمونه تعاونی",summary:"این مورد نه سود سهام است و نه دارایی نقدی، قابل انتقال یا قابل برداشت.",sampleTime:"زمان فرضی",sampleState:"تخصیص: انجام نشده",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-VCH-01",section:"VOUCHERS",owner:"CHILD15_BENEFITS",title:"ووچر آزمایشی استفاده از خدمت",summary:"هیچ کد واقعی یا راز شریک تجاری نمایش داده نمی‌شود؛ استفاده مجدد و بازخرید واقعی غیرفعال است.",sampleTime:"بدون تاریخ انقضای معتبر",sampleState:"مصرف: غیرفعال",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-CMP-01",section:"COMPANY",owner:"COOPERATIVE_SERVICE",title:"فهرست نمونه خدمات شرکت",summary:"اطلاعات و شرایط خدمت باید توسط شرکت و مرجع قانونی مجاز تأیید شوند.",sampleTime:"زمان فرضی",sampleState:"انتشار: نامعتبر",audience:"نمونه عمومی",...guard},
 {id:"DEMO-CAL-01",section:"CALENDAR",owner:"ACTION_CALENDAR_PROJECTION",title:"تقویم آموزشی فرضی",summary:"فقط نمایش تجمیعی از رویدادهای نمونه؛ تقویم مالک ظرفیت، رزرو یا الزام قانونی نیست.",sampleTime:"تاریخ فرضی ۱۴۰۵/۰۸/۲۰",sampleState:"نمایش: نمونه",audience:"نمونه اختصاصی",...guard},
 {id:"DEMO-CAL-02",section:"CALENDAR",owner:"ACTION_CALENDAR_PROJECTION",title:"یادآور فرضی درخواست خدمت",summary:"هیچ یادآور پیامکی یا وظیفه حقیقی ایجاد نشده است؛ موعد از دامنه مالک می‌آید.",sampleTime:"تاریخ فرضی ۱۴۰۵/۰۸/۲۲",sampleState:"اعلان: ارسال نشده",audience:"نمونه اختصاصی",...guard}
];
export const NAV06_RELEASE_GATES=[
 "تأیید tenant، نشست سهامدار و عضویت/اهلیت از منابع مستقل سمت سرور",
 "تأیید مرجع رسمی خدمات شرکت و سیاست دسترسی و وضعیت‌های درخواست",
 "تأیید CHILD14 Academy: دوره، ارزیابی، مسیر یادگیری، ثبت تکمیل و صدور گواهی",
 "تأیید CHILD14 Events: ظرفیت/رزرو اتمیک، فهرست انتظار و حضور مستقل از تکمیل دوره",
 "تأیید CHILD15: استحقاق، تخصیص غیرنقدی، ووچر یک‌بارمصرف و محرمانگی کد",
 "ممنوعیت کیف پول نقدی، برداشت موجودی، تبدیل Reward به سود سهام",
 "مجوز مستقل دانلود گواهی و اسناد مطابق CF03 و محرمانگی آموزشی",
 "تقویم من فقط Projection رویدادهای معتبر، نه ایجاد SLA یا رزرو مستقل",
 "آزمون نبود دسترسی cross-tenant و ثبت/مصرف دوباره، race capacity و revocation",
 "آزمون کامل مرورگر/موبایل/دسترس‌پذیری و پذیرش حقوقی قبل از هر عملیات"
] as const;
