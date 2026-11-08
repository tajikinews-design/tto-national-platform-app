/** CI route contract for preview-only navigation. No database and no secret access. */
"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const path=require("node:path");
const content=fs.readFileSync("packages/ui/src/portal-module-workbench.tsx","utf8");
const s={cooperative:"apps/cooperative-management",national:"apps/national-admin",shareholder:"apps/shareholder"};
const starts=["cooperative:[","national:[","shareholder:["];
const chunks={};
for(let i=0;i<3;i++){
 const at=content.indexOf(starts[i]);
 assert(at>=0,"missing surface "+starts[i]);
 const next=i===2?content.indexOf("\n};",at):content.indexOf(starts[i+1],at);
 chunks[Object.keys(s)[i]]=content.slice(at,next);
}
let total=0,backendLinks=0,held=0;
for(const [surface,section] of Object.entries(chunks)){
 for(const m of section.matchAll(/href:"(\/[^"]+)"[^\n]+?api:"([^"]+)"[^\n]+?readiness:"(protected|review|hold)"/g)){
  const [_,href,api,readiness]=m;
  const relative=href==="/"?"/app/page.tsx":"/app"+href+"/page.tsx";
  const route=path.join(s[surface],relative);
  assert(fs.existsSync(route),"broken preview link: "+surface+" "+href);
  if(readiness==="hold")held++;
  if(api.includes("/api/"))backendLinks++;
  total++;
 }
}
assert(total>=12,"expected complete cross-portal navigation registry got "+total);
assert(backendLinks>=7,"expected linked existing secured API paths got "+backendLinks);
assert(held>=1&&content.includes("API not released"),"dual attestation remains HOLD");
for(const surface of ["national-admin","cooperative-management","shareholder"]){
 const p="apps/"+surface+"/app/modules/[id]/page.tsx";
 assert(fs.readFileSync(p,"utf8").includes("PortalModuleWorkbench"),"NAV route missing module workbench "+surface);
}
assert(content.includes("needs fake data")==false);
console.log("TTO_PREVIEW_ROUTE_MAP_VALID",JSON.stringify({total,backendLinks,held}));
