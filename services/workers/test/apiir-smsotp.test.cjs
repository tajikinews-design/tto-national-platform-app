"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {ENDPOINT,buildPayload,sendSmsOtp}=require("../src/apiir-smsotp.cjs");
test("contract exact endpoint and Iranian mobile",()=>{
  assert.equal(ENDPOINT,"https://s.api.ir/api/sw1/SmsOTP");
  assert.deepEqual(buildPayload({code:"123456",mobile:"09123456789"}),{code:"123456",mobile:"09123456789",template:1});
  assert.throws(()=>buildPayload({code:"12",mobile:"09123456789"}));
  assert.throws(()=>buildPayload({code:"123456",mobile:"11234567890"}));
});
test("dry run causes zero outbound requests",async()=>{
 let requests=0;
 const result=await sendSmsOtp({code:"123456",mobile:"09123456789"},{dryRun:true,fetchImpl:()=>{requests++;throw Error("NETWORK_MUST_NOT_RUN");}});
 assert.equal(result.status,"SIMULATED");assert.equal(result.delivered,false);assert.equal(requests,0);
});
test("mock provider contract and secret confined to authorization header",async()=>{
 let calls=0;
 const result=await sendSmsOtp({code:"123456",mobile:"09123456789"},{token:"test-token-not-real",fetchImpl:async (url,options)=>{
  calls++;assert.equal(url,ENDPOINT);assert.equal(options.headers.Authorization,"Bearer test-token-not-real");
  assert.deepEqual(JSON.parse(options.body),{code:"123456",mobile:"09123456789",template:1});
  return {ok:true,json:async()=>({success:true,code:200,message:"accepted",data:null})};
 }});
 assert.equal(calls,1);assert.equal(result.status,"PROVIDER_ACCEPTED");assert.equal(result.delivered,false);
});
test("provider rejection and missing token fail closed",async()=>{
 await assert.rejects(sendSmsOtp({code:"123456",mobile:"09123456789"},{token:"",fetchImpl:()=>{throw Error("MUST_NOT_CALL")}}),/APIIR_TOKEN_NOT_CONFIGURED/);
 await assert.rejects(sendSmsOtp({code:"123456",mobile:"09123456789"},{token:"test-token-not-real",fetchImpl:async()=>({ok:true,json:async()=>({success:false,code:401})})}),/APIIR_DELIVERY_NOT_CONFIRMED/);
});
test("network failures redact details",async()=>{
 await assert.rejects(sendSmsOtp({code:"123456",mobile:"09123456789"},{token:"test-token-not-real",fetchImpl:async()=>{throw Error("sensitive secret user phone");}}),/APIIR_PROVIDER_UNAVAILABLE/);
});
