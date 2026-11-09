import {NextRequest,NextResponse} from "next/server";

/**
 * Host-based entry routing for the isolated cooperative Preview.
 *
 * ttoir.ir/            -> public commercial landing at /site.
 * <slug>.ttoir.ir/     -> login bound to that slug.
 * <slug>.ttoir.ir/c/slug -> existing session and role-protected workspace.
 *
 * No database query, self-provisioning, payment or role grant happens here.
 * Never authorize a tenant from the Host header: PortalSessionGate must still
 * verify a real session, manager role, tenant context and the same slug.
 */
const DOMAIN="ttoir.ir";
const SLUG=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED=new Set([
 "www","api","admin","national","shareholder","mail","smtp","ftp","app",
 "auth","login","support","help","docs","cdn","assets","static","dev",
 "staging","preview","test","stage","portal","dashboard","billing",
 "shop","checkout","order","payment","payments","tto","root","site"
]);

function notFound(request:NextRequest){
 // A route that does not exist. Do not redirect unknown hosts to the homepage.
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
  if(path==="/")return NextResponse.rewrite(new URL("/site",request.url),{
   headers:{"X-TTO-Entry":"public-commerce"}
  });
  return NextResponse.next();
 }
 if(!hostname.endsWith("."+DOMAIN))return NextResponse.next(); // localhost and branch Preview
 const slug=hostname.slice(0,-("."+DOMAIN).length);
 if(!SLUG.test(slug)||RESERVED.has(slug))return notFound(request);

 // The public sales and registration flow must remain on the apex domain,
 // not in any per-tenant origin. Preview app's usual API stays session-gated.
 if(path==="/site"||path==="/subscribe"||path==="/customer-register"||
    path==="/customer-login"||path==="/first-login"||
    path.startsWith("/settings/")||path==="/settings"||
    path==="/api/commerce"||path.startsWith("/api/commerce/"))
  return notFound(request);

 if(path==="/"){
  const destination=new URL("/login",request.url);
  destination.searchParams.set("workspace",slug);
  return NextResponse.redirect(destination,307);
 }
 if(path==="/login"){
  if(request.nextUrl.searchParams.get("workspace")!==slug){
   const destination=new URL(request.url);
   destination.searchParams.set("workspace",slug); // host is authoritative
   return NextResponse.redirect(destination,307);
  }
  return NextResponse.next();
 }
 if(path==="/c"||path.startsWith("/c/")){
  if(path!=="/c/"+slug)return notFound(request);
  return NextResponse.next(); // existing PortalSessionGate still mandatory
 }
 return NextResponse.next();
}

export const config={
 matcher:[
  "/","/login","/site","/c/:path*","/customer-register","/subscribe",
  "/customer-login","/first-login","/settings/:path*","/api/commerce/:path*"
 ]
};
