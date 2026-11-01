"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {readFileSync}=require("node:fs"),{resolve}=require("node:path");
const ROOT=resolve(__dirname,"../..");
const page=readFileSync(resolve(ROOT,"apps/shareholder/app/tenants/[tenantId]/my-records/page.tsx"),"utf8");
const member=readFileSync(resolve(ROOT,"apps/shareholder/app/api/tenants/[tenantId]/me/member-record/route.ts"),"utf8");
const holding=readFileSync(resolve(ROOT,"apps/shareholder/app/api/tenants/[tenantId]/me/shareholding/route.ts"),"utf8");
test("PCS013 uses existing independent, authorized own-only BFF routes",()=>{
 assert.match(page,/\/api\/tenants\//);
 assert.match(page,/\/me\/"\+name/);
 assert.match(page,/"member-record"/);
 assert.match(page,/"shareholding"/);
 for(const source of [member,holding]){
  assert.match(source,/cookies\.get\("tto_session"\)/);
  assert.match(source,/SOURCE_OR_PERMISSION_NOT_APPROVED/);
  assert.match(source,/redirect:"error"/);
  assert.match(source,/private, no-store/);
 }
});
test("PCS013 never fabricates ownership, zero or an official source",()=>{
 assert.match(page,/اطلاعات رسمی تأییدشده در دسترس نیست/);
 assert.match(page,/نبود اطلاعات به معنی صفر سهم نیست/);
 assert.match(page,/status==="available"/);
 assert.doesNotMatch(page,/PCS010-FAKE|PCS007|125|shareQuantity:\s*"0"/);
 assert.doesNotMatch(page,/method:\s*"POST"/);
 assert.match(page,/امکان خرید، فروش، انتقال یا تغییر/);
});
