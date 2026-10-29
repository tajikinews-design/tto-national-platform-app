"use client";
import {useRef,useState} from "react";
import {NAV10_SECTIONS,NAV10_FIXTURES,NAV10_INVARIANTS,type Nav10Section,type Nav10Mode} from "./report-fixtures";
/** NAV10: review-only canonical eight categories; never reads person, tenant or payment data. */
const ROOTS=[
 ["⌂","داشبورد","/review/interactive"],
 ["♙","سهام و عضویت من","/review/interactive/nav-02"],
 ["▥","خرید و فروش سهام","/review/interactive/nav-03"],
 ["♜","مجامع و انتخابات","/review/interactive/nav-04"],
 ["▣","اخبار و ارتباط با شرکت","/review/interactive/nav-05"],
 ["⚙","خدمات من","/review/interactive/nav-06"],
 ["▣","فروشگاه و فرصت‌ها","/review/interactive/nav-07"],
 ["▤","پروژه‌های شرکت","/review/interactive/nav-08"],
 ["◇","شفافیت و اسناد شرکت","/review/interactive/nav-09"],
 ["▥","گزارش‌های من","/review/interactive/nav-10"],
 ["⚙","تنظیمات حساب","/review/interactive/nav-11"]
] as const;




function Sidebar(){
 const [expanded,setExpanded]=useState(false);
 return <aside className={"w1a-sidebar"+(expanded?" w1a-mobile-menu-open":"")} aria-label="منوی پنل سهامدار" onKeyDown={event=>{if(event.key==="Escape")setExpanded(false);}}>
  <div className="w1a-brand">
   <span className="w1a-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="44" height="44" focusable="false"><path d="M26 4C34 4 42 2 45 0v19c-7 3-12 9-17 14L26 4Z" fill="#204a81"/><path d="M22 4C13 4 6 7 2 12v12c7 0 13 4 20 10V4Z" fill="#19b6bc"/><path d="M2 27c8-2 14 2 20 9v12C13 44 7 42 2 36V27Z" fill="#22ad78"/><path d="M26 37c5-10 12-14 19-16v13c-4 8-10 12-19 14V37Z" fill="#0a69ab"/></svg></span>
   <div><strong>پلتفرم ملی تعاونی توسعه و عمران</strong><small>شبکه هوشمند خدمات و راهبری تعاونی‌ها</small></div>
  </div>
  <button type="button" className="w1a-mobile-menu-toggle" aria-controls="w1a-side-nav" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><span aria-hidden="true">☰</span>بخش‌های پنل</button>
  <nav id="w1a-side-nav" className="w1a-side-links" aria-label="یازده بخش مصوب پنل">
   {ROOTS.map(([icon,label,href],index)=><a key={label} href={href} className={"w1a-side-link"+(index===9?" w1a-active":"")} aria-current={index===9?"page":undefined}>
    <span aria-hidden="true" className="w1a-side-icon">{icon}</span><span>{label}</span></a>)}
  </nav>
  <div className="w1a-sidebar-foot">پنل بازبینی · گزارش و PDF واقعی غیرفعال</div>
 </aside>;
}
function Header(){
 return <div className="w1a-global-header">
  <div className="w1a-cooperative-switch" aria-label="تعاونی انتخاب‌شده ـ فقط نمایشی" aria-disabled="true">
   <span aria-hidden="true" className="w1a-coop-icon">▦</span><span>تعاونی توسعه و عمران شهرستان نمونه</span><span aria-hidden="true">⌄</span>
  </div>
  <div className="w1a-global-user">
   <span className="w1a-header-icon" aria-label="پیام‌ها ـ غیرفعال"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span>
   <span className="w1a-header-icon w1a-bell" aria-label="اعلان‌ها ـ غیرفعال"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg></span>
   <span className="w1a-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span>
   <div><strong>سهامدار نمونه</strong><small>پنل بازبینی · داده غیرعملیاتی</small></div>
  </div>
 </div>;
}




const MODES:readonly {id:Nav10Mode;label:string;description:string}[]=[
 {id:"UNVERIFIED",label:"منبع معتبر تأیید نشده",description:"هیچ داده شخصی رسمی احراز نشده است؛ نامعلوم به معنی صفر نیست."},
 {id:"SOURCE_UNAVAILABLE",label:"منبع در دسترس نیست",description:"اختلال منبع به معنی حذف سوابق، تسویه یا تأیید نتیجه نیست."},
 {id:"ACCESS_DENIED",label:"دسترسی مجاز نیست",description:"مشاهده داده شخصی، دامنه تعاونی و دانلود هر یک مجوز مستقل می‌خواهند."},
 {id:"DEMO_CONTENT",label:"نمونه کاملاً ساختگی",description:"۱۶ رکورد فرضی؛ فقط برای بازبینی طراحی و بدون اثر قانونی یا عملیاتی."}
];
const CATEGORY_GROUPS=[
 {heading:"سهام و مبادلات",ids:["SHARES","TRADES","PAYMENTS"] as Nav10Section[]},
 {heading:"خدمات و تجربه سهامدار",ids:["ORDERS","BENEFITS","LEARNING"] as Nav10Section[]},
 {heading:"سوابق و دریافت گزارش",ids:["ACTIVITY","PDF"] as Nav10Section[]}
];
export function SyntheticReports(){
 const [mode,setMode]=useState<Nav10Mode>("UNVERIFIED");
 const [section,setSection]=useState<Nav10Section>("SHARES");
 const [query,setQuery]=useState("");
 const [detailId,setDetailId]=useState<string|null>(null);
 const catalogRef=useRef<HTMLElement>(null),detailRef=useRef<HTMLElement>(null);
 const demo=mode==="DEMO_CONTENT";
 const selected=NAV10_SECTIONS.find(x=>x.id===section)!;
 const items=demo?NAV10_FIXTURES.filter(x=>x.category===section&&(x.title.includes(query.trim())||x.summary.includes(query.trim())||x.id.includes(query.trim()))):[];
 const detail=demo?NAV10_FIXTURES.find(x=>x.id===detailId&&x.category===section):undefined;
 function navigate(id:Nav10Section,selectId?:string){
  setSection(id);setQuery("");setDetailId(selectId??null);
  requestAnimationFrame(()=>catalogRef.current?.scrollIntoView({block:"start"}));
 }
 function switchMode(next:Nav10Mode){setMode(next);setQuery("");setDetailId(null);}
 return <main className="w1a-shell nav06-shell nav07-shell nav08-shell nav09-shell nav10-shell" dir="rtl" lang="fa" data-source-mode={mode}>
  <Sidebar/>
  <div className="w1a-frame nav06-frame">
   <Header/>
   <header className="w1a-page-heading"><div><h1>گزارش‌های من</h1><p>مرکز مشاهده گزارش‌های شخصی · اطلاعات معتبر فقط پس از پذیرش منبع قانونی</p></div><span>W1 / NAV-10 · نسخه بازبینی</span></header>
   <section className="nav06-hero nav09-hero nav10-hero" aria-label="معرفی گزارش‌های من">
    <div className="nav06-hero-copy"><span className="nav06-hero-eyebrow">گزارش و هوشمندی · نسخه نمایشی غیرعملیاتی</span>
     <h2>سوابق و گزارش‌ها، از منبع مسئول و فقط با مجوز</h2>
     <p>گزارش سهام، معاملات، پرداخت‌ها، خریدها و فعالیت‌ها از ماژول مسئول می‌آیند. این صفحه هیچ گزارش شخصی واقعی نمی‌سازد و دفتر حسابداری نیست.</p>
     <button className="nav06-primary" type="button" onClick={()=>catalogRef.current?.scrollIntoView({block:"start"})}>مشاهده دسته‌بندی‌ها ←</button>
    </div>
    <div className="nav06-hero-art" aria-hidden="true"><div className="nav06-hero-card"><span>▥</span><i/><i/><i/></div><div className="nav06-hero-badge">✦</div></div>
   </section>
   <section className="w1a-kpi-row nav06-kpi" aria-label="خلاصه غیرعملیاتی گزارش‌ها">
    {([
      ["گزارش سهام من","SHARES","♙","w1a-kpi-sky"],
      ["تاریخچه معاملات","TRADES","▥","w1a-kpi-lilac"],
      ["خریدهای فروشگاه","ORDERS","▣","w1a-kpi-apricot"],
      ["دوره‌ها و رویدادها","LEARNING","◇","w1a-kpi-mint"]
    ] as const).map(([name,id,icon,color])=><article className={"w1a-kpi "+color} key={id}>
     <span className="w1a-kpi-icon" aria-hidden="true">{icon}</span>
     <div><h3>{name}</h3><strong>{demo?NAV10_FIXTURES.filter(x=>x.category===id).length.toLocaleString("fa-IR"):"—"}</strong>
      <small>{demo?"تعداد نمونه‌های کاملاً فرضی":"وضعیت واقعی نامعلوم"}</small></div>
    </article>)}
   </section>
   <section className="w1a-four-panels nav06-overview" aria-label="مرور دسته‌بندی گزارش‌ها">
    {(["SHARES","PAYMENTS","BENEFITS","ACTIVITY"] as const).map(id=>{
      const entry=NAV10_SECTIONS.find(x=>x.id===id)!;
      return <article className="w1a-summary-panel" key={id}>
       <div className="w1a-panel-heading"><h3>{entry.label}</h3><button type="button" onClick={()=>navigate(id)}>مشاهده همه ←</button></div>
       {demo?NAV10_FIXTURES.filter(x=>x.category===id).map(item=><button key={item.id} className="nav06-preview-item" type="button" onClick={()=>navigate(id,item.id)}>
        <span className="w1a-file-icon" aria-hidden="true">▤</span><span><strong>{item.title}</strong><small>{item.processState} · کاملاً فرضی</small></span>
       </button>):<div className="nav06-none"><strong>—</strong><span>گزارش معتبر و دارای مجوز دریافت نشده است</span></div>}
       <p className="w1a-panel-tip">منبع مستقل، مجوز و نسخه برای اطلاعات واقعی ضروری است.</p>
      </article>;
    })}
   </section>
   <section className="w1a-actions-row nav06-shortcuts" aria-label="میانبر گزارش‌ها">
    {(["SHARES","TRADES","ORDERS","PDF"] as const).map((id,index)=>{
      const entry=NAV10_SECTIONS.find(x=>x.id===id)!;
      const colors=["w1a-action-blue","w1a-action-green","w1a-action-orange","w1a-action-purple"];
      return <button type="button" className={"w1a-action "+colors[index]} key={id} onClick={()=>navigate(id)}>
       <span aria-hidden="true">▥</span><div><strong>{entry.label}</strong><small>مشاهده نمونه و محدودیت‌ها</small></div><span aria-hidden="true">←</span>
      </button>;
    })}
   </section>
   <section className="nav06-catalog" ref={catalogRef} id="nav10-section-catalog" aria-label="هشت زیرمنوی مصوب گزارش‌های من">
    <div className="nav06-title-row"><div><span>Navigation v1.0 · هشت زیرمنوی مصوب</span><h2>گزارش‌های من</h2></div><small>۸ زیرمنو · فقط طراحی آزمایشی</small></div>
    <div className="nav06-groups nav10-groups">{CATEGORY_GROUPS.map(group=><div key={group.heading} className="nav06-group"><h3>{group.heading}</h3><div className="nav06-group-links">
     {group.ids.map(id=>{const entry=NAV10_SECTIONS.find(x=>x.id===id)!;
      return <button type="button" key={id} aria-pressed={section===id} className={"nav06-section-button"+(section===id?" nav06-selected":"")} onClick={()=>navigate(id)}>{entry.label}</button>;
     })}</div></div>)}</div>
    <div className="nav06-title-row nav06-content-title"><div><span>مالک منبع: {selected.owner} · هیچ اتصال عملیاتی فعال نیست</span><h2>{selected.label}</h2></div><span className="nav06-notice">{demo?"داده کاملاً ساختگی":"منبع تأیید نشده"}</span></div>
    <section className="nav10-mode-panel" aria-label="وضعیت منبع گزارش">
     <p>وضعیت دسترسی و منبع · پیش‌فرض ایمن: بدون اطلاعات</p>
     <div className="nav10-mode-buttons">{MODES.map(item=><button type="button" key={item.id} aria-pressed={mode===item.id} onClick={()=>switchMode(item.id)}>{item.label}</button>)}</div>
     <p role="status">{MODES.find(x=>x.id===mode)!.description}</p>
    </section>
    <div className="nav06-search"><label htmlFor="nav10-search">جست‌وجو</label>
     <input id="nav10-search" type="search" value={query} onChange={event=>{setQuery(event.target.value);setDetailId(null);}} placeholder="عنوان یا شناسه گزارش نمونه" disabled={!demo}/>
     <span>{demo?"فقط در داده‌های ساختگی جست‌وجو می‌شود":"جست‌وجوی داده واقعی مسدود است"}</span>
    </div>
    {items.length?<div className="nav06-grid">{items.map(item=><article className="nav06-tile" key={item.id}>
      <span className="nav06-tag">نمونه غیررسمی</span><h3>{item.title}</h3><p>{item.summary}</p>
      <div className="nav06-tile-foot"><small>{item.id}</small><small>{item.processState}</small></div>
      <button type="button" onClick={()=>{setDetailId(item.id);requestAnimationFrame(()=>{detailRef.current?.focus();detailRef.current?.scrollIntoView({block:"nearest"});});}}>مشاهده جزئیات ←</button>
     </article>)}</div>:<div className="nav06-empty"><strong>—</strong><p>{!demo?"تا پذیرش منبع و حق دسترسی، گزارش شخصی ارائه نمی‌شود.":query?"نمونه‌ای مطابق جست‌وجو یافت نشد.":"نمونه‌ای در این دسته وجود ندارد."}</p></div>}
    {detail?<section className="nav10-detail" ref={detailRef} tabIndex={-1} aria-label="جزئیات نمونه گزارش">
     <h3>{detail.title}</h3><p>{detail.summary}</p><dl><div><dt>شناسه فرضی</dt><dd>{detail.id}</dd></div>
      <div><dt>دسته</dt><dd>{selected.label}</dd></div><div><dt>وضعیت نمایشی</dt><dd>{detail.processState}</dd></div>
      <div><dt>تاریخ</dt><dd>{detail.dateLabel}</dd></div></dl>
     <p>مجوز انتشار: ندارد · منبع معتبر: ندارد · PDF: غیرفعال</p>
     <button type="button" onClick={()=>setDetailId(null)}>بستن جزئیات</button>
    </section>:null}
   </section>
   <section className="nav10-guardrails" aria-label="محدودیت‌های قطعی گزارش">
    <h2>اصول معتبرسازی گزارش‌ها</h2><ul>{NAV10_INVARIANTS.map(rule=><li key={rule}>{rule}</li>)}</ul>
   </section>
  </div>
 </main>;
}
