/** NAV03 UI-only flow catalog extracted from TTO-SHARE-MARKET-SPEC v3.0.
 * Source is a verified project Drive DOCX, not a legal approval or live market ruleset.
 * This is not a backend state machine and MUST NOT drive ledger writes.
 */
export type PreviewOwner="SELLER"|"BUYER"|"COOPERATIVE"|"BOARD"|"SYSTEM"|"NONE";
export type PreviewStep={
 code:string;
 title:string;
 owner:PreviewOwner;
 detail:string;
 evidence:string;
};
export type PreviewFlow="SELL"|"BUY";
export const OWNER_LABEL:Record<PreviewOwner,string>={
 SELLER:"فروشنده",BUYER:"خریدار",COOPERATIVE:"تعاونی",
 BOARD:"هیئت‌مدیره",SYSTEM:"کنترل سیستمی",NONE:"—"
};
export const SELL_STEPS:readonly PreviewStep[]=[
 {code:"SELL_REQUEST_SUBMITTED",title:"درخواست فروش داوطلبانه",owner:"SELLER",
  detail:"فروشنده مقدار سهم قابل عرضه را درخواست می‌کند؛ در MVP نوع عرضه فقط FULL_OFFER است.",
  evidence:"quantity، sale_mode = FULL_OFFER، requested_at، accept_market_policy"},
 {code:"SELL_ELIGIBILITY_REVIEW",title:"کنترل صلاحیت فروش",owner:"SYSTEM",
  detail:"وضعیت فعال، موجودی آزاد، قفل‌های متعارض، منع قانونی، معامله متعارض و تعهد سرمایه طبق Rule بررسی می‌شود.",
  evidence:"seller_status، available_shares، no_conflicting_lock، no_legal_hold، share_sale_eligibility"},
 {code:"SHARES_LOCKED",title:"قفل سهام برای عرضه",owner:"SYSTEM",
  detail:"پس از پذیرش معتبر، سهم قفل می‌شود ولی از مالکیت فروشنده خارج نمی‌شود.",
  evidence:"share_lock_reference، quantity، rule_snapshot، audit_event"},
 {code:"MARKET_QUEUE",title:"صف عرضه کنترل‌شده",owner:"COOPERATIVE",
  detail:"عرضه فوراً منتشر نمی‌شود؛ صف پیش‌فرض FIFO بر اساس accepted_at و ظرفیت مصوب تعاونی است.",
  evidence:"queue_position، accepted_at، queue_policy، daily_capacity"},
 {code:"MARKET_SCHEDULED",title:"نوبت و ETA تقریبی",owner:"COOPERATIVE",
  detail:"جایگاه صف و زمان تقریبی نمایش داده می‌شود؛ ETA تضمین قطعی نیست.",
  evidence:"scheduled_at، estimated_listing_at، capacity_policy_version"},
 {code:"PRICING_RULE_REVIEW",title:"کنترل مبنای قیمت",owner:"COOPERATIVE",
  detail:"فروشنده قیمت دلخواه تعیین نمی‌کند مگر قاعده معتبر اجازه دهد. قیمت باید به ACTIVE_PRICING_RULE و گزارش معتبر متصل باشد.",
  evidence:"pricing_rule_id، unit_price، valuation_date، expert_report_reference، approval_reference"},
 {code:"LISTED",title:"انتشار عرضه در تابلو",owner:"COOPERATIVE",
  detail:"کارت عرضه، تعداد، قیمت واحد و کل، مبنای قیمت، تاریخ ارزش‌گذاری، اعتبار و هزینه‌های شناخته‌شده را نشان می‌دهد.",
  evidence:"offer_reference، quantity، pricing_basis، valid_until، fee_breakdown"}
];
export const BUY_STEPS:readonly PreviewStep[]=[
 {code:"BUY_REQUESTED",title:"ثبت درخواست خرید",owner:"BUYER",
  detail:"CTA مصوب «ثبت درخواست خرید» است؛ این درخواست به معنی خرید قطعی یا انتقال سهم نیست.",
  evidence:"offer_ref، quantity، buyer_type، requested_at، ruleset_version"},
 {code:"SHARES_RESERVED",title:"رزرو تراکنشی سهم",owner:"SYSTEM",
  detail:"رزرو باید همزمانی خریداران را کنترل کند تا یک سهم به دو نفر اختصاص نیابد. این صفحه فقط توضیح است.",
  evidence:"reservation_ref، lock_version، expiry، idempotency_key"},
 {code:"AUTO_VALIDATION",title:"اعتبارسنجی خریدار",owner:"SYSTEM",
  detail:"هویت، وضعیت عضویت، سقف قانونی فعال، وضعیت عرضه، قیمت و موانع بررسی می‌شود؛ Rule در UI سخت‌کد نمی‌شود.",
  evidence:"buyer_type_snapshot، eligibility_rule_ref، active_cap_rule، hold_dispute_check"},
 {code:"COOP_REVIEW",title:"بررسی تعاونی",owner:"COOPERATIVE",
  detail:"نتیجه کنترل‌ها و مستندات برای مسئول مجاز تعاونی مطرح می‌شود. عدم قطعیت به بررسی دستی ارجاع می‌شود.",
  evidence:"reviewer، check_results، reason_code، legal_rule_snapshot"},
 {code:"BOARD_APPROVAL_PENDING",title:"تأیید مستقل هیئت‌مدیره",owner:"BOARD",
  detail:"تأیید هیئت‌مدیره یک پرونده مستقل با مرجع جلسه و تصمیم است، نه تیک ساده یا تأیید خودکار.",
  evidence:"approval_id، meeting_reference، resolution_reference، decision_date، attachment_reference"},
 {code:"PRE_APPROVED",title:"پیش‌تأیید معامله",owner:"COOPERATIVE",
  detail:"فقط اجازه ادامه روند است؛ هیچ حق مالکیت یا خرید نهایی ایجاد نمی‌شود.",
  evidence:"board_approval_reference، buyer_eligibility، approval_rule_version"},
 {code:"SELLER_CONTINUATION_PENDING",title:"تأیید ادامه توسط فروشنده",owner:"SELLER",
  detail:"فروشنده باید تعداد، قیمت، هزینه‌ها، خالص مورد انتظار، مهلت و شرایط انصراف را ببیند و ادامه را تأیید کند.",
  evidence:"quantity، unit_price، gross، seller_fees، expected_net، deadline، cancellation_terms"},
 {code:"PAYMENT_PENDING",title:"آماده پرداخت مستقیم",owner:"BUYER",
  detail:"پس از تأیید فروشنده، حساب تأییدشده فقط در مسیر مجاز معامله نمایش داده می‌شود؛ ثمن مستقیم خریدار→فروشنده است.",
  evidence:"verified_seller_bank_account_ref، gross_amount، fee_policy_snapshot"},
 {code:"PAYMENT_REPORTED",title:"اعلام پرداخت خریدار",owner:"BUYER",
  detail:"ثبت تاریخ، بانک، روش، شماره پیگیری و رسید فقط اعلام پرداخت است؛ وجه هنوز تأیید نشده است.",
  evidence:"amount، payment_date، bank، tracking_number، payment_method، receipt_reference"},
 {code:"PAYMENT_CONFIRMATION_PENDING",title:"انتظار تأیید وصول",owner:"SELLER",
  detail:"فروشنده می‌تواند وصول کامل، عدم دریافت یا مغایرت مبلغ را اعلام کند؛ تأخیر، تأیید خودکار نیست.",
  evidence:"receipt_status، seller_response، disagreement_reason"},
 {code:"PAYMENT_CONFIRMED",title:"تأیید وصول ثمن",owner:"SELLER",
  detail:"فقط وصول کامل توسط فروشنده تأیید می‌شود؛ این مرحله هنوز انتقال مالکیت نیست.",
  evidence:"seller_confirmation_reference، confirmed_at، immutable_audit"},
 {code:"FEES_RESOLUTION_PENDING",title:"تعیین تکلیف هزینه‌های الزامی",owner:"COOPERATIVE",
  detail:"هزینه‌های مصوبِ همان معامله با برچسب قانونی/مصوب/خدماتی جدا می‌شوند و به حساب مجاز تعاونی می‌روند.",
  evidence:"fee_policy_snapshot، payer_mode، payment_receipts، waiver_decision_if_any"},
 {code:"READY_FOR_TRANSFER",title:"آمادگی تشریفات انتقال",owner:"COOPERATIVE",
  detail:"فقط پس از رفع موانع و اختلاف‌های باز و تکمیل شروط لازم می‌توان وقت انتقال تعیین کرد.",
  evidence:"buyer_eligible، board_valid، payment_confirmed، fees_resolved، no_open_dispute"},
 {code:"APPOINTMENT_PENDING",title:"در انتظار تعیین وقت",owner:"COOPERATIVE",
  detail:"وقت و مدارک لازم تعیین می‌شوند؛ ارسال اعلان بدون تأیید قانونی، تکمیل تشریفات نیست.",
  evidence:"appointment_request، transfer_document_checklist"},
 {code:"APPOINTMENT_SET",title:"وقت انتقال مشخص شده",owner:"COOPERATIVE",
  detail:"زمان، محل، مدارک و راهنمای حضور طرفین ثبت می‌شود؛ عدم حضور لغو خودکار نیست.",
  evidence:"appointment_time، location_reference، required_documents"},
 {code:"TRANSFER_FORMALITIES",title:"انجام تشریفات انتقال",owner:"SELLER",
  detail:"تشریفات رسمی و مدارک طرفین بررسی می‌شوند و در صورت وجود اختلاف پرونده متوقف می‌ماند.",
  evidence:"presence_and_document_refs، formalities_checklist"},
 {code:"REGISTER_ENTRY_PENDING",title:"انتظار ثبت دفتر سهام",owner:"COOPERATIVE",
  detail:"پیش از تغییر مالکیت، مشخصات نقل‌وانتقال باید به مرجع دفتر رسمی سهم ارسال و بررسی شود.",
  evidence:"share_register_request، share_registrar_identity، separate_verifier"},
 {code:"REGISTER_RECORDED",title:"ثبت در دفتر سهام",owner:"COOPERATIVE",
  detail:"شماره، صفحه، ردیف و تاریخ ثبت باید معتبر و قابل ممیزی باشند؛ ثبت به‌تنهایی هنوز Finalization نیست.",
  evidence:"register_reference، register_number، page_number، row_number، registered_at"},
 {code:"FINAL_APPROVAL_PENDING",title:"کنترل تأیید نهایی",owner:"BOARD",
  detail:"تأیید معتبر هیئت‌مدیره، احراز خریدار، وصول، هزینه‌ها، ثبت دفتر و نبود اختلاف باید دوباره کنترل شوند.",
  evidence:"board_valid، eligibility_valid، payment_confirmed، fees_resolved، register_recorded"},
 {code:"FINALIZING",title:"تسویه اتمیک مالکیت",owner:"SYSTEM",
  detail:"فقط Backend مجاز است در یک تراکنش کنترل‌شده، مالکیت فروشنده را کسر و خریدار را افزایش دهد؛ هر خطا ROLLBACK.",
  evidence:"row_locks، immutable_ownership_ledger، audit_event، idempotency"},
 {code:"COMPLETED",title:"معامله تکمیل‌شده (فقط شبیه‌سازی)",owner:"NONE",
  detail:"در سامانه واقعی، مالکیت فقط پس از Finalization اتمیک ثبت‌شده منتقل می‌شود. این نمایش هیچ سهمی را منتقل نکرده است.",
  evidence:"trade_certificate، register_reference، transfer_event، ruleset_version"}
];
export const SALE_MODE="FULL_OFFER" as const;
export const SOURCE_SPEC="TTO-SHARE-MARKET-SPEC v3.0" as const;
export const FLOW_INFO={
 SELL:"درخواست فروش → کنترل صلاحیت → قفل سهم → صف FIFO و ETA → قیمت مرجع → تابلو",
 BUY:"درخواست خرید → رزرو → بررسی → تأیید مستقل هیئت‌مدیره → ادامه فروشنده → پرداخت مستقیم → دفتر سهام → Finalization"
} as const;
