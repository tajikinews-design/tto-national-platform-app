"use client";
import Link from "next/link";
import type {ReactNode} from "react";
// Same-origin App Router transition: preserves the mounted browser runtime,
// allowing the verified workspace gate to keep its access continuity.
export function CooperativeNavLink({href,children,className,...rest}:{
 href:string;children:ReactNode;className?:string;"aria-current"?:"page";"aria-label"?:string
}){
 return <Link href={href} prefetch={true} className={className} {...rest}>{children}</Link>;
}
