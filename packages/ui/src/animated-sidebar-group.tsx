"use client";
import {useEffect,useId,useState,type ReactNode} from "react";

/** Keeps the subtree mounted so both OPEN and CLOSE have a measurable CSS
 * transition. Inert/aria-hidden prevent focus in collapsed navigation.
 */
export function AnimatedSidebarGroup({
 name,symbol,active,children
}:{name:string;symbol:string;active:boolean;children:ReactNode}){
 const [expanded,setExpanded]=useState(active);
 const id=useId();
 useEffect(()=>{setExpanded(active)},[active]);
 return <div className={"tto-settings-tree tto-animated-tree"+(expanded?" is-expanded":"")}>
  <button type="button" className={"nav-link tto-accordion-trigger"+(active?" current":"")}
   aria-label={"نمایش یا پنهان‌کردن زیرمنوی "+name}
   aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}\n    onKeyDown={e=>{if(e.key==="Escape"&&expanded){e.preventDefault();setExpanded(false)}}}>
   <span aria-hidden="true" className="tto-nav-symbol">{symbol}</span>
   <span>{name}</span>
   <span className="tto-settings-chevron" aria-hidden="true">⌄</span>
  </button>
  <div id={id} className="tto-submenu-motion" aria-hidden={!expanded}
   hidden={!expanded} inert={!expanded}>
   <div className="tto-submenu-motion-inner">
    <div className="tto-settings-submenu" aria-label={"زیرمنوهای "+name}>{children}</div>
   </div>
  </div>
 </div>;
}
