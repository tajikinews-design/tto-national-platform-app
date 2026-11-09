"use client";
import {useEffect,useState,type FormEvent} from "react";
import {COOPERATIVE_MODULES,SettingsPageFrame,SettingsCard,SettingsNotice} from "./settings-shell";
type Staff={id:string;username:string;displayName:string;permissions:string[];state:"ACTIVE"|"DISABLED"};
type OwnerWorkspace={slug:string;tenantActive:boolean;staff?:boolean};
const NAV_IDS=COOPERATIVE_MODULES.map(([id])=>id);
export function UsersSettings({slug}:{slug:string}){
 const [loading,setLoading]=useState(true),[allowed,setAllowed]=useState(false);
 const [members,setMembers]=useState<Staff[]>([]),[status,setStatus]=useState("");
 const [statusType,setStatusType]=useState<"error"|"success">("success"),[busy,setBusy]=useState(false);
 const [name,setName]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[repeat,setRepeat]=useState("");
 const [visible,setVisible]=useState(false),[permissions,setPermissions]=useState<string[]>(["NAV-01"]);
 const [editing,setEditing]=useState<Staff|null>(null);
 const activeCount=members.filter(x=>x.state==="ACTIVE").length;
 const selectedCount=permissions.length;
 async function loadTeam(){
  const res=await fetch("/api/commerce/team?slug="+encodeURIComponent(slug),
   {credentials:"same-origin",cache:"no-store"});
  if(!res.ok)throw Error("دریافت فهرست کاربران در دسترس نیست یا مجوز مالکیت تأیید نشده است.");
  const data=await res.json() as {items?:Staff[]};
  if(!Array.isArray(data.items))throw Error("پاسخ فهرست کاربران معتبر نیست.");
  setMembers(data.items);
 }
 useEffect(()=>{
  let live=true;
  async function load(){
   try{
    const r=await fetch("/api/commerce/workspaces",{credentials:"same-origin",cache:"no-store"});
    if(!r.ok)throw Error("LOGIN");
    const data=await r.json() as {items?:OwnerWorkspace[]};
    const own=data.items?.some(x=>x.slug===slug&&x.tenantActive===true&&x.staff!==true);
    if(!own)throw Error("OWNER");
    if(live)setAllowed(true);
    await loadTeam();
   }catch(e){
    if(live){setAllowed(false);setStatusType("error");setStatus(
     e instanceof Error&&e.message!=="OWNER"&&e.message!=="LOGIN"?
      e.message:"مدیریت کاربران فقط برای مالک تأییدشده همین فضای تعاونی قابل انجام است.")}
   }finally{if(live)setLoading(false)}
  }
  void load();return()=>{live=false};
 },[slug]);
 function toggle(id:string){
  if(id==="NAV-01")return;
  setPermissions(old=>old.includes(id)?old.filter(x=>x!==id):NAV_IDS.filter(x=>old.includes(x)||x===id));
 }
 function reset(){
  setEditing(null);setPermissions(["NAV-01"]);setUsername("");setName("");setPassword("");setRepeat("");
 }
 function edit(member:Staff){
  setEditing(member);setPermissions(NAV_IDS.filter(x=>x==="NAV-01"||member.permissions.includes(x)));
  setStatus("");document.getElementById("tto-user-access-form")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!allowed||permissions.length===0)return;
  if(!permissions.includes("NAV-01")){setStatusType("error");setStatus("مجوز داشبورد باید فعال باشد.");return}
  if(!editing&&(password.length<14||password!==repeat)){
   setStatusType("error");setStatus("رمز اولیه باید دست‌کم ۱۴ نویسه و با تکرار آن یکسان باشد.");return;
  }
  setBusy(true);setStatus("");
  try{
   const body=editing?
    {action:"update",slug,id:editing.id,state:editing.state,permissions}:
    {action:"create",slug,username:username.toLowerCase().trim(),displayName:name.trim(),password,permissions};
   const r=await fetch("/api/commerce/team",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!r.ok)throw Error(r.status===403?"مدیریت کاربران فقط برای مالک همین فضای تعاونی مجاز است.":
    r.status===409?"این نام کاربری قبلاً ثبت شده است.":r.status===401?"نشست منقضی شده است؛ دوباره وارد شوید.":
    "ذخیره اطلاعات کاربر یا مجوزهای او تأیید نشد.");
   await loadTeam();setStatusType("success");
   setStatus(editing?"سطح دسترسی کاربر به‌روز شد و نشست‌های قبلی او باطل شدند.":"کاربر آزمایشی ایجاد شد و فقط ماژول‌های مجاز را می‌بیند.");
   reset();
  }catch(e){setStatusType("error");setStatus(e instanceof Error?e.message:"خطا در ذخیره کاربر")}
  finally{setBusy(false)}
 }
 async function changeState(member:Staff){
  if(busy||!allowed)return;
  setBusy(true);setStatus("");
  try{
   const r=await fetch("/api/commerce/team",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({
     action:"update",slug,id:member.id,
     state:member.state==="ACTIVE"?"DISABLED":"ACTIVE",permissions:member.permissions})});
   if(!r.ok)throw Error("تغییر وضعیت این کاربر تأیید نشد.");
   await loadTeam();setStatusType("success");
   setStatus("وضعیت کاربر ذخیره و نشست‌های قبلی او باطل شدند.");
   if(editing?.id===member.id)reset();
  }catch(e){setStatusType("error");setStatus(e instanceof Error?e.message:"خطا در تغییر وضعیت کاربر")}
  finally{setBusy(false)}
 }
 return <SettingsPageFrame slug={slug} section="users">
  <section className="tto-settings-access-stats" aria-label="خلاصه مدیریت کاربران">
   <div className="tto-settings-stat"><small>کاربران تعریف‌شده</small><strong>{members.length.toLocaleString("fa-IR")}</strong></div>
   <div className="tto-settings-stat"><small>حساب‌های فعال</small><strong>{activeCount.toLocaleString("fa-IR")}</strong></div>
   <div className="tto-settings-stat"><small>ماژول‌های قابل تخصیص</small><strong>{COOPERATIVE_MODULES.length.toLocaleString("fa-IR")}</strong></div>
  </section>
  <div className="tto-settings-grid">
   <div style={{display:"grid",gap:18}}>
    <SettingsCard title={editing?"ویرایش مجوزهای کاربر":"تعریف کاربر جدید"} icon="♧"
     subtitle={editing?"مجوزهای انتخاب‌شده را برای این کاربر ذخیره کنید؛ نشست‌های قبلی او باطل می‌شوند.":
      "برای هر همکار نام کاربری و رمز اختصاصی بسازید و دسترسی ماژول‌ها را مشخص کنید."}>
     {loading?<p role="status">در حال تأیید مجوز مالک و دریافت فهرست کاربران…</p>:null}
     {allowed?<form id="tto-user-access-form" onSubmit={submit}>
      <div className="tto-settings-fields">
       {editing?<div className="tto-settings-note" style={{gridColumn:"1/-1"}}>
        در حال تغییر دسترسی <strong>{editing.displayName}</strong> — <b dir="ltr">{editing.username}</b>
       </div>:<>
        <label className="tto-settings-field wide" htmlFor="staff-display-name">
         <span>نام و نام خانوادگی</span>
         <input id="staff-display-name" value={name} onChange={e=>setName(e.target.value)}
          minLength={3} maxLength={120} required placeholder="نام و نام خانوادگی همکار"/>
        </label>
        <label className="tto-settings-field" htmlFor="staff-username">
         <span>نام کاربری مستقل</span>
         <input id="staff-username" dir="ltr" autoComplete="off" pattern="staff_[a-z][a-z0-9._-]{4,58}"
          required placeholder="staff_operator01" value={username}
          onChange={e=>setUsername(e.target.value.toLowerCase().trim())}/>
         <span className="tto-settings-help">باید با staff_ شروع شود و حداقل ۵ نویسه پس از آن داشته باشد.</span>
        </label>
        <label className="tto-settings-field" htmlFor="staff-password">
         <span>رمز ورود اولیه</span>
         <div className="tto-settings-input-wrap">
          <input id="staff-password" dir="ltr" autoComplete="new-password" type={visible?"text":"password"}
           minLength={14} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/>
          <button type="button" className="tto-settings-eye" onClick={()=>setVisible(v=>!v)}
           aria-label={visible?"پنهان‌کردن رمز":"نمایش رمز"}>{visible?"پنهان":"نمایش"}</button>
         </div>
        </label>
        <label className="tto-settings-field wide" htmlFor="staff-repeat">
         <span>تکرار رمز ورود اولیه</span>
         <input id="staff-repeat" dir="ltr" autoComplete="new-password" type={visible?"text":"password"}
          minLength={14} maxLength={128} required value={repeat} onChange={e=>setRepeat(e.target.value)}/>
         {repeat?<span className="tto-settings-help">{repeat===password?"✓ رمزها برابر هستند":"رمزها با یکدیگر مطابقت ندارند."}</span>:null}
        </label>
       </>}
      </div>
      <div className="tto-settings-section-line"/>
      <div className="tto-settings-matrix-toolbar">
       <div><h3>تعیین سطح دسترسی ماژول‌ها</h3>
        <span className="tto-settings-pill">{selectedCount.toLocaleString("fa-IR")} ماژول انتخاب شده</span></div>
       <div className="tto-settings-row-actions">
        <button type="button" onClick={()=>setPermissions([...NAV_IDS])}>انتخاب همه</button>
        <button type="button" onClick={()=>setPermissions(["NAV-01"])}>فقط داشبورد</button>
       </div>
      </div>
      <div className="tto-settings-matrix" role="group" aria-label="انتخاب ماژول‌های قابل مشاهده">
       {COOPERATIVE_MODULES.map(([id,label,description,icon])=><label key={id}
        className={"tto-settings-module-option"+(permissions.includes(id)?" chosen":"")+(id==="NAV-01"?" locked":"")}>
        <input type="checkbox" checked={permissions.includes(id)}
         disabled={id==="NAV-01"} onChange={()=>toggle(id)} aria-label={"دسترسی مشاهده "+label}/>
        <span aria-hidden="true">{icon}</span>
        <span><strong>{label}</strong><small>{description}</small></span>
       </label>)}
      </div>
      <p className="tto-settings-owner-warning">◈ مجوز داشبورد پایه و اجباری است. مجوزها فعلاً فقط «مشاهده ماژول» هستند و اختیار قانونی برای معامله، تأیید یا ویرایش پرونده‌ها ایجاد نمی‌کنند.</p>
      <div className="tto-settings-button-row">
       <button className="tto-settings-btn" type="submit" disabled={busy||!allowed}>
        {busy?"در حال ذخیره امن…":editing?"ثبت تغییرات دسترسی":"ایجاد کاربر و ثبت دسترسی‌ها"}
       </button>
       {editing?<button className="tto-settings-btn secondary" type="button" onClick={reset}>انصراف از ویرایش</button>:null}
      </div>
     </form>:!loading?<SettingsNotice type="error">برای تعریف کاربر و تغییر مجوزهای دیگران باید به‌عنوان مالک همین فضای تعاونی وارد شوید.</SettingsNotice>:null}
     {status?<div style={{marginTop:15}}><SettingsNotice type={statusType}>{status}</SettingsNotice></div>:null}
    </SettingsCard>
    <SettingsCard title="کاربران تعریف‌شده" subtitle="وضعیت و مجوزهای هر حساب را در همین صفحه مدیریت کنید." icon="▦">
     {loading?<p role="status">در حال دریافت کاربران…</p>:
      members.length===0?<SettingsNotice>هنوز کاربری برای این تعاونی تعریف نشده است.</SettingsNotice>:
      <div className="tto-settings-user-list">{members.map(member=>
       <article className="tto-settings-user-row" key={member.id}>
        <div className="tto-settings-user-id">
         <span className="tto-settings-avatar" aria-hidden="true">♧</span>
         <div><strong>{member.displayName}</strong><small>{member.username}</small>
          <span className={"tto-settings-pill "+(member.state==="ACTIVE"?"positive":"warning")}>
           {member.state==="ACTIVE"?"فعال":"غیرفعال"} · {member.permissions.length.toLocaleString("fa-IR")} ماژول
          </span>
         </div>
        </div>
        <div className="tto-settings-row-actions">
         <button type="button" disabled={busy||!allowed} onClick={()=>edit(member)}>ویرایش دسترسی</button>
         <button type="button" disabled={busy||!allowed} onClick={()=>void changeState(member)}>
          {member.state==="ACTIVE"?"غیرفعال‌کردن":"فعال‌کردن"}
         </button>
        </div>
       </article>)}</div>}
    </SettingsCard>
   </div>
   <div style={{display:"grid",gap:18}}>
    <SettingsCard title="راهنمای مدیریت دسترسی" subtitle="هر حساب، محدوده و دسترسی مستقل دارد." icon="◇">
     <div className="tto-settings-tip"><span>♙</span><div><strong>دسترسی مختص همین تعاونی</strong>
      <small>کاربر ایجادشده به اطلاعات تعاونی‌های دیگر دسترسی نخواهد داشت.</small></div></div>
     <div className="tto-settings-tip"><span>✓</span><div><strong>انتخاب ماژول‌ها</strong>
      <small>فقط ماژول‌هایی که انتخاب می‌کنید در منوی کاربر نمایش داده می‌شوند.</small></div></div>
     <div className="tto-settings-tip"><span>⌁</span><div><strong>ابطال فوری نشست قدیمی</strong>
      <small>با تغییر مجوز یا غیرفعال‌کردن کاربر، نشست‌های قبلی او باطل می‌شوند.</small></div></div>
    </SettingsCard>
    <SettingsCard title="محدوده دسترسی آزمایشی" subtitle="مرز امکانات فعال و غیرفعال در این مرحله" icon="⚙">
     <p><span className="tto-settings-pill positive">✓ مشاهده ماژول‌های انتخاب‌شده</span></p>
     <p><span className="tto-settings-pill warning">◷ ثبت، ویرایش و تأیید رسمی غیرفعال</span></p>
     <p>حق رأی، مالکیت سهام، واگذاری نقش مدیر قانونی و اقدامات مالی به تعریف کاربر جدید وابسته نیستند.</p>
    </SettingsCard>
   </div>
  </div>
 </SettingsPageFrame>;
}
