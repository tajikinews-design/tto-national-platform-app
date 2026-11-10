"use client";
import {useMemo,useState} from "react";

// Persian calendar supplied by ICU/Intl; no Gregorian date input is exposed.
// The chosen date is stored as YYYY/MM/DD in the Jalali calendar.
const months=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
 "مهر","آبان","آذر","دی","بهمن","اسفند"];
const weekdays=["ش","ی","د","س","چ","پ","ج"];
const oneDay=86400000;
const fmt=new Intl.DateTimeFormat("en-US-u-ca-persian",{
 timeZone:"UTC",year:"numeric",month:"numeric",day:"numeric"
});
function parts(date:Date){
 const p=fmt.formatToParts(date);
 const get=(type:string)=>Number(p.find(x=>x.type===type)?.value);
 return {y:get("year"),m:get("month"),d:get("day")};
}
function firstDay(y:number){
 if(!Number.isInteger(y)||y<1250||y>1600)throw Error("INVALID_YEAR");
 const gregorian=y+621;
 for(let d=18;d<=23;d++){
  const dt=new Date(Date.UTC(gregorian,2,d));
  const p=parts(dt);if(p.y===y&&p.m===1&&p.d===1)return dt.getTime();
 }
 throw Error("UNSUPPORTED_PERSIAN_YEAR");
}
function lengthOfMonth(y:number,m:number){
 if(m<=6)return 31;if(m<12)return 30;
 return (firstDay(y+1)-firstDay(y))/oneDay===366?30:29;
}
function canonical(value:string){
 const p=/^(1[2-5][0-9]{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.exec(value);
 if(!p)return null;
 const y=Number(p[1]),m=Number(p[2]),d=Number(p[3]);
 try {return d<=lengthOfMonth(y,m)?{y,m,d}:null}catch{return null}
}
export function JalaliBirthDatePicker({value,onChange}:{
 value:string;onChange:(value:string)=>void
}){
 const today=parts(new Date());
 const selected=canonical(value);
 const [open,setOpen]=useState(false);
 const [view,setView]=useState(()=>({y:selected?.y??Math.max(1250,today.y-25),
  m:selected?.m??1}));
 const days=useMemo(()=>{
  try{
   const count=lengthOfMonth(view.y,view.m);
   const preceding=Array.from({length:view.m-1},(_,i)=>lengthOfMonth(view.y,i+1))
    .reduce((a,b)=>a+b,0);
   const first=new Date(firstDay(view.y)+preceding*oneDay).getUTCDay();
   const offset=(first+1)%7; // Saturday begins the Iranian week
   return {count,offset};
  }catch{return {count:0,offset:0}}
 },[view.y,view.m]);
 function go(delta:number){
  setView(v=>{
   const whole=(v.y*12)+(v.m-1)+delta;
   const y=Math.floor(whole/12),m=whole%12+1;
   return y>=1250&&y<=today.y?{y,m}:v;
  });
 }
 function choose(day:number){
  if(view.y===today.y&&(view.m>today.m||(view.m===today.m&&day>today.d)))return;
  onChange(String(view.y).padStart(4,"0")+"/"+String(view.m).padStart(2,"0")+
   "/"+String(day).padStart(2,"0"));
  setOpen(false);
 }
 return <div className="tto-nav02-jalali" dir="rtl">
  <button className="tto-nav02-calendar-trigger" type="button"
   aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(x=>!x)}>
   <span>{selected?`${selected.y}/${String(selected.m).padStart(2,"0")}/${String(selected.d).padStart(2,"0")}`:"انتخاب تاریخ تولد (شمسی)"}</span>
   <span aria-hidden="true">▦</span>
  </button>
  {open?<div className="tto-nav02-calendar-pop" role="dialog" aria-label="انتخاب تاریخ تولد شمسی">
   <div className="tto-nav02-calendar-controls">
    <button type="button" onClick={()=>go(-1)} aria-label="ماه قبل">‹</button>
    <select aria-label="ماه شمسی" value={view.m} onChange={e=>setView(v=>({...v,m:Number(e.target.value)}))}>
     {months.map((m,i)=><option value={i+1} key={m}>{m}</option>)}
    </select>
    <select aria-label="سال شمسی" value={view.y} onChange={e=>setView(v=>({...v,y:Number(e.target.value)}))}>
     {Array.from({length:today.y-1249},(_,i)=>today.y-i).map(y=>
      <option value={y} key={y}>{y.toLocaleString("fa-IR",{useGrouping:false})}</option>)}
    </select>
    <button type="button" onClick={()=>go(1)} aria-label="ماه بعد">›</button>
   </div>
   <div className="tto-nav02-calendar-grid" role="grid" aria-label="روزهای ماه شمسی">
    {weekdays.map((w,i)=><span key={i} className="tto-nav02-weekday">{w}</span>)}
    {Array.from({length:days.offset},(_,i)=><span key={"empty"+i}/>)}
    {Array.from({length:days.count},(_,i)=>i+1).map(day=>{
     const future=view.y===today.y&&(view.m>today.m||(view.m===today.m&&day>today.d));
     const active=selected?.y===view.y&&selected.m===view.m&&selected.d===day;
     return <button key={day} type="button" disabled={future} aria-pressed={active}
      aria-label={`${day} ${months[view.m-1]} ${view.y}`} onClick={()=>choose(day)}>
      {day.toLocaleString("fa-IR",{useGrouping:false})}</button>;
    })}
   </div>
   <div className="tto-nav02-calendar-footer">
    <button type="button" onClick={()=>{onChange("");setOpen(false)}}>پاک‌کردن تاریخ</button>
    <button type="button" onClick={()=>setOpen(false)}>بستن تقویم</button>
   </div>
  </div>:null}
 </div>;
}
