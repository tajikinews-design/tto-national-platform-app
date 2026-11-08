"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const shell=fs.readFileSync("packages/ui/src/index.tsx","utf8");
const home=fs.readFileSync("packages/ui/src/approved-dashboard.tsx","utf8");
assert(shell.includes('grid-template-columns')===false,"geometry must be in one shared CSS");
assert(shell.includes('<ApprovedDashboardHome surface={surface}>'),"all surfaces must reuse approved dashboard");
assert(!shell.includes('className="module-grid"'),"no secondary brochure menu on approved dashboard");
for(const slot of ["tto-approved-kpis","tto-approved-grid","tto-alerts","tto-actions","tto-chart","tto-campaigns","tto-ads","tto-mini"]){
 assert(home.includes(slot),"approved image slot missing "+slot);
}
assert(home.includes('numeric("—")'),"unverified real-company KPI must be no_data");
assert(!home.includes("1,250,000")&&!home.includes("8,420"),"must not copy screenshot fixture counts");
for(const [name,path] of [
 ["national","apps/national-admin/app/login/page.tsx"],
 ["cooperative","apps/cooperative-management/app/login/page.tsx"],
 ["shareholder","apps/shareholder/app/login/page.tsx"]
]){
 const content=fs.readFileSync(path,"utf8");
 assert(content.includes("Login"),"independent login route missing "+name);
 const landing=fs.readFileSync("apps/"+(name==="national"?"national-admin":name==="cooperative"?"cooperative-management":"shareholder")+"/app/page.tsx","utf8");
 assert(landing.includes('PortalSessionGate surface="'+name+'"'),"home route not authentication-gated "+name);
}
const manager=fs.readFileSync("apps/cooperative-management/app/c/[slug]/page.tsx","utf8");
assert(manager.includes("workspaceSlug={slug}"),"manager scope must equal URL slug");
const bffs=["apps/cooperative-management/app/api/auth/password","apps/shareholder/app/api/auth/password"];
for(const bff of bffs){
 assert(fs.existsSync(bff+"/login/route.ts"),"portal password BFF missing");
 assert(fs.existsSync(bff+"/session/route.ts"),"password session provenance BFF missing");
}
const migration=fs.readFileSync("database/migrations/0062_ph12_separate_cooperative_shareholder_password_credentials.sql","utf8");
assert(migration.includes("portal_password_session_bindings"),"source-tagged auth session missing");
assert(migration.includes("FORCE ROW LEVEL SECURITY"),"credential RLS is not enforced");
assert(migration.includes("tto.portal_password_session_identity"),"role/tenant session proof missing");
const api=fs.readFileSync("services/api/src/module.ts","utf8");
for(const phrase of ["portal/password/login","portal/password/session","TTO_SECURE_REAL_DATA_STAGING_ENABLED",
 "PORTAL_TENANT_SCOPE_DENIED","PORTAL_PASSWORD_RATE_LIMITED"]){
 assert(api.includes(phrase),"missing fail-closed backend security gate "+phrase);
}
console.log("TTO_APPROVED_DASHBOARD_AND_3_SEPARATE_PASSWORD_LOGIN_STATIC_PASS");
