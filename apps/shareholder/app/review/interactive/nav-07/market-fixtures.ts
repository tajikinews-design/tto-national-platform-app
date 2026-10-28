/** NAV07 W1 synthetic fixture: never read source records or infer seller, order, settlement or opportunity rights. */
export type Nav07Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT";
export const NAV07_SECTIONS=[
 {id:"STORE",label:"فروشگاه",owner:"CHILD16_MARKETPLACE",type:"کاتالوگ نمایشی کالا و خدمت"},
 {id:"COOP_PRODUCTS",label:"محصولات شرکت",owner:"CHILD16_MARKETPLACE",type:"محصولات تعاونی"},
 {id:"NATIONAL",label:"بازار ملی سهامداران",owner:"CHILD16_MARKETPLACE",type:"بازار ملی کالاوخدمت؛ نه سهام"},
 {id:"OTHER_COOPS",label:"محصولات سایر تعاونی‌ها",owner:"CHILD16_MARKETPLACE",type:"عرضه تعاونی‌های دیگر"},
 {id:"SPECIAL",label:"پیشنهادهای ویژه",owner:"CHILD16_MARKETPLACE_ADS",type:"پیشنهاد و تبلیغ برچسب‌دار"},
 {id:"MY_ORDERS",label:"سفارش‌های من",owner:"CHILD16_ORDER",type:"سفارش شخصی؛ فقط پس از احراز"},
 {id:"PAY_ORDER",label:"پرداخت سفارش",owner:"CF05_PAYMENT_CH16",type:"پرداخت سفارش؛ فاقد مجوز عملیاتی"},
 {id:"DELIVERY",label:"وضعیت تحویل",owner:"CHILD16_FULFILLMENT",type:"ارسال/تحویل سفارش"},
 {id:"SUGGEST",label:"معرفی محصول من",owner:"CHILD16_SUPPLIER_PROPOSAL",type:"پیشنهاد تأمین‌کننده؛ نه عرضه فروش"},
 {id:"OPPORTUNITIES",label:"فرصت‌های کسب‌وکار",owner:"CHILD18_OPPORTUNITIES",type:"معرفی فرصت و درخواست محدود"}
] as const;
export type Nav07Section=typeof NAV07_SECTIONS[number]["id"];
export type Nav07Owner=typeof NAV07_SECTIONS[number]["owner"];
export type Nav07Fixture={
 id:string;section:Nav07Section;owner:Nav07Owner;title:string;summary:string;
 syntheticMeta:string;status:string;label:string;
 publication:"DEMO_ONLY";mockOnly:true;authority:false;tenantVerified:false;eligible:false;
 offerLive:false;orderLive:false;paymentLive:false;fulfillmentLive:false;
 proposalApproved:false;opportunityApplication:false;
};
const deny={publication:"DEMO_ONLY",mockOnly:true,authority:false,tenantVerified:false,eligible:false,
 offerLive:false,orderLive:false,paymentLive:false,fulfillmentLive:false,
 proposalApproved:false,opportunityApplication:false} as const;
export const NAV07_FIXTURES:readonly Nav07Fixture[]=[
 {id:"DEMO-MKT-001",section:"STORE",owner:"CHILD16_MARKETPLACE",title:"فهرست نمونه محصولات تعاونی",summary:"نمونه چیدمان کاتالوگ؛ قیمت، موجودی، فروشنده، امکان خرید و اعتبار عرضه تأیید نشده است.",syntheticMeta:"قیمت: نامعلوم",status:"دسترسی: ساختگی",label:"فقط نمایش آزمایشی",...deny},
 {id:"DEMO-MKT-002",section:"STORE",owner:"CHILD16_MARKETPLACE",title:"نمونه معرفی خدمات تعاونی",summary:"وجود کارت خدمت به معنی امکان سفارش یا تأیید کیفیت ارائه‌دهنده نیست.",syntheticMeta:"موجودی: نامعلوم",status:"انتشار واقعی: غیرفعال",label:"فقط نمایش آزمایشی",...deny},
 {id:"DEMO-COOP-001",section:"COOP_PRODUCTS",owner:"CHILD16_MARKETPLACE",title:"کالای فرضی تولید تعاونی شهرستانی",summary:"برای نمایش نمونه رابط محصولات خود تعاونی؛ هیچ کالا، قیمت یا فروشنده‌ای وارد سامانه نشده است.",syntheticMeta:"قیمت: نامعلوم",status:"مجوز عرضه: تأییدنشده",label:"محصول نمونه",...deny},
 {id:"DEMO-NAT-001",section:"NATIONAL",owner:"CHILD16_MARKETPLACE",title:"نمای فرضی بازار ملی کالا و خدمات",summary:"بازار ملی سهامداران در این بخش به معنی مبادله سهام یا جابه‌جایی مالکیت نیست.",syntheticMeta:"عرضه‌کننده: تأییدنشده",status:"عرضه واقعی: غیرفعال",label:"کالا و خدمات، نه سهام",...deny},
 {id:"DEMO-OTHER-001",section:"OTHER_COOPS",owner:"CHILD16_MARKETPLACE",title:"محصول نمونه تعاونی دیگر",summary:"نمایش بین‌تعاونی صرفاً در سطح اطلاعات عمومی تأییدشده مجاز خواهد بود؛ این نمونه واقعی نیست.",syntheticMeta:"تعاونی: فرضی",status:"اهلیت فروشنده: نامعلوم",label:"عرضه آزمایشی",...deny},
 {id:"DEMO-AD-001",section:"SPECIAL",owner:"CHILD16_MARKETPLACE_ADS",title:"پیشنهاد تبلیغاتی نمونه",summary:"محتوای حامی‌شده باید آشکارا با اطلاعیه رسمی شرکت فرق داشته باشد و از ممیزی تبلیغ عبور کند.",syntheticMeta:"حامی: ساختگی",status:"تبلیغ منتشر نشده",label:"تبلیغ · صرفاً نمونه",...deny},
 {id:"DEMO-AD-002",section:"SPECIAL",owner:"CHILD16_MARKETPLACE_ADS",title:"پیشنهاد ویژه فرضی کالا",summary:"نه تخفیف قطعی است و نه موجودی/قیمت معتبر دارد؛ هدف‌گیری سیاسی یا حساس ممنوع است.",syntheticMeta:"تخفیف: نامعلوم",status:"تأیید کمپین: نامعلوم",label:"پیشنهاد تبلیغاتی نمونه",...deny},
 {id:"DEMO-ORD-001",section:"MY_ORDERS",owner:"CHILD16_ORDER",title:"سفارش فرضی یک محصول",summary:"شناسه و وضعیت سفارش ساختگی است؛ تراکنش، مالکیت یا حق تحویل واقعی ایجاد نمی‌کند.",syntheticMeta:"شماره واقعی: وجود ندارد",status:"وضعیت سفارش: نامعلوم",label:"سفارش ساختگی",...deny},
 {id:"DEMO-ORD-002",section:"MY_ORDERS",owner:"CHILD16_ORDER",title:"سفارش آزمایشی خدمات",summary:"Snapshot قیمت و شرایط در اجرای واقعی متعلق به سفارش ثبت‌شده و تغییرناپذیر خواهد بود.",syntheticMeta:"مبلغ: نامعلوم",status:"سفارش واقعی: ثبت نشده",label:"سفارش ساختگی",...deny},
 {id:"DEMO-PAY-001",section:"PAY_ORDER",owner:"CF05_PAYMENT_CH16",title:"مرحله نمایشی پرداخت سفارش",summary:"پرداخت سفارش به پذیرنده تأییدشده متصل می‌شود؛ پرداخت گزارش‌شده یا Callback به‌تنهایی تحویل قطعی یا تسویه نیست.",syntheticMeta:"درگاه: متصل نیست",status:"پرداخت: غیرفعال",label:"پرداخت ممنوع در پیش‌نمایش",...deny},
 {id:"DEMO-DEL-001",section:"DELIVERY",owner:"CHILD16_FULFILLMENT",title:"رهگیری فرضی تحویل کالا",summary:"هیچ مرسوله، نشانی شخصی، کد رهگیری یا تحویل واقعی در این صفحه وجود ندارد.",syntheticMeta:"زمان: نامعلوم",status:"تحویل واقعی: نامعلوم",label:"نمایش ساختگی",...deny},
 {id:"DEMO-SUP-001",section:"SUGGEST",owner:"CHILD16_SUPPLIER_PROPOSAL",title:"معرفی نمونه محصول توسط عضو",summary:"پیشنهاد تأمین محصول به بررسی تعاونی نیاز دارد؛ ثبت پیشنهاد مساوی با ایجاد Offer فروشنده نیست.",syntheticMeta:"بررسی: انجام نشده",status:"مجوز فروشندگی: ندارد",label:"پیشنهاد ≠ عرضه",...deny},
 {id:"DEMO-SUP-002",section:"SUGGEST",owner:"CHILD16_SUPPLIER_PROPOSAL",title:"نمونه درخواست معرفی تولیدکننده",summary:"هیچ قرارداد فروش یا انتشار خودکار محصول از روی معرفی کاربر ایجاد نمی‌شود.",syntheticMeta:"شناسه: فرضی",status:"نتیجه: نامعلوم",label:"پیشنهاد بررسی‌نشده",...deny},
 {id:"DEMO-OPP-001",section:"OPPORTUNITIES",owner:"CHILD18_OPPORTUNITIES",title:"فرصت همکاری اقتصادی فرضی",summary:"ابراز علاقه یا درخواست، قرارداد کار یا مشارکت مالی نیست؛ فرآیند بر حسب نوع فرصت به مالک مربوط ارجاع می‌شود.",syntheticMeta:"مهلت: فرضی ۱۴۰۵/۰۹/۱۵",status:"پذیرش درخواست: غیرفعال",label:"فرصت ساختگی",...deny},
 {id:"DEMO-OPP-002",section:"OPPORTUNITIES",owner:"CHILD18_OPPORTUNITIES",title:"فرصت نمونه معرفی ظرفیت کسب‌وکار",summary:"ارزیابی خودکار هوش مصنوعی تصمیم نهایی رد متقاضی نیست و داده درخواست‌ها محدود است.",syntheticMeta:"پاسخگویی: نامعلوم",status:"مرجع انتشار: تأییدنشده",label:"فرصت ساختگی",...deny}
];
export const NAV07_RELEASE_GATES=[
 "احراز نشست سهامدار، محدوده تعاونی و اهلیت خریدار سمت سرور؛ وضعیت نامعلوم ≠ صفر",
 "CHILD16: تأیید رسمی کالا/خدمت، فروشنده تعاونی در MVP، موجودی و شرایط قابل عرضه",
 "پیشنهاد محصول سهامدار ≠ Offer فروشنده؛ انتشار صرفاً پس از تأیید مالک کاتالوگ",
 "CHILD16: snapshot تغییرناپذیر قیمت و شرایط سفارش، موجودی اتمیک و تحمل درخواست تکراری",
 "CF05: پرداخت فقط به پذیرنده مجاز تعاونی/فروشنده، Callback تکراری ایمن، نتیجه نهایی در Domain",
 "ممنوعیت کیف پول نقدی، حساب تجمیع وجه، تسویه داخلی فروشنده و تبدیل سفارش به انتقال سهم",
 "حفظ محدودسازی دسترسی سفارش به شخص/تعاونی ذی‌ربط، قرارداد منبع، سطوح دسترسی و جلوگیری از افشای سفارش دیگران",
 "انتشار تخفیف و تبلیغ تنها با مجوز انتشار و برچسب حمایت مالی؛ اعلان رسمی ≠ تبلیغ",
 "ممنوعیت هدف‌گیری سیاسی و هدف‌گیری بر اساس صفات حساس اعضا",
 "CHILD18: فرصت‌های شغلی/پروژه/کسب‌وکار با قواعد متفاوت و امکان ابراز علاقه بدون ایجاد قرارداد",
 "CHILD18: تصمیم رد خودکار نهایی توسط AI ممنوع؛ شواهد درخواست RESTRICTED و ارزیاب کمینه‌دسترسی",
 "CHILD17: ابراز علاقه ≠ قرارداد، مناقصه ≠ خرید گروهی، بدون تجمیع وجوه و با مجوزهای تفکیکی",
 "آزمون ایزولاسیون tenant، لغو سفارش، بازگشت وجه، رقابت موجودی، افشای تبلیغ و دسترس‌پذیری",
 "پذیرش حقوقی/تجاری جداگانه، Release مرورگر و تأیید بصری قبل از فعال‌سازی"
] as const;
