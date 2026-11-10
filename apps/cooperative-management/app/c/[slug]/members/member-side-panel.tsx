"use client";
import {useId,useState} from "react";

export type MemberSidebarInput={
 photo:File|null;
 photoUrl:string;
 onPhoto:(file:File|null)=>void;
 collection:string;
 onCollection:(value:string)=>void;
 collections:string[];
 occupation:string;
 onOccupation:(value:string)=>void;
 attachmentSubject:string;
 attachment:File|null;
 onAttachmentSubject:(value:string)=>void;
 onAttachment:(file:File|null)=>void;
 numberText?:string;
};
export function MemberSidebar(p:MemberSidebarInput){
 const [newCollection,setNewCollection]=useState("");
 const [createOpen,setCreateOpen]=useState(false);
 const [collectionNotice,setCollectionNotice]=useState("");
 const photoId=useId(),attachmentId=useId();
 const all=[...new Set([...p.collections,p.collection].filter(Boolean))];
 return <aside className="tto-member-sidebar" aria-label="تصویر، مجموعه، شغل و ضمائم عضو">
  <section className="tto-member-side-section tto-member-side-portrait">
   <h2>تصویر عضو</h2>
   <div className="tto-member-avatar-frame">
    {p.photoUrl?<img src={p.photoUrl} alt="پیش‌نمایش عکس پرسنلی انتخاب‌شده"/>:
     <span role="img" aria-label="بدون تصویر" className="tto-member-avatar-placeholder">♙</span>}
   </div>
   <div className="tto-member-inline-links">
    <label htmlFor={photoId} className="tto-member-upload-link">تغییر تصویر</label>
    <input id={photoId} className="tto-member-hidden-file" type="file"
     accept="image/png,image/jpeg,image/webp"
     onChange={e=>{
      const f=e.currentTarget.files?.[0]??null;
      if(!f)return;
      if(!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>716800){
       setCollectionNotice("عکس باید PNG، JPEG یا WebP و حداکثر ۷۰۰ کیلوبایت باشد.");
       e.currentTarget.value="";return;
      }
      setCollectionNotice("");p.onPhoto(f);
     }}/>
    <button type="button" onClick={()=>p.onPhoto(null)} disabled={!p.photo}>حذف عکس</button>
   </div>
   <small>تصویر انتخاب‌شده فقط پیش‌نمایش محلی است؛ انتشار منوط به اسکن امن است.</small>
  </section>
  <section className="tto-member-side-section">
   <h2>شماره عضویت</h2>
   <output className="tto-member-number-output" dir="ltr">{p.numberText||"پس از ثبت امن صادر می‌شود"}</output>
   <small>شماره یکتا پس از تخصیص قطعی، تغییر یا تخصیص مجدد نخواهد داشت.</small>
  </section>
  <section className="tto-member-side-section">
   <h2>مجموعه عضو</h2>
   <label className="tto-member-small-label" htmlFor="tto-member-collection">تغییر به مجموعه</label>
   <select id="tto-member-collection" value={p.collection}
    onChange={e=>p.onCollection(e.target.value)}>
    <option value="">بدون مجموعه</option>
    {all.map(name=><option value={name} key={name}>{name}</option>)}
   </select>
   <button className="tto-member-link-button" type="button" onClick={()=>setCreateOpen(v=>!v)}>
    {createOpen?"بستن ایجاد مجموعه":"＋ افزودن مجموعه"}
   </button>
   {createOpen?<div className="tto-member-side-add">
    <label htmlFor="tto-new-collection">نام مجموعه</label>
    <input id="tto-new-collection" placeholder="مانند: شهرداری طرقبه" maxLength={100}
     value={newCollection} onChange={e=>setNewCollection(e.target.value)}/>
    <button type="button" onClick={()=>{
     const trimmed=newCollection.trim();
     if(trimmed.length<3){setCollectionNotice("نام مجموعه حداقل سه حرف باشد.");return;}
     p.onCollection(trimmed);setNewCollection("");setCreateOpen(false);
     setCollectionNotice("مجموعه برای این فرم انتخاب شد؛ ثبت در دفتر مجموعه‌ها نیازمند اتصال امن سرویس است.");
    }}>انتخاب مجموعه جدید</button>
   </div>:null}
   {collectionNotice?<small role="status">{collectionNotice}</small>:null}
  </section>
  <section className="tto-member-side-section">
   <h2>حوزه فعالیت (شغل)</h2>
   <input type="text" maxLength={120} placeholder="مانند: کارمند شهرداری"
    value={p.occupation} onChange={e=>p.onOccupation(e.target.value)}/>
  </section>
  <section className="tto-member-side-section">
   <h2>ضمائم پرونده</h2>
   <label className="tto-member-small-label" htmlFor="tto-member-attachment-subject">موضوع:</label>
   <input id="tto-member-attachment-subject" maxLength={120} value={p.attachmentSubject}
    placeholder="موضوع مدرک" onChange={e=>p.onAttachmentSubject(e.target.value)}/>
   <label className="tto-member-small-label" htmlFor={attachmentId}>انتخاب فایل:</label>
   <input id={attachmentId} type="file" accept="application/pdf,image/png,image/jpeg"
    onChange={e=>p.onAttachment(e.currentTarget.files?.[0]??null)}/>
   {p.attachment?<small>{p.attachment.name} — فایل هنوز به سرور ارسال نشده است.</small>:null}
   {p.attachment?<button type="button" className="tto-member-link-button"
    onClick={()=>p.onAttachment(null)}>حذف فایل انتخابی</button>:null}
   <small>ارسال و نگهداری ضمائم مستلزم قرنطینه، کنترل دسترسی و اسکن فایل است.</small>
  </section>
 </aside>;
}
