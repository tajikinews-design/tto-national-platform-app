"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {isNationalId,isMobile,createNationalRootInitialScrypt,verifiesInitialMobileHash}
 =require("../ops/national-root-owner-credentials.cjs");
function makeNationalId(firstNine){
 const digits=[...firstNine].map(Number);
 const r=digits.reduce((sum,d,i)=>sum+d*(10-i),0)%11;
 return firstNine+(r<2?r:11-r);
}
const sampleId=makeNationalId("001234567");
const sampleMobile="09120000001";
test("exactly ten national digits with check digit accepted",()=>{
 assert.equal(isNationalId(sampleId),true);
 assert.equal(isNationalId(sampleId.slice(0,-1)+(Number(sampleId[9])===0?"1":"0")),false);
 assert.equal(isNationalId("1111111111"),false);
 assert.equal(isNationalId("a"+sampleId.slice(1)),false);
 assert.equal(isNationalId(sampleId.slice(1)),false);
});
test("mobile initial credential exactly 09 plus nine digits",()=>{
 assert.equal(isMobile(sampleMobile),true);
 for(const value of ["+989120000001","9120000001","0912000000","091200000011","0912ABC0001"])assert.equal(isMobile(value),false,value);
});
test("initial password stored only as random-salted scrypt hash, not mobile",()=>{
 const a=createNationalRootInitialScrypt({nationalId:sampleId,mobile:sampleMobile});
 const b=createNationalRootInitialScrypt({nationalId:sampleId,mobile:sampleMobile});
 assert.equal(a.username,sampleId);
 assert.match(a.passwordScrypt,/^scrypt\$v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
 assert.notEqual(a.passwordScrypt,b.passwordScrypt);
 assert.ok(!a.passwordScrypt.includes(sampleMobile));
 assert.equal(verifiesInitialMobileHash(sampleMobile,a.passwordScrypt),true);
 assert.equal(verifiesInitialMobileHash("09120000002",a.passwordScrypt),false);
 assert.equal(verifiesInitialMobileHash(sampleMobile,"untrusted"),false);
});
test("invalid national ID/mobile never produce a privileged credential pair",()=>{
 for(const fields of [{nationalId:"0000000000",mobile:sampleMobile},
 {nationalId:sampleId,mobile:"00000000000"},
 {nationalId:sampleId,mobile:null}])
 assert.throws(()=>createNationalRootInitialScrypt(fields),/INVALID_NATIONAL_ID_OR_MOBILE/);
});
