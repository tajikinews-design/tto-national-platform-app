/** Static demonstration cases — no DB, signatures, member records or legal grants.
 * Source: TTO-SHARE-MARKET-SPEC v3.0 §§24,27–28,36–42.
 */
import {BUY_STEPS,SELL_STEPS,type PreviewFlow,type PreviewOwner} from "../market-flow-model";

export type LegalEffect="NOT_TRANSFERRED"|"REGISTERED_NOT_FINAL"|"SYNTHETIC_COMPLETED";
export type PreviewEvent={
 step:string; title:string; timestamp:string; actor:string; role:PreviewOwner;
 before:string; after:string; requestId:string; reasonCode:string; metadata:string;
};
export type PreviewCase={
 id:string; title:string; flow:PreviewFlow; statusCode:string;
 stepIndex:number; completedCount:number; nextActionOwner:PreviewOwner;
 exceptionCode:string|null; summary:string;
 legalEffect:LegalEffect;
 board:{state:string;meetingRef:string;decisionRef:string};
 payment:{state:string;reportedRef:string;sellerConfirmationRef:string;amount:string};
 fees:{state:string;policyRef:string};
 register:{state:string;registerRef:string;page:string;row:string;verifiedBy:string};
 cancellation:{state:string;rule:string};
 timestamps:{opened:string;lastUpdate:string};
 timeline:readonly PreviewEvent[];
};

const SAMPLE_DATE="۱۴۰۵/۰۸/۰۵ · زمان ساختگی";
const MASK="— (هیچ داده رسمی دریافت نشده)";
export const LEGAL_EFFECT_LABEL:Record<LegalEffect,string>={
 NOT_TRANSFERRED:"مالکیت منتقل نشده است",
 REGISTERED_NOT_FINAL:"در نمونه، ثبت دفتر انجام شده؛ Finalization هنوز کامل نیست",
 SYNTHETIC_COMPLETED:"انتقال فقط در سناریوی فرضی تکمیل شده؛ هیچ مالکیت واقعی جابه‌جا نشده"
};
export const DISPUTE_REASONS=["PAYMENT_NOT_RECEIVED","PAYMENT_AMOUNT_MISMATCH",
 "WRONG_BANK_ACCOUNT","BUYER_NO_SHOW","SELLER_NO_SHOW","DOCUMENT_MISMATCH",
 "OWNERSHIP_CONFLICT","FEE_DISPUTE","OTHER"] as const;

type FixtureConfig={
 id:string;title:string;flow:PreviewFlow;stepIndex:number;completedCount:number;
 exception?:string; owner?:PreviewOwner;summary:string;
 board?:string;payment?:string;fees?:string;register?:string;cancellation?:string;
};
const canonicalSteps=(flow:PreviewFlow)=>flow==="BUY"?BUY_STEPS:SELL_STEPS;
function makeCase(config:FixtureConfig):PreviewCase{
 const steps=canonicalSteps(config.flow);
 const state=steps[config.stepIndex];
 const timeline:PreviewEvent[]=steps.slice(0,config.completedCount).map((step,index)=>({
  step:step.code,title:step.title,timestamp:SAMPLE_DATE,
  actor:"DEMO-ACTOR-"+step.owner,role:step.owner,
  before:index===0?"—":steps[index-1].code,
  after:step.code,
  requestId:"DEMO-EVENT-"+config.id+"-"+String(index+1).padStart(2,"0"),
  reasonCode:"SYNTHETIC_STAGE_EXAMPLE",
  metadata:"Fixture نمایشی؛ زمان، نقش و مستند هیچ‌کدام احراز نشده‌اند"
 }));
 if(config.exception)timeline.push({
  step:config.exception,title:config.exception==="CANCELLATION_REQUEST"?"درخواست بررسی انصراف":"ثبت وضعیت استثنایی آزمایشی",
  timestamp:SAMPLE_DATE,actor:"DEMO-ACTOR-COOPERATIVE",role:"COOPERATIVE",
  before:state.code,after:config.exception,
  requestId:"DEMO-EXCEPTION-"+config.id,
  reasonCode:"SYNTHETIC_EXCEPTION_ONLY",
  metadata:"صرفاً نمونه مستندسازی؛ نتیجه حقوقی یا تصمیم واقعی وجود ندارد"
 });
 const effect:LegalEffect=config.flow==="BUY"&&
  config.completedCount===BUY_STEPS.length&&config.exception===undefined
  ?"SYNTHETIC_COMPLETED":
  config.flow==="BUY"&&config.completedCount>=18&&config.exception===undefined
  ?"REGISTERED_NOT_FINAL":"NOT_TRANSFERRED";
 return {
  id:config.id,title:config.title,flow:config.flow,
  statusCode:state.code,stepIndex:config.stepIndex,completedCount:config.completedCount,
  nextActionOwner:config.owner??state.owner,exceptionCode:config.exception??null,
  summary:config.summary,legalEffect:effect,
  board:{state:config.board??"در انتظار تأیید مستقل",meetingRef:config.board?"DEMO-MEETING (غیرقابل استناد)":MASK,
   decisionRef:config.board?"DEMO-RESOLUTION (بدون مصوبه واقعی)":MASK},
  payment:{state:config.payment??"هنوز زمان پرداخت نیست",
   reportedRef:config.payment?"DEMO-PAYMENT-REPORT (بدون رسید واقعی)":MASK,
   sellerConfirmationRef:config.payment==="تأیید وصول فرضی (نمونه)"?"DEMO-SELLER-ACK (ساختگی)":MASK,
   amount:"— (مبلغ واقعی یا سند بانکی وجود ندارد)"},
  fees:{state:config.fees??"نامشخص؛ ضابطه مصوب موجود نیست",policyRef:MASK},
  register:{state:config.register??"در دفتر واقعی ثبت نشده",registerRef:config.register?"DEMO-REGISTER (غیرواقعی)":MASK,
   page:config.register?"DEMO-PAGE":MASK,row:config.register?"DEMO-ROW":MASK,
   verifiedBy:config.register?"DEMO-VERIFIER (نمونه)":MASK},
  cancellation:{state:config.cancellation??"درخواستی ثبت نشده",rule:
   "قبل از خریدار تابع Market Policy؛ پس از Reservation درخواست لغو؛ پس از پرداخت بررسی اختلاف؛ پس از COMPLETED فقط Correction Case مستقل."},
  timestamps:{opened:SAMPLE_DATE,lastUpdate:SAMPLE_DATE},timeline
 };
}
export const CASES:readonly PreviewCase[]=[
 makeCase({id:"DEMO-SELL-QUEUED",title:"فروشنده در صف عرضه",flow:"SELL",
  stepIndex:3,completedCount:4,
  summary:"قفل سهم در سناریوی ساختگی اعمال شده؛ قفل به معنی خروج سهم از مالکیت فروشنده نیست."}),
 makeCase({id:"DEMO-SELL-LISTED",title:"عرضه نمایشی روی تابلو",flow:"SELL",
  stepIndex:6,completedCount:7,
  summary:"تابلوی فرضی با FIFO و قیمت مرجع؛ هیچ آگهی واقعی منتشر نشده است."}),
 makeCase({id:"DEMO-SELL-CANCELLED",title:"انصراف قبل از وجود خریدار",flow:"SELL",
  stepIndex:3,completedCount:4,exception:"CANCELLED",owner:"COOPERATIVE",
  cancellation:"لغو در سناریوی فرضی، منوط به Market Policy",
  summary:"لغو پیش از رزرو فقط طبق سیاست معتبر تعاونی می‌تواند پذیرفته شود؛ این صفحه هیچ قفلی را آزاد نمی‌کند."}),
 makeCase({id:"DEMO-BUY-BOARD",title:"خرید در انتظار مصوبه هیئت‌مدیره",flow:"BUY",
  stepIndex:4,completedCount:4,
  summary:"شناسه جلسه، مصوبه و صلاحیت مرجع هنوز فرضاً در انتظار بررسی مستقل است."}),
 makeCase({id:"DEMO-BUY-PAID-REPORTED",title:"خریدار پرداخت را اعلام کرده؛ وصول تأیید نشده",flow:"BUY",
  stepIndex:9,completedCount:9,board:"تأیید ساختگی هیئت‌مدیره — غیرقابل استناد",
  payment:"فقط اعلام پرداخت از سوی خریدار",
  summary:"PAYMENT_REPORTED معادل PAYMENT_CONFIRMED نیست؛ فروشنده باید وصول کامل را مستقلاً تأیید کند."}),
 makeCase({id:"DEMO-BUY-DISPUTED",title:"اختلاف مبلغ پرداخت",flow:"BUY",
  stepIndex:9,completedCount:9,exception:"PAYMENT_DISPUTED",owner:"COOPERATIVE",
  board:"تأیید ساختگی هیئت‌مدیره — غیرقابل استناد",
  payment:"PAYMENT_AMOUNT_MISMATCH — مورد اختلاف",
  summary:"اختلاف باز، Finalization را مسدود می‌کند؛ Timeout تأیید وصول یا انتقال نیست."}),
 makeCase({id:"DEMO-BUY-CANCEL-REQUEST",title:"درخواست لغو بعد از رزرو",flow:"BUY",
  stepIndex:1,completedCount:2,exception:"CANCELLATION_REQUEST",owner:"COOPERATIVE",
  cancellation:"در انتظار بررسی لغو؛ لغو مستقیم انجام نشده",
  summary:"بعد از Reservation لغو مستقیم ممنوع است؛ فقط درخواست لغو می‌تواند برای بررسی ارسال شود."}),
 makeCase({id:"DEMO-BUY-REGISTERED",title:"ثبت دفتر سهام، پیش از نهایی‌شدن",flow:"BUY",
  stepIndex:17,completedCount:18,board:"تأیید ساختگی هیئت‌مدیره — غیرقابل استناد",
  payment:"تأیید وصول فرضی (نمونه)",fees:"هزینه‌های فرضی تعیین تکلیف شده‌اند",
  register:"REGISTER_RECORDED — ثبت دفتر صرفاً نمایشی",
  summary:"ثبت دفتر سهام بدون Final Approval و تسویه اتمیک، انتقال مالکیت نیست."}),
 makeCase({id:"DEMO-BUY-COMPLETED",title:"نمونه تکمیل معامله (فقط آموزشی)",flow:"BUY",
  stepIndex:20,completedCount:21,board:"تأیید ساختگی هیئت‌مدیره — غیرقابل استناد",
  payment:"تأیید وصول فرضی (نمونه)",fees:"هزینه‌های فرضی تعیین تکلیف شده‌اند",
  register:"REGISTER_RECORDED — ثبت دفتر صرفاً نمایشی",
  cancellation:"بعد از تکمیل: فقط Correction Case مستقل",
  summary:"تمام مراحل فرضی نمایش داده می‌شوند؛ هیچ مالکیت حقیقی تغییر نکرده و امکان ابطال مستقیم وجود ندارد."})
] as const;
export const CASE_IDS=CASES.map(item=>item.id);
