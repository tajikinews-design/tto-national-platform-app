"use client";
import {useEffect,useId,useRef,useState} from "react";
type Person={id:string;name:string;identifierMask:string};
export function OfficerMemberPicker({slug,value,initialLabel,onChange,disabled=false}:{
 slug:string;value:string;initialLabel?:string;disabled?:boolean;
 onChange:(id:string,label:string)=>void;
}){
 const id=useId(),root=useRef<HTMLDivElement|null>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const [label,setLabel]=useState(initialLabel??"");
 const [items,setItems]=useState<Person[]>([]),[more,setMore]=useState(false);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [active,setActive]=useState(0);
 useEffect(()=>{if(value&&initialLabel)setLabel(initialLabel);if(!value)setLabel("");},[value,initialLabel]);
 useEffect(()=>{
  if(!open||disabled)return;
  const q=query.trim();
  if(q.length===1){setItems([]);setMore(false);setLoading(false);setError("");return}
  const ctrl=new AbortController();
  const timer=window.setTimeout(()=>{
   setLoading(true);setError("");
   const url="/api/commerce/nav02/officers/member-search?slug="+encodeURIComponent(slug)+"&q="+encodeURIComponent(q);
   void fetch(url,{credentials:"same-origin",cache:"no-store",signal:ctrl.signal})
    .then(async r=>{
     if(!r.ok)throw Error(r.status===401?"نشست ورود منقضی شده است.":r.status===403?
      "دسترسی انتخاب عضو وجود ندارد.":"جست‌وجوی سرور در دسترس نیست.");
     return r.json() as Promise<{items:Person[];more:boolean}>;
    }).then(r=>{if(!ctrl.signal.aborted){setItems(r.items);setMore(r.more);setActive(0)}})
    .catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:"خطای جست‌وجو")})
    .finally(()=>{if(!ctrl.signal.aborted)setLoading(false)});
  },q.length?280:50);
  return()=>{window.clearTimeout(timer);ctrl.abort()};
 },[slug,query,open,disabled]);
 useEffect(()=>{
  if(!open)return;
  function outside(ev:MouseEvent){
   if(root.current&&!root.current.contains(ev.target as Node))setOpen(false);
  }
  document.addEventListener("mousedown",outside);
  return()=>document.removeEventListener("mousedown",outside);
 },[open]);
 function pick(p:Person){
  onChange(p.id,p.name);setLabel(p.name);setQuery("");setOpen(false);setError("");
 }
 const shown=open?query:label;
 return <div className="tto-officer-member-picker" ref={root}>
  <label htmlFor={id}>انتخاب عضو تعاونی *</label>
  <div className="tto-officer-member-combobox">
   <input id={id} type="text" role="combobox" autoComplete="off"
    aria-autocomplete="list" aria-controls={id+"-list"} aria-expanded={open}
    aria-activedescendant={open&&items[active]?id+"-item-"+active:undefined}
    value={shown} disabled={disabled} placeholder="برای جست‌وجو روی این باکس کلیک کنید"
    onFocus={()=>{setQuery("");setOpen(true)}}
    onChange={e=>{setQuery(e.target.value);setActive(0);if(value){onChange("","");setLabel("")}setOpen(true)}}
    onKeyDown={e=>{
     if(e.key==="Escape"){setOpen(false);return}
     if(e.key==="ArrowDown"){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(items.length-1,n+1)))}
     if(e.key==="ArrowUp"){e.preventDefault();setActive(n=>Math.max(0,n-1))}
     if(e.key==="Enter"&&open&&items[active]){e.preventDefault();pick(items[active])}
    }}/>
   <span aria-hidden="true">⌕</span>
   {value?<button type="button" aria-label="پاک کردن عضو انتخاب‌شده"
    onClick={()=>{onChange("","");setLabel("");setQuery("");setOpen(true)}}>×</button>:null}
  </div>
  {open?<div id={id+"-list"} role="listbox" className="tto-officer-member-results"
    aria-label="اعضای قابل انتخاب تعاونی">
   {loading?<p role="status">در حال جست‌وجو در پایگاه داده…</p>:
    error?<p role="alert">{error}</p>:
    query.trim().length===1?<p>برای جست‌وجو حداقل دو حرف وارد کنید.</p>:
    !items.length?<p>عضوی با این مشخصات یافت نشد.</p>:
    items.map((p,i)=><button type="button" role="option" id={id+"-item-"+i}
     aria-selected={i===active} key={p.id} onMouseDown={e=>e.preventDefault()}
     onClick={()=>pick(p)}><strong>{p.name}</strong><small>{p.identifierMask}</small></button>)}
   {more?<p>نتیجه‌های بیشتری وجود دارد؛ برای جست‌وجوی دقیق‌تر نام را وارد کنید.</p>:null}
  </div>:null}
  {value?<small className="tto-officer-selected">عضو انتخاب‌شده: {label||"پرونده ثبت‌شده"}</small>:null}
 </div>;
}
