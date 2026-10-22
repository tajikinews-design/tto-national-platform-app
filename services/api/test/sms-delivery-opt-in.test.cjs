"use strict";
/** Isolated CI: never contacts API.ir, never sends a real SMS. */
const assert=require("node:assert/strict");
const {ApiIrSmsOtpProvider}=require("../dist/apiir-provider.js");
async function main(){
  if(process.env.APIIR_TOKEN)throw Error("TEST_MUST_NOT_HAVE_REAL_SMS_SECRET");
  const originalFetch=global.fetch;
  const provider=new ApiIrSmsOtpProvider();
  let networkCalls=0;
  global.fetch=async()=>{networkCalls++;throw Error("NETWORK_NOT_ALLOWED");};
  process.env.NODE_ENV="production";
  process.env.APIIR_TOKEN="synthetic_ci_token_no_actual_provider";
  delete process.env.TTO_MOCK_SMSOTP_PROVIDER;
  for(const flag of [undefined,"","false","TRUE"]){
    if(flag===undefined)delete process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY;
    else process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY=flag;
    await assert.rejects(()=>provider.send("09123456789","111222"),e=>e?.getStatus?.()===503);
  }
  assert.equal(networkCalls,0,"Unexpected external SMS request");
  delete process.env.APIIR_TOKEN;
  process.env.NODE_ENV="test";
  process.env.TTO_MOCK_SMSOTP_PROVIDER="true";
  assert.equal(await provider.send("09123456789","111222"),true);
  await assert.rejects(()=>provider.send("09123456789","999999"));
  assert.equal(networkCalls,0,"Fake provider must not use network");
  delete process.env.TTO_MOCK_SMSOTP_PROVIDER;
  delete process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY;
  global.fetch=originalFetch;
  console.log("TTO_CF01_REAL_SMS_EXPLICIT_OPT_IN_FAIL_CLOSED_PASS");
  console.log("NO_SMS_SENT_NO_PROVIDER_NETWORK");
}
main().catch(()=>{console.error("TTO_CF01_SMS_GATE_TEST_FAILED");process.exitCode=1});
