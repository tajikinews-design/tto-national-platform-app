/** NAV11 canonical read-only review; no account settings mutation or auth action. */
export const NAV11_SECTIONS=[
 {id:"ACCOUNT",label:"حساب کاربری",owner:"CHILD01_CHILD02",description:"نمایش ساختار اطلاعات حساب؛ هویت واقعی دریافت نمی‌شود."},
 {id:"AVATAR",label:"عکس پروفایل",owner:"CHILD01_CHILD02_CHILD03",description:"تصویر نمایشی؛ بارگذاری یا حذف عکس غیرفعال است."},
 {id:"CONTACT",label:"اطلاعات تماس",owner:"CHILD01_CHILD02",description:"شماره و نشانی واقعی نمایش یا ویرایش نمی‌شوند."},
 {id:"NOTICES",label:"تنظیم اعلان‌ها",owner:"CHILD05_CHILD09",description:"ترجیحات اعلان صرفاً نمونه هستند؛ تغییری ذخیره نمی‌شود."},
 {id:"CHANNEL",label:"کانال پیام",owner:"CHILD05_CHILD09",description:"کانال نمونه انتخاب عملیاتی یا ارسال پیام نیست."},
 {id:"PRIVACY",label:"تنظیمات حریم خصوصی",owner:"CHILD22",description:"سیاست حریم خصوصی و دسترسی نیازمند تأیید رسمی است."},
 {id:"SECURITY",label:"امنیت حساب",owner:"CHILD01",description:"تنظیمات حساس فقط از قرارداد ایمن سمت سرور مجازند."},
 {id:"SESSIONS",label:"نشست‌های فعال",owner:"CHILD01",description:"هیچ نشست واقعی فهرست یا ابطال نمی‌شود."},
 {id:"OTP",label:"OTP/MFA",owner:"CHILD01",description:"فعال‌سازی و بازیابی عامل احراز هویت در دمو ممنوع است."},
 {id:"SIGNOUT",label:"خروج از دستگاه‌ها",owner:"CHILD01",description:"خروج از دستگاه‌های واقعی نیازمند فرمان سرور و احراز مجوز است."}
] as const;
export type Nav11Section=typeof NAV11_SECTIONS[number]["id"];
export type Nav11Mode="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"ACCESS_DENIED"|"DEMO_CONTENT";
export const NAV11_FIXTURES=NAV11_SECTIONS.map((item,index)=>({
 id:"DEMO-SETTING-"+String(index+1).padStart(3,"0"),
 section:item.id,
 title:item.label+" — نمونه",
 description:item.description,
 status:"صرفاً نمایش آزمایشی",
 mockOnly:true as const,verified:false as const,editable:false as const,authority:false as const,
 actionAllowed:false as const
}));
export const NAV11_GUARDS=[
 "PARTY با USER_ACCOUNT یکسان نیست.",
 "ROLE به‌تنهایی LEGAL_AUTHORITY ایجاد نمی‌کند.",
 "تغییر مشخصات و روش تماس نیازمند احراز مجوز مستقل سمت سرور است.",
 "OTP، عامل MFA، رمز و شناسه نشست هرگز در گزارش یا دمو منتشر نمی‌شوند.",
 "انتخاب گزینه در مرورگر به معنای ذخیره تنظیم یا تغییر سیاست نیست.",
 "تغییر Tenant باعث ارزیابی دوباره Permission می‌شود.",
 "Classification جایگزین Authorization نیست.",
 "هیچ ارسال پیام، آپلود تصویر، ابطال نشست یا خروج واقعی انجام نمی‌شود."
] as const;
