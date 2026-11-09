import {NextRequest,NextResponse} from "next/server";

/**
 * PREVIEW-ONLY host-based technical testing for TTO.
 * Main domain: development test-control homepage (NOT a commercial storefront).
 * Each wildcard host: selected cooperative login and its role-guarded workspace.
 * Never grant authority, legal standing or membership from a hostname.
 */
const DOMAIN="ttoir.ir";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED=new Set([
 "www","api","admin","national","shareholder","mail","smtp","ftp","app",
 "auth","login","support","help","docs","cdn","assets","static","dev",
 "staging","preview","test","stage","portal","dashboard","billing",
 "shop","checkout","order","payment","payments","tto","root","site"
]);
const SAFE_LOGIN_APIS=new Set([
 "/api/auth/session","/api/auth/password/session","/api/auth/password/login",
 "/api/auth/otp/request","/api/auth/otp/verify","/api/auth/logout",
 "/api/me/tenant-options",
 "/api/commerce/workspaces", "/api/commerce/password-login", "/api/commerce/subscriptions", "/api/commerce/team"
]);
const CONTEXT_API=/^\/api\/tenants\/[0-9a-f-]{36}\/context$/i;

function unavailable(request:NextRequest){
 const response=NextResponse.rewrite(new URL("/_unavailable-workspace",request.url));
 response.headers.set("Cache-Control","private, no-store");
 response.headers.set("X-Robots-Tag","noindex, nofollow");
 return response;
}

export function proxy(request:NextRequest){
 const hostname=request.nextUrl.hostname.toLowerCase().replace(/\.$/,"");
 const path=request.nextUrl.pathname;
 if(hostname==="www."+DOMAIN){
  const destination=new URL(request.url);
  destination.hostname=DOMAIN;
  return NextResponse.redirect(destination,308);
 }
 if(hostname===DOMAIN){
  if(path==="/"){
   const response=NextResponse.rewrite(new URL("/site",request.url));
   response.headers.set("X-Robots-Tag","noindex, nofollow");
   response.headers.set("X-TTO-Entry","development-test-only");
   return response;
  }
  return NextResponse.next();
 }
 if(!hostname.endsWith("."+DOMAIN))return NextResponse.next(); // branch Preview/localhost
 const slug=hostname.slice(0,-("."+DOMAIN).length);
 if(!SLUG.test(slug)||RESERVED.has(slug))return unavailable(request);

 // Strict tenant origin routing. Other routes (including unscoped modules,
 // public registration and order APIs) must NOT be exposed on wildcard hosts.
 if(path==="/"){
  return NextResponse.rewrite(new URL("/c/"+slug,request.url));
 }
 if(path==="/login"){
  if(request.nextUrl.searchParams.get("workspace")!==slug){
   const destination=new URL(request.url);
   destination.searchParams.set("workspace",slug);
   return NextResponse.redirect(destination,307);
  }
  return NextResponse.next();
 }
 if(path==="/c/"+slug||path.startsWith("/c/"+slug+"/modules/")&&
  /^\/c\/[a-z0-9-]+\/modules\/nav-(?:0[2-9]|1[01])$/.test(path))return NextResponse.next();
 if(path==="/setup/"+slug||path==="/owner/"+slug)return NextResponse.next();
 if(path==="/customer-login"||path==="/settings/subscription")return NextResponse.next();
 if(SAFE_LOGIN_APIS.has(path)||CONTEXT_API.test(path))return NextResponse.next();
 return unavailable(request);
}
export const config={
 matcher:["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
