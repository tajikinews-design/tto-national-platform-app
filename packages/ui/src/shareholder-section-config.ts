/** The remaining shareholder sections are informational shells, NOT access grants.
 * Canonical NAV labels are sourced from shareholderNavigation in index.tsx;
 * this maps source authority to a fail-closed user-facing explanation.
 * No tenant, Party, document, holding or workflow record is provided here.
 */
export const SHAREHOLDER_SECTION_RULES={
 "NAV-04":{
  authority:"مرجع مجاز مجامع، مصوبات و اطلاع‌رسانی رسمی",
  description:"برگزاری مجمع، تشخیص حق رأی و اعتبار نتایج نیازمند مراجع قانونی مستقل است. این پنل سامانه رسمی رأی‌گیری نیست.",
  capability:"مشاهده دعوت‌نامه‌ها، اسناد و نتایج صرفاً پس از انتشار مصوب و تعیین مخاطب مجاز"
 },
 "NAV-06":{
  authority:"مالک قانونی خدمات تعاونی و مرجع احراز اهلیت عضو",
  description:"فهرست خدمات و درخواست‌های شخصی تا زمان تأیید منبع، اهلیت و مجوز اقدام متصل نمی‌شوند.",
  capability:"مشاهده خدمات مجاز و نتیجه قابل استناد درخواست‌های متعلق به همین سهامدار"
 },
 "NAV-07":{
  authority:"مرجع مستقل انتشار فرصت‌ها و خدمات غیرمعاملاتی",
  description:"بازارچه کالا و خدمات با بازار نقل‌وانتقال سهام متفاوت است. این بخش سفارش کالا، پرداخت یا معامله سهم ایجاد نمی‌کند.",
  capability:"نمایش فرصت‌ها و کالاهای قابل انتشار برای مخاطب دارای مجوز"
 },
 "NAV-08":{
  authority:"مرجع ثبت پروژه و تصویب اطلاعات قابل انتشار",
  description:"وضعیت پروژه، درصد پیشرفت و هزینه بدون نسخه منبع و تصویب انتشار، نمایش داده نمی‌شود.",
  capability:"مشاهده پروژه‌ها، اسناد و پیشرفت قابل انتشار"
 },
 "NAV-09":{
  authority:"مرجع قانونی اسناد، افشا و طبقه‌بندی اطلاعات شرکت",
  description:"اسناد ثبتی و صورت‌های مالی صرفاً جهت شفافیت برای سهامدار منتشر می‌شوند. سامانه حسابداری عمومی یا گردش مالی داخلی اجرا نمی‌شود.",
  capability:"فهرست اسناد با کنترل مستقل سطح دسترسی و مجوز دانلود"
 },
 "NAV-10":{
  authority:"منابع مستقل و دارای مجوز گزارش‌های شخصی",
  description:"گزارش، مانده سهم، وضعیت درخواست یا سابقه‌ای بدون منبع و احراز حق دسترسی تولید نمی‌شود.",
  capability:"گزارش‌های قابل استناد و اختصاصی همان صاحب حساب و تعاونی"
 },
 "NAV-11":{
  authority:"CF01/CF02 و سیاست‌های تأییدشده مدیریت نشست و تنظیمات",
  description:"تغییر مشخصات هویتی، اطلاعات تماس، تنظیمات حساس و نشست‌ها به مجوز و تأیید مستقل سمت سرور نیاز دارد.",
  capability:"مشاهده روش‌های تماس و تنظیمات مجاز بدون تغییر وضعیت عملیاتی"
 }
} as const;
export type ShareholderSectionId=keyof typeof SHAREHOLDER_SECTION_RULES;
export function shareholderSectionId(value:string):ShareholderSectionId|null{
 return Object.prototype.hasOwnProperty.call(SHAREHOLDER_SECTION_RULES,value)?
  value as ShareholderSectionId:null;
}
