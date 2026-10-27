/** NAV-04 governance information preview, not a legal election or vote system.
 * All named organizations, records, venues and dates are fictional and hardcoded.
 * Never derive voting rights from Child06 membership or Child07 holdings.
 */
export type AssemblyKind="ASSEMBLY"|"ELECTION";
export type DisclosureStatus="DEMO_PUBLISHED"|"REVIEW_PENDING"|"POSTPONED"|"ARCHIVED";
export type MockDocument={
 code:string;title:string;kind:string;status:string;version:string;authority:string;
};
export type GovernanceFixture={
 id:string;kind:AssemblyKind;title:string;classification:string;
 status:DisclosureStatus;headline:string;
 organizer:string;at:string;place:string;agenda:readonly string[];
 documents:readonly MockDocument[];
 results:string;decisionAuthority:string;
};
export const UNKNOWN="— (منبع رسمی تأیید نشده)";
export const DEMO_DATE="۱۴۰۵/۰۸/۰۵ — تاریخ کاملاً فرضی";
export const STATUS_LABEL:Record<DisclosureStatus,string>={
 DEMO_PUBLISHED:"نمونه انتشار ساختگی",
 REVIEW_PENDING:"نمونه در انتظار بررسی انتشار",
 POSTPONED:"نمونه تعویق جلسه",
 ARCHIVED:"نمونه بایگانی ساختگی"
};
const DEMO_AUTHORITY="DEMO-ISSUER — مرجع فرضی، نه مقام قانونی واقعی";
const DEMO_DOC=(code:string,title:string,kind:string):MockDocument=>({
 code,title,kind,status:"فقط شمایل سند؛ فایل و امضای حقیقی وجود ندارد",
 version:"DEMO-v1 (فاقد اعتبار)",authority:DEMO_AUTHORITY
});
export const GOVERNANCE_FIXTURES:readonly GovernanceFixture[]=[
 {
  id:"DEMO-ASM-INVITE-01",kind:"ASSEMBLY",title:"نمونه دعوت‌نامه مجمع عمومی عادی سالیانه",
  classification:"اطلاع‌رسانی مجمع، نه دعوت‌نامه رسمی",
  status:"DEMO_PUBLISHED",headline:"نمونه نمایش زمان، دستور جلسه و مرجع انتشار",
  organizer:"تعاونی فرضی — بدون شناسه ثبتی",at:DEMO_DATE,
  place:"سالن نمونه (مکان غیرواقعی)",
  agenda:["گزارش فعالیت — عنوان فرضی","گزارش بازرس — عنوان فرضی","سایر دستورهای مصوب پس از احراز مرجع قانونی"],
  documents:[DEMO_DOC("DEMO-DOC-INVITE","دعوت‌نامه ساختگی","دعوت‌نامه"),
   DEMO_DOC("DEMO-DOC-AGENDA","دستور جلسه ساختگی","دستور جلسه")],
  results:"— (جلسه واقعی برگزار نشده)",decisionAuthority:DEMO_AUTHORITY
 },{
  id:"DEMO-ASM-MINUTES-02",kind:"ASSEMBLY",title:"نمونه صورت‌جلسه مجمع عمومی فوق‌العاده",
  classification:"نمایش صورت‌جلسه با اثر حقوقی صفر",
  status:"ARCHIVED",headline:"نمونه بایگانی و نسخه‌بندی صورت‌جلسه",
  organizer:"تعاونی فرضی — بدون شناسه ثبتی",at:DEMO_DATE,
  place:"محل نمونه — فاقد نشانی حقیقی",
  agenda:["دستور فرضی نخست","دستور فرضی دوم"],
  documents:[DEMO_DOC("DEMO-DOC-MINUTES","صورت‌جلسه نمونه بدون امضا","صورت‌جلسه"),
   DEMO_DOC("DEMO-DOC-REPORT","گزارش خلاصه فرضی","گزارش")],
  results:"صرفاً متن نمونه؛ هیچ مصوبه الزام‌آور ثبت نشده",decisionAuthority:DEMO_AUTHORITY
 },{
  id:"DEMO-ASM-POSTPONED-03",kind:"ASSEMBLY",title:"نمونه اطلاع‌رسانی تعویق مجمع",
  classification:"نمایش حالت تعویق بدون ایجاد اعلان حقیقی",
  status:"POSTPONED",headline:"چگونگی نمایش دلیل و زمان بازبینی",
  organizer:"تعاونی فرضی — بدون شناسه ثبتی",at:"— (زمان جایگزین مشخص نشده)",
  place:"— (اطلاع‌رسانی واقعی وجود ندارد)",
  agenda:["دستور جلسه قبلی تنها یک مثال است"],
  documents:[DEMO_DOC("DEMO-DOC-POSTPONE","اطلاعیه تعویق فرضی","اطلاعیه")],
  results:"— (بدون تصمیم حقوقی)",decisionAuthority:DEMO_AUTHORITY
 },{
  id:"DEMO-ELEC-BOARD-01",kind:"ELECTION",title:"نمونه اطلاع‌رسانی انتخابات هیئت‌مدیره",
  classification:"اطلاع‌رسانی آموزشی، نه ثبت‌نام یا رأی‌گیری",
  status:"REVIEW_PENDING",headline:"نمونه نمایش فرایند اطلاع‌رسانی نامزدی و برنامه جلسه",
  organizer:"تعاونی فرضی — بدون شناسه ثبتی",at:DEMO_DATE,
  place:"فضای فرضی جلسه — غیرقابل استفاده",
  agenda:["اعلام بازه فرضی اطلاع‌رسانی","معرفی اسناد موردنیاز پس از تصویب","بررسی نتیجه فقط از منبع رسمی معتبر"],
  documents:[DEMO_DOC("DEMO-DOC-ELEC-GUIDE","راهنمای نامزدی فرضی","راهنمای آموزشی"),
   DEMO_DOC("DEMO-DOC-ELEC-SCHEDULE","برنامه نمونه","اطلاعیه")],
  results:"هیچ رأی، شمارش آرا یا نتیجه انتخاباتی واقعی وجود ندارد",decisionAuthority:DEMO_AUTHORITY
 },{
  id:"DEMO-ELEC-INSPECTOR-02",kind:"ELECTION",title:"نمونه سوابق انتخابات بازرس",
  classification:"بایگانی نمایشی؛ بدون احراز منتخب",
  status:"ARCHIVED",headline:"شمایل نمایش سابقه و سند نتیجه مشروط به انتشار رسمی",
  organizer:"تعاونی فرضی — بدون شناسه ثبتی",at:DEMO_DATE,
  place:"— (صرفاً سند نمایشی)",
  agenda:["روش اطلاع‌رسانی نامزدی — نمونه","عنوان نتیجه بدون اسامی اشخاص واقعی"],
  documents:[DEMO_DOC("DEMO-DOC-ELEC-RECORD","سابقه انتخاباتی ساختگی","صورت‌جلسه انتخاباتی")],
  results:"هیچ نام منتخب، رأی یا شمارش معتبری در این نمونه ارائه نشده",decisionAuthority:DEMO_AUTHORITY
 }
] as const;
export const GOVERNANCE_SOURCE_GATES={
 assemblyPublisher:"BLOCKED",
 minutesAuthenticity:"NOT_VERIFIED",
 recipientEligibility:"UNKNOWN",
 electionResultAuthority:"BLOCKED",
 votingEligibility:"NOT_EVALUATED",
 memberVotingPower:"NOT_CALCULATED",
 documentDownload:"DISABLED",
 ballots:"DISABLED",
 electionSubmission:"DISABLED"
} as const;
