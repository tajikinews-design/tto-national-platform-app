/** NAV08 review-only: fabricated records, no real project/asset/permit/ownership/financial/impact assertion. */
export type Nav08Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT";
export const NAV08_SECTIONS=[
 {id:"PROJECTS",label:"پروژه‌های شرکت",owner:"CHILD12_PROJECT",type:"معرفی پروژه با تأیید انتشار"},
 {id:"PROGRESS",label:"پیشرفت پروژه‌ها",owner:"CHILD12_MILESTONE",type:"پیشرفت مستند و نسخه‌دار"},
 {id:"ASSETS",label:"دارایی‌های قابل افشا",owner:"CHILD12_ASSET",type:"فقط دارایی مجاز به افشا"},
 {id:"INVESTMENTS",label:"سرمایه‌گذاری‌های شرکت",owner:"CHILD12_INVESTMENT",type:"اطلاعات صرفاً با منبع مصوب"},
 {id:"NEW_PROJECTS",label:"پروژه‌های جدید",owner:"CHILD12_PROJECT",type:"پروژه پیشنهادی ≠ تصویب‌شده"},
 {id:"COLLABORATIONS",label:"فرصت‌های همکاری",owner:"CHILD17_COLLABORATION",type:"ابراز علاقه ≠ قرارداد"},
 {id:"JOBS",label:"فرصت‌های شغلی",owner:"CHILD18_OPPORTUNITY",type:"انتشار فرصت با قواعد استخدام"},
 {id:"CSR",label:"برنامه‌های مسئولیت اجتماعی",owner:"CHILD19_IMPACT_PROGRAM",type:"برنامه اجتماعی ≠ نتیجه اثربخش"},
 {id:"IMPACT",label:"اثرگذاری محلی",owner:"CHILD19_IMPACT_CLAIM",type:"ادعای اثر فقط با شواهد و تأیید"},
] as const;
export type Nav08Section=typeof NAV08_SECTIONS[number]["id"];
export type Nav08Owner=typeof NAV08_SECTIONS[number]["owner"];
export type Nav08Fixture={
 id:string;section:Nav08Section;owner:Nav08Owner;title:string;summary:string;status:string;label:string;
 mockOnly:true;publication:"DEMO_ONLY";authority:false;tenantVerified:false;disclosureApproved:false;
 ownershipVerified:false;permitVerified:false;investmentEligible:false;contractAwarded:false;
 employmentApplication:false;impactClaimVerified:false;downloadApproved:false;
};
const DENY={mockOnly:true,publication:"DEMO_ONLY",authority:false,tenantVerified:false,
 disclosureApproved:false,ownershipVerified:false,permitVerified:false,investmentEligible:false,
 contractAwarded:false,employmentApplication:false,impactClaimVerified:false,downloadApproved:false} as const;
export const NAV08_FIXTURES:readonly Nav08Fixture[]=[
 {id:"DEMO-PRJ-001",section:"PROJECTS",owner:"CHILD12_PROJECT",title:"نمونه پروژه زیرساخت محلی",summary:"شرحی کاملاً ساختگی برای چیدمان کارت معرفی پروژه. ثبت در سامانه به معنی مالکیت، قرارداد، مجوز یا شروع عملیات نیست.",status:"مرحله واقعی: نامعلوم",label:"پروژه ساختگی",...DENY},
 {id:"DEMO-PRJ-002",section:"PROJECTS",owner:"CHILD12_PROJECT",title:"نمونه معرفی طرح خدماتی",summary:"برنامه نمایشی بدون سند مالکیت، تأمین مالی، صورت‌جلسه یا مجوز اجرایی معتبر.",status:"پروژه: صرفاً فرضی",label:"طرح نمونه",...DENY},
 {id:"DEMO-PRJ-003",section:"PROGRESS",owner:"CHILD12_MILESTONE",title:"نمونه گزارش مرحله اجرایی",summary:"پیشرفت مرحله صرفاً در صورت وجود شواهد زمان‌دار و تأیید منبع معتبر قابل نمایش است؛ این مورد واقعیت ندارد.",status:"پیشرفت: نامعلوم",label:"Milestone نمونه",...DENY},
 {id:"DEMO-PRJ-004",section:"PROGRESS",owner:"CHILD12_MILESTONE",title:"نمونه گزارش پیشرفت فاز دوم",summary:"تکمیل فعالیت پروژه برابر با نتیجه اجتماعی یا تأیید نهایی پروژه نیست.",status:"تاریخ گزارش: نامعلوم",label:"گزارش فرضی",...DENY},
 {id:"DEMO-PRJ-005",section:"ASSETS",owner:"CHILD12_ASSET",title:"نمونه دارایی قابل انتشار",summary:"وجود رکورد دارایی یا تصویر ملک اثبات مالکیت و مجوز بهره‌برداری نیست.",status:"سند: فاقد اعتبار",label:"دارایی فرضی",...DENY},
 {id:"DEMO-PRJ-006",section:"ASSETS",owner:"CHILD12_ASSET",title:"نمونه معرفی تجهیزات شرکت",summary:"نمایشی برای دسته‌بندی دارایی‌ها؛ ارزش‌گذاری، شماره سند و وضعیت مالکیت واقعی افشا نشده است.",status:"مالکیت: احرازنشده",label:"دارایی فرضی",...DENY},
 {id:"DEMO-PRJ-007",section:"INVESTMENTS",owner:"CHILD12_INVESTMENT",title:"نمونه سرمایه‌گذاری شرکت",summary:"اطلاعات سرمایه‌گذاری برای سهامدار تنها از گزارش مجاز منبع مالی یا افشای مصوب می‌آید؛ نه از موتور حسابداری.",status:"رقم: نامعلوم",label:"سرمایه‌گذاری فرضی",...DENY},
 {id:"DEMO-PRJ-008",section:"INVESTMENTS",owner:"CHILD12_INVESTMENT",title:"نمونه طرح مشارکت سرمایه‌ای",summary:"هیچ بازده تضمین‌شده، امکان سرمایه‌گذاری یا حق مشارکت از این پیش‌نمایش ایجاد نمی‌شود.",status:"بازده: غیرقابل‌استناد",label:"طرح سرمایه‌گذاری نمونه",...DENY},
 {id:"DEMO-PRJ-009",section:"NEW_PROJECTS",owner:"CHILD12_PROJECT",title:"پروژه جدید پیشنهادی نمونه",summary:"پیشنهاد در صف بررسی هیئت‌مدیره فرضی است؛ صرف نمایش عنوان، تصویب قانونی یا مجوز ساخت نیست.",status:"مصوبه: نامعلوم",label:"پیشنهاد فرضی",...DENY},
 {id:"DEMO-PRJ-010",section:"NEW_PROJECTS",owner:"CHILD12_PROJECT",title:"ایده جدید خدمات تعاونی نمونه",summary:"مفهوم اولیه با نیاز به مطالعه امکان‌سنجی و مجوز مستقل؛ نه پروژه آغازشده.",status:"آغاز: تأییدنشده",label:"ایده ساختگی",...DENY},
 {id:"DEMO-PRJ-011",section:"COLLABORATIONS",owner:"CHILD17_COLLABORATION",title:"فرصت فرضی همکاری بین‌تعاونی",summary:"ابراز علاقه به مشارکت قرارداد، مناقصه یا تعهد خرید و تأمین مالی مشترک نیست.",status:"قرارداد: وجود ندارد",label:"همکاری نمونه",...DENY},
 {id:"DEMO-PRJ-012",section:"COLLABORATIONS",owner:"CHILD17_COLLABORATION",title:"نمونه دعوت به معرفی توانمندی",summary:"فراخوان ساختگی برای ارزیابی ظاهر صفحه؛ داده شخصی و پیشنهاد تجاری دریافت نمی‌شود.",status:"دریافت پیشنهاد: غیرفعال",label:"شبکه همکاری نمونه",...DENY},
 {id:"DEMO-PRJ-013",section:"JOBS",owner:"CHILD18_OPPORTUNITY",title:"نمونه فرصت شغلی محلی",summary:"فرصت ساختگی؛ ثبت درخواست، بررسی مدارک و تصمیم استخدام فعال نیست. تصمیم نهایی رد با AI انجام نمی‌شود.",status:"مهلت: تعیین نشده",label:"شغل ساختگی",...DENY},
 {id:"DEMO-PRJ-014",section:"JOBS",owner:"CHILD18_OPPORTUNITY",title:"نمونه همکاری تخصصی پروژه",summary:"قواعد اشتغال با خرید خدمت و مناقصه تفاوت دارد؛ این صفحه وضعیت قانونی را فرض نمی‌کند.",status:"مجوز استخدام: نامعلوم",label:"فرصت شغلی نمونه",...DENY},
 {id:"DEMO-PRJ-015",section:"CSR",owner:"CHILD19_IMPACT_PROGRAM",title:"برنامه فرضی مسئولیت اجتماعی",summary:"برنامه فعالیت اجتماعی هنوز خروجی یا اثر قابل‌سنجش را ثابت نمی‌کند؛ هیچ کمک مالی جمع‌آوری نمی‌شود.",status:"بودجه: نامعلوم",label:"CSR ساختگی",...DENY},
 {id:"DEMO-PRJ-016",section:"CSR",owner:"CHILD19_IMPACT_PROGRAM",title:"نمونه برنامه توسعه مهارت محلی",summary:"گزارش فعالیت نمونه برای UI؛ تعداد بهره‌مندان واقعی یا اندازه‌گیری نتیجه ثبت نشده است.",status:"عملکرد: احرازنشده",label:"برنامه اجتماعی فرضی",...DENY},
 {id:"DEMO-PRJ-017",section:"IMPACT",owner:"CHILD19_IMPACT_CLAIM",title:"نمونه شاخص اثرگذاری محلی",summary:"اندازه‌گیری شاخص، روش، خط‌مبنا و شواهد مستقل لازم دارد؛ پیشرفت پروژه معادل اثر اجتماعی نیست.",status:"شاخص: نامعلوم",label:"اثرگذاری آزمایشی",...DENY},
 {id:"DEMO-PRJ-018",section:"IMPACT",owner:"CHILD19_IMPACT_CLAIM",title:"نمونه ادعای بهبود محلی",summary:"هیچ ادعای اثر اجتماعی، SROI یا آمار جمعیتی واقعی در این نسخه محاسبه یا منتشر نمی‌شود.",status:"نتیجه: تأییدنشده",label:"گزارش اثر ساختگی",...DENY},
];
export const NAV08_RELEASE_GATES=[
 "Child12: پروژه، دارایی، مجوز و قرارداد تنها پس از احراز اصالت منبع و Tenant نمایش داده می‌شوند",
 "وجود رکورد پروژه ≠ مالکیت، حق بهره‌برداری، مجوز یا شروع کار؛ هیچ ادعای حقوقی ساخته نشود",
 "Child12: نسخه‌بندی Milestone و گزارش پیشرفت، شواهد تغییر، مسئول ثبت و اعتبار زمانی",
 "ارقام سرمایه‌گذاری فقط مرجع به منبع رسمی و افشای مصوب، نه سیستم حسابداری عمومی",
 "انتشار اطلاعات مالی، قراردادها و دارایی‌ها فقط Projection مصوب شفافیت با طبقه‌بندی داده",
 "اطلاعات قراردادی و اسناد محدود داخلی افشا نمی‌شوند؛ نمای سهامدار محدود به دسترسی مجاز است",
 "Child17: ابراز علاقه همکاری ≠ توافق حقوقی؛ مناقصه و خرید گروهی نیازمند مرجع قانونی مستقل‌اند",
 "Child18: فرصت شغلی، پروژه‌ای و کسب‌وکار در مسیر متفاوت؛ درخواست واقعی و بررسی متقاضی فعلاً غیرفعال",
 "Child18: حذف خودکار نهایی متقاضی با AI ممنوع؛ دسترسی به درخواست‌ها RESTRICTED و محدود به نقش مجاز",
 "Child19: فعالیت ≠ خروجی ≠ پیامد ≠ اثر؛ پیشرفت پروژه به تنهایی ادعای اثربخشی نمی‌سازد",
 "Child19: اندازه‌گیری با کیفیت/روش/نسخه/شواهد؛ SROI خودکار و ادعای اثربخشی تأییدنشده ممنوع",
 "حفظ اطلاعات بهره‌مندان حساس، طبقه‌بندی، رضایت/مبنای قانونی و حدود انتشار",
 "هیچ کیف پول نقدی، حساب تجمیع وجه، پرداخت یا تضمین سود و بازده ایجاد نمی‌شود",
 "گیت حقوقی مستقل، ایزولاسیون تعاونی، انتشار، امنیت، آزمون واقعی مرورگر و پذیرش طراحی قبل از فعال‌سازی"
] as const;
