/** CHILD09 / CHILD10 / CHILD13: synthetic, tenant-free and non-operational.
 * No source, approval, recipient, acknowledgement, ticket or election is real.
 */
export type Nav05Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT";
export const NAV05_SECTIONS=[
 {id:"NEWS",label:"اخبار شرکت",owner:"CHILD09",kind:"خبر قابل انتشار"},
 {id:"NOTICES",label:"اطلاعیه‌ها",owner:"CHILD09",kind:"اطلاعیه"},
 {id:"ASSURED",label:"ابلاغ‌های مهم",owner:"CHILD09",kind:"ابلاغ نیازمند تضمین"},
 {id:"ACK",label:"پیام‌های نیازمند تأیید",owner:"CHILD09",kind:"دریافت مستند"},
 {id:"SURVEYS",label:"نظرسنجی‌ها",owner:"CHILD13",kind:"مشارکت غیرحقوقی"},
 {id:"VOICE",label:"صدای من",owner:"CHILD13",kind:"صدای سهامدار"},
 {id:"PROPOSALS",label:"پیشنهادهای من",owner:"CHILD13",kind:"پیشنهاد"},
 {id:"RESPONSES",label:"پاسخ مدیریت",owner:"CHILD13",kind:"پاسخ مدیریت"},
 {id:"TICKETS",label:"تیکت‌های من",owner:"CHILD10",kind:"درخواست پشتیبانی"},
 {id:"ALERTS",label:"اعلان‌ها",owner:"CF05",kind:"اعلان فنی"}
] as const;
export type SectionId=typeof NAV05_SECTIONS[number]["id"];
export type Nav05Record={
 id:string;section:SectionId;title:string;summary:string;displayDate:string;
 sourceDomain:"CHILD09"|"CHILD10"|"CHILD13"|"CF05";
 audience:"نمونه همگانی"|"نمونه ویژه سهامدار";
 publication:"DEMO_ONLY";version:"DEMO-V1";mockOnly:true;official:false;
 downloadable:false;ackEnabled:false;canSend:false;
};
const common={publication:"DEMO_ONLY",version:"DEMO-V1",mockOnly:true,official:false,
 downloadable:false,ackEnabled:false,canSend:false} as const;
export const NAV05_FIXTURES:readonly Nav05Record[]=[
 {id:"DEMO-NEWS-01",section:"NEWS",title:"گزارش نمونه پیشرفت فعالیت‌های تعاونی",summary:"متن و تاریخ صرفاً برای آزمون انتشار و نمایش خبر طراحی شده است. هیچ فعالیت یا دستاورد واقعی ادعا نمی‌شود.",displayDate:"تاریخ فرضی ۱۴۰۵/۰۸/۰۵",sourceDomain:"CHILD09",audience:"نمونه همگانی",...common},
 {id:"DEMO-NEWS-02",section:"NEWS",title:"رویداد آزمایشی معرفی خدمات سهامداران",summary:"اطلاع‌رسانی تمرینی درباره یک رویداد فرضی؛ ثبت‌نام یا رویداد واقعی وجود ندارد.",displayDate:"تاریخ فرضی ۱۴۰۵/۰۸/۰۶",sourceDomain:"CHILD09",audience:"نمونه همگانی",...common},
 {id:"DEMO-NOTICE-01",section:"NOTICES",title:"اطلاعیه آزمایشی ساعات پاسخ‌گویی",summary:"نمونه متن اطلاعیه غیرحقوقی؛ مرجع انتشار و مخاطبان واقعی تعیین نشده‌اند.",displayDate:"تاریخ فرضی ۱۴۰۵/۰۸/۰۴",sourceDomain:"CHILD09",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-NOTICE-02",section:"NOTICES",title:"اطلاعیه نمونه گزارش دوره‌ای",summary:"اطلاعیه فقط ساختگی است؛ برای اسناد معتبر شرکت باید به NAV-09 و منبع نسخه‌دار ارجاع شود.",displayDate:"تاریخ فرضی ۱۴۰۵/۰۸/۰۲",sourceDomain:"CHILD09",audience:"نمونه همگانی",...common},
 {id:"DEMO-ASSURED-01",section:"ASSURED",title:"نمونه ابلاغ مهم نیازمند تضمین دریافت",summary:"هیچ کمپین ابلاغ قانونی آغاز نشده و recipient snapshot، کانال الزامی یا بسته شواهد تأیید نشده است.",displayDate:"بدون تاریخ ابلاغ واقعی",sourceDomain:"CHILD09",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-ACK-01",section:"ACK",title:"نمونه پیام نیازمند تأیید دریافت",summary:"تحویل، مطالعه و تأیید دریافت سه وضعیت متفاوت‌اند. این کارت قابلیت تأیید واقعی ندارد.",displayDate:"وضعیت حقوقی: نامعلوم",sourceDomain:"CHILD09",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-SURVEY-01",section:"SURVEYS",title:"نظرسنجی نمونه درباره اولویت خدمات",summary:"یک نظرسنجی غیرحقوقی و ساختگی؛ نه رأی مجمع و نه تصمیم قانونی شرکت.",displayDate:"بازه فرضی؛ ثبت پاسخ بسته",sourceDomain:"CHILD13",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-VOICE-01",section:"VOICE",title:"صدای سهامدار ـ فضای فرضی تبادل دیدگاه",summary:"نظر یا مشخصات هیچ سهامدار واقعی ذخیره نمی‌شود. متن آزاد حساس در نسخه عملیاتی نیازمند کنترل است.",displayDate:"بدون مکاتبه واقعی",sourceDomain:"CHILD13",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-PROP-01",section:"PROPOSALS",title:"پیشنهاد نمونه توسعه خدمات دیجیتال",summary:"جایگاه مشاهده پیشنهاد و مرحله پاسخ؛ هیچ پیشنهاد جدیدی ارسال نمی‌شود.",displayDate:"وضعیت فرضی: در دست بررسی",sourceDomain:"CHILD13",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-REPLY-01",section:"RESPONSES",title:"پاسخ تمرینی مدیریت به پیشنهاد",summary:"این متن پاسخ رسمی شرکت نیست؛ پاسخ باید از مرجع دارای اختیار و نسخه معتبر دریافت شود.",displayDate:"تاریخ فرضی پاسخ",sourceDomain:"CHILD13",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-TICKET-01",section:"TICKETS",title:"پیگیری نمونه درخواست اطلاعات سهامداری",summary:"پرونده پشتیبانی فرضی با گردش‌کار نمایشی؛ بدون شماره پیگیری معتبر یا SLA تأییدشده.",displayDate:"وضعیت نمونه: در حال بررسی",sourceDomain:"CHILD10",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-TICKET-02",section:"TICKETS",title:"مکاتبه فرضی با واحد پاسخ‌گویی",summary:"گفت‌وگوی نمونه برای بررسی چینش تاریخچه؛ امکان ارسال، پاسخ یا پیوست واقعی وجود ندارد.",displayDate:"وضعیت نمونه: پاسخ داده‌شده",sourceDomain:"CHILD10",audience:"نمونه ویژه سهامدار",...common},
 {id:"DEMO-ALERT-01",section:"ALERTS",title:"اعلان تمرینی انتشار اطلاعیه",summary:"اعلان فرضی به معنی تحویل، مطالعه یا تأیید دریافت نیست؛ SMS/Email/Push واقعی ارسال نمی‌شود.",displayDate:"بدون رویداد ارسالی",sourceDomain:"CF05",audience:"نمونه ویژه سهامدار",...common}
];
export const NAV05_RELEASE_GATES=[
 "تأیید ناشر و مرجع مالک محتوا، نسخه و وضعیت انتشار در CHILD09",
 "تعیین مخاطبان، طبقه‌بندی و محدوده تعاونی به‌صورت سمت سرور",
 "تفکیک ابلاغ حقوقی از خبر و اطلاعیه معمولی با Notice Assurance و Evidence",
 "تکمیل اعتبارسنجی هویت، نشست و دریافت فقط رکورد خود سهامدار",
 "تأیید قرارداد CHILD10 برای تیکت، SLA، ارجاع و سوابق محرمانه",
 "تأیید قرارداد CHILD13 برای نظرسنجی غیرحقوقی و پیشنهادها",
 "مجوز مستقل CF03 برای مشاهده یا دانلود هر فایل و پیوست",
 "اتصال CF05 فقط بعد از سیاست‌های کانال، رضایت و آزمون‌های ارسال",
 "کنترل sourceVersion، recipient snapshot، idempotency و revoke",
 "اجرای آزمون cross-tenant، دسترس‌پذیری، ممیزی و بازبینی حقوقی"
] as const;
