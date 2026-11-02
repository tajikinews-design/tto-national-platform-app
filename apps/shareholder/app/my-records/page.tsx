import "./my-records.css";
import {MemberHoldingsReadOnly} from "./member-holdings-read-only";

export const dynamic="force-dynamic";
export const metadata={
 title:"TTO | عضویت و سهام من — نمایش فقط‌خواندنی",
 robots:{index:false,follow:false}
};
/** Candidate view only. All authority remains in the existing server BFF, Nest and PG RLS. */
export default function MyRecordsPage(){
 return <MemberHoldingsReadOnly/>;
}
