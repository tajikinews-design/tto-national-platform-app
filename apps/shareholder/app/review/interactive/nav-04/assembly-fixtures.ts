/** NAV-04: informational, tenant-free synthetic assembly and election fixtures.
 * Not a voting, quorum, attendance, mandate, invitation, or certification system.
 * No election/meeting legal rules are inferred.
 */
export type RecordType="INVITATION"|"MINUTES"|"ELECTION_INFO"|"RESULT";
export type DemoSourceState="UNVERIFIED"|"SOURCE_UNAVAILABLE"|"DEMO_CONTENT";
export type AssemblyDoc={id:string;title:string;kind:string;mockOnly:true;downloadEnabled:false};
export type AssemblyRecord={
 id:string;recordType:RecordType;title:string;assemblyKind:string;
 scheduledAt:string;location:string;publicationState:string;
 summary:string;sourceAuthority:string;version:string;
 decisionState:string;documents:readonly AssemblyDoc[];
 audienceScope:string;legalReadiness:false;
 canVote:false;canCountVotes:false;resultOfficial:false;
};
export const KIND_LABEL:Record<RecordType,string>={
 INVITATION:"دعوت‌نامه‌ها",
 MINUTES:"صورت‌جلسات",
 ELECTION_INFO:"اطلاعات انتخابات",
 RESULT:"نتایج و سوابق"
};
export const ASSEMBLY_FIXTURES:readonly AssemblyRecord[]=[
 {
  id:"DEMO-ASM-INV-001",recordType:"INVITATION",
  title:"دعوت‌نامه نمونه مجمع عمومی عادی سالیانه",
  assemblyKind:"مجمع عمومی عادی سالیانه",
  scheduledAt:"۱۴۰۵/۰۹/۱۵ ـ تاریخ فرضی",location:"محل برگزاری فرضی ـ نشانی واقعی ثبت نشده",
  publicationState:"پیش‌نویس آزمایشی؛ انتشار رسمی انجام نشده",
  summary:"نمونه کارت دعوت برای نمایش زمان، مکان و دستور جلسه. این صفحه هیچ مخاطب واقعی را احراز یا دعوت نمی‌کند.",
  sourceAuthority:"مرجع دعوت مجاز تعاونی باید مستقلاً تأیید شود",version:"DEMO-V1",
  decisionState:"— (جلسه و تصمیم واقعی وجود ندارد)",
  documents:[
   {id:"DEMO-INV-AGENDA",title:"دستور جلسه فرضی ـ صرفاً عنوان",kind:"AGENDA",mockOnly:true,downloadEnabled:false},
   {id:"DEMO-INV-REF",title:"ارجاع دعوت‌نامه نمونه ـ بدون متن سند",kind:"INVITATION_REF",mockOnly:true,downloadEnabled:false}
  ],audienceScope:"مخاطبان قانونی پس از تأیید مرجع و مجوز انتشار",
  legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false
 },
 {
  id:"DEMO-ASM-INV-002",recordType:"INVITATION",
  title:"دعوت‌نامه نمونه مجمع عمومی فوق‌العاده",
  assemblyKind:"مجمع عمومی فوق‌العاده",
  scheduledAt:"۱۴۰۵/۱۰/۱۰ ـ تاریخ فرضی",location:"نامشخص (نمونه صرفاً چیدمان)",
  publicationState:"پیش‌نویس آزمایشی؛ انتشار رسمی انجام نشده",
  summary:"نمایش نمونه موضوعات جلسه بدون تعیین حد نصاب قانونی، تشریفات دعوت یا ترتیب تصمیم‌گیری.",
  sourceAuthority:"صلاحیت دعوت و فهرست مخاطبان احراز نشده",version:"DEMO-V1",
  decisionState:"—",
  documents:[{id:"DEMO-INV-EXTRA",title:"پیوست دستور جلسه (وجود فایل واقعی تأیید نشده)",kind:"AGENDA",mockOnly:true,downloadEnabled:false}],
  audienceScope:"نامعلوم تا احراز حقوقی",legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false
 },
 {
  id:"DEMO-ASM-MIN-001",recordType:"MINUTES",
  title:"صورت‌جلسه فرضی مجمع عمومی عادی",
  assemblyKind:"مجمع عمومی عادی سالیانه",
  scheduledAt:"۱۴۰۵/۰۷/۲۰ ـ تاریخ فرضی",location:"جلسه ساختگی ـ هیچ نشست واقعی برگزار نشده",
  publicationState:"صرفاً نمونه فرم صورت‌جلسه؛ فاقد اعتبار و امضا",
  summary:"جایگاه عنوان تصمیم‌ها، ارجاع مصوبه، امضاها و نسخه سند را نمایش می‌دهد؛ اینجا هیچ تصمیم حقوقی ایجاد نشده است.",
  sourceAuthority:"اصالت صورت‌جلسه، امضاکنندگان و مرجع انتشار بررسی نشده",version:"DEMO-V2",
  decisionState:"— (مصوبه معتبر ثبت نشده)",
  documents:[
   {id:"DEMO-MIN-REFERENCE",title:"شماره ارجاع صورت‌جلسه نمونه",kind:"MINUTES_REF",mockOnly:true,downloadEnabled:false},
   {id:"DEMO-MIN-APPROVAL",title:"محل ارجاع امضا و تأیید (فقط نمایش)",kind:"APPROVAL_REF",mockOnly:true,downloadEnabled:false}
  ],audienceScope:"براساس سیاست مصوب افشای صورت‌جلسات",legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false
 },
 {
  id:"DEMO-ASM-MIN-002",recordType:"MINUTES",
  title:"نمونه صورت‌جلسه مجمع عمومی فوق‌العاده",
  assemblyKind:"مجمع عمومی فوق‌العاده",
  scheduledAt:"۱۴۰۵/۰۸/۰۱ ـ تاریخ فرضی",location:"— (محل ساختگی)",
  publicationState:"عدم انتشار رسمی؛ صرفاً طراحی",
  summary:"در UI واقعی، صورت‌جلسه باید از مرجع قانونی نسخه‌دار و با دسترسی مجاز دریافت شود.",
  sourceAuthority:"منبع رسمی صورت‌جلسه متصل نیست",version:"DEMO-V1",
  decisionState:"—",
  documents:[{id:"DEMO-MIN-EXTRA",title:"ارجاع سند نمونه",kind:"MINUTES_REF",mockOnly:true,downloadEnabled:false}],
  audienceScope:"محدود به مخاطبان مجاز",legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false
 },
 {
  id:"DEMO-ASM-ELECT-001",recordType:"ELECTION_INFO",
  title:"اطلاعات آزمایشی انتخابات هیئت‌مدیره و بازرسان",
  assemblyKind:"بخش اطلاع‌رسانی انتخابات",
  scheduledAt:"— (زمان قانونی تعیین نشده)",location:"— (محل قانونی تعیین نشده)",
  publicationState:"پیش‌نمایش آموزشی؛ انتخابات واقعی تعریف نشده",
  summary:"در این نسخه فقط عنوان مراحل اعلام نامزدها، اطلاع‌رسانی و بررسی اعتبار نتایج نشان داده می‌شود؛ هیچ نامزد یا رأی‌دهنده واقعی وجود ندارد.",
  sourceAuthority:"مرجع برگزارکننده، فهرست واجدان شرایط و آیین‌نامه قانونی احراز نشده",version:"DEMO-V1",
  decisionState:"حق رأی، تعداد آرای مجاز، نصاب، شمارش و نتیجه همه نامعلوم هستند",
  documents:[
   {id:"DEMO-EL-POLICY",title:"محل معرفی مقررات معتبر انتخابات، بدون فایل",kind:"RULE_REFERENCE",mockOnly:true,downloadEnabled:false},
   {id:"DEMO-EL-CANDIDATES",title:"فهرست نامزدهای فرضی ـ بدون مشخصات اشخاص",kind:"CANDIDATES",mockOnly:true,downloadEnabled:false}
  ],audienceScope:"صلاحیت و مخاطبان فقط توسط مرجع ذی‌صلاح تعیین می‌شوند",
  legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false
 },
 {
  id:"DEMO-ASM-RESULT-001",recordType:"RESULT",
  title:"نمونه بایگانی نتایج و مصوبات مجامع",
  assemblyKind:"سوابق و نتایج",
  scheduledAt:"۱۴۰۵/۰۵/۱۲ ـ تاریخ فرضی",location:"نمونه بایگانی",
  publicationState:"محتوای ساختگی؛ هیچ نتیجه‌ای اعلام رسمی نشده",
  summary:"محل نمایش عنوان مصوبه، تاریخ اعتبار، شماره مرجع انتشار و وضعیت تأیید مستقل، بدون ادعای اعتبار واقعی.",
  sourceAuthority:"اصل صورت‌جلسه، مرجع انتشار و اسناد تصویب بررسی نشده",version:"DEMO-V1",
  decisionState:"نتایج و مصوبات: نامعلوم/تأییدنشده",
  documents:[
   {id:"DEMO-RES-REF",title:"محل ارجاع نتیجه فرضی",kind:"RESULT_REFERENCE",mockOnly:true,downloadEnabled:false},
   {id:"DEMO-RES-SIGNED",title:"محل ارجاع نسخه امضاشده؛ فایل واقعی موجود نیست",kind:"SIGNATURE_REF",mockOnly:true,downloadEnabled:false}
  ],audienceScope:"فقط پس از تأیید صحت نتیجه و سیاست انتشار",legalReadiness:false,canVote:false,canCountVotes:false,resultOfficial:false
 }
] as const;
export const REFERENCE_REVIEW_GATES=[
 "تأیید مرجع قانونی دعوت و برگزاری برای هر تعاونی",
 "تأیید هویت و صلاحیت مخاطب اطلاع‌رسانی",
 "تأیید نسخه، امضا، تاریخ و منشأ سند",
 "تعیین وضعیت اعتبار تصمیم و ثبت صورت‌جلسه",
 "احراز مستقل اهلیت رأی‌دهنده، نوع رأی و ضوابط شمارش",
 "تصویب سطح دسترسی، نگهداری و انتشار رسمی"
] as const;
