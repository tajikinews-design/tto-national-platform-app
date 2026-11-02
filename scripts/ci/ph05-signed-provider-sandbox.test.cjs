'use strict';
// Offline executable CF05 test-only provider boundary; NOT a production adapter.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac,timingSafeEqual}=require('node:crypto');

class SandboxProvider {
 constructor(secrets,now=()=>Date.now()) {
  this.secrets=new Map(Object.entries(secrets));this.now=now;
  this.reports=new Map();this.events=[];this.seen=new Map();
 }
 canonical(p){return [p.tenantId,p.eventId,p.receiptRef,p.providerRef,p.state,p.timestamp].join('|');}
 sign(tenant,p){
  const key=this.secrets.get(tenant);
  if(!key)throw Error('UNKNOWN_TENANT');
  return createHmac('sha256',key).update(this.canonical(p)).digest('hex');
 }
 reportReceipt(tenantId,receiptRef,evidenceRef){
  if(!this.secrets.has(tenantId)||!receiptRef||!evidenceRef)throw Error('UNAUTHORIZED_REPORT');
  const id=tenantId+':'+receiptRef;
  if(this.reports.has(id))return this.reports.get(id);
  const v={tenantId,receiptRef,evidenceRef,status:'REPORTED',businessFinalized:false};
  this.reports.set(id,v);return v;
 }
 browserRedirect(tenantId,receiptRef){
  const v=this.reports.get(tenantId+':'+receiptRef);
  return {redirectSeen:true,status:v?.status??'UNKNOWN'};
 }
 receiveSigned(p,signature){
  if(!p||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))throw Error('INVALID_SIGNATURE');
  if(!this.secrets.has(p.tenantId))throw Error('UNKNOWN_TENANT');
  if(!Number.isSafeInteger(p.timestamp)||Math.abs(this.now()-p.timestamp)>300000)throw Error('STALE_CALLBACK');
  if(!['PAID','FAILED'].includes(p.state)||!p.providerRef||!p.eventId||!p.receiptRef)throw Error('BAD_EVENT');
  const expected=Buffer.from(this.sign(p.tenantId,p),'hex'),received=Buffer.from(signature,'hex');
  if(!timingSafeEqual(expected,received))throw Error('INVALID_SIGNATURE');
  const eventKey=p.tenantId+':'+p.eventId,canonical=this.canonical(p);
  if(this.seen.has(eventKey)){
   if(this.seen.get(eventKey)!==canonical)throw Error('EVENT_COLLISION');
   return {duplicate:true,changed:false};
  }
  const receipt=this.reports.get(p.tenantId+':'+p.receiptRef);
  if(!receipt)throw Error('UNKNOWN_PAYMENT_REPORT');
  this.seen.set(eventKey,canonical);
  if(receipt.status==='VERIFIED')return {duplicate:false,changed:false,regressionDenied:true};
  if(p.state==='PAID'){
   receipt.status='VERIFIED';
   this.events.push({type:'PAYMENT_VERIFIED',tenantId:p.tenantId,receiptRef:p.receiptRef,providerRef:p.providerRef,eventId:p.eventId});
   return {duplicate:false,changed:true};
  }
  receipt.status='FAILED';
  return {duplicate:false,changed:true};
 }
 async tryNotify(job,provider){
  try{await provider(job);return {delivery:'SENT'};}
  catch{return {delivery:'FAILED',businessUnchanged:true};}
 }
}
const now=()=>1762092000000;
function create(){
 const p=new SandboxProvider({TENANT_A:'safely-generated-fixture-key-A',TENANT_B:'safely-generated-fixture-key-B'},now);
 p.reportReceipt('TENANT_A','R1','EVIDENCE_1');
 return p;
}
function event(state='PAID',id='EVENT_1',tenant='TENANT_A'){
 return {tenantId:tenant,eventId:id,receiptRef:'R1',providerRef:'SYNTHETIC_BANK_001',
  state,timestamp:now()};
}

test('CORE-INT-AT-001 duplicate signed webhook has one effect',()=>{
 const p=create(),e=event(),sig=p.sign('TENANT_A',e);
 assert.equal(p.receiveSigned(e,sig).changed,true);
 assert.equal(p.receiveSigned(e,sig).duplicate,true);
 assert.equal(p.events.length,1);
 console.log('PH05_CORE_INT_AT001_SIGNED_SANDBOX_REPLAY_PASS');
});
test('CORE-INT-AT-002 receipt evidence is REPORTED only',()=>{
 const p=create(),r=p.reports.get('TENANT_A:R1');
 assert.equal(r.status,'REPORTED');assert.equal(r.businessFinalized,false);assert.equal(p.events.length,0);
 console.log('PH05_CORE_INT_AT002_RECEIPT_NOT_VERIFIED_PASS');
});
test('CORE-INT-AT-003 verified provider sandbox callback emits payment verified',()=>{
 const p=create(),e=event(),sig=p.sign('TENANT_A',e);
 assert.equal(p.receiveSigned(e,sig).changed,true);
 assert.deepEqual(p.events.map(x=>x.type),['PAYMENT_VERIFIED']);
 assert.equal(p.reports.get('TENANT_A:R1').businessFinalized,false);
 console.log('PH05_CORE_INT_AT003_SIGNED_SANDBOX_PROVIDER_VERIFICATION_PASS');
});
test('CORE-INT-AT-004 browser redirect alone is never payment verification',()=>{
 const p=create();p.browserRedirect('TENANT_A','R1');
 assert.equal(p.reports.get('TENANT_A:R1').status,'REPORTED');
 assert.equal(p.events.length,0);
 console.log('PH05_CORE_INT_AT004_BROWSER_REDIRECT_NO_VERIFY_PASS');
});
test('CORE-INT-AT-005 provider notification outage cannot roll back business state',async()=>{
 const p=create(),before=JSON.stringify(p.reports.get('TENANT_A:R1'));
 const n=await p.tryNotify({tenantId:'TENANT_A'},async()=>{throw Error('PROVIDER_UNAVAILABLE')});
 assert.equal(n.delivery,'FAILED');assert.equal(JSON.stringify(p.reports.get('TENANT_A:R1')),before);
 console.log('PH05_CORE_INT_AT005_SANDBOX_NOTIFICATION_FAILURE_ISOLATED_PASS');
});
test('CORE-INT-AT-006 cross-tenant signature and credential are rejected',()=>{
 const p=create(),e=event(),sig=p.sign('TENANT_A',e);
 assert.throws(()=>p.receiveSigned({...e,tenantId:'TENANT_B'},sig),/INVALID_SIGNATURE/);
 assert.equal(p.reports.get('TENANT_A:R1').status,'REPORTED');
 console.log('PH05_CORE_INT_AT006_CROSS_TENANT_SIGNATURE_REJECT_PASS');
});
test('CORE-INT-AT-007 wallet API absent from sandbox payment interface',()=>{
 const p=create();
 assert.equal('walletBalance' in p,false);assert.equal('credit' in p,false);
 assert.equal('debit' in p,false);assert.equal('transfer' in p,false);
 console.log('PH05_CORE_INT_AT007_SANDBOX_WALLET_ABSENT_PASS');
});
test('CORE-INT-AT-008 later stale provider failure cannot regress verified state',()=>{
 const p=create(),paid=event('PAID','EVENT_1'),failed=event('FAILED','EVENT_2');
 p.receiveSigned(paid,p.sign('TENANT_A',paid));
 assert.equal(p.receiveSigned(failed,p.sign('TENANT_A',failed)).regressionDenied,true);
 assert.equal(p.reports.get('TENANT_A:R1').status,'VERIFIED');
 assert.equal(p.events.length,1);
 console.log('PH05_CORE_INT_AT008_OUT_OF_ORDER_SIGNED_SANDBOX_NO_REGRESSION_PASS');
});
