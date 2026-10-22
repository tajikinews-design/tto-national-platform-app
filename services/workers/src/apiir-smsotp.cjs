"use strict";
const ENDPOINT = "https://s.api.ir/api/sw1/SmsOTP";
function buildPayload({code,mobile,template=1}) {
  if(typeof code!=="string" || !/^[0-9]{4,10}$/.test(code)) throw Error("OTP_CODE_INVALID");
  if(typeof mobile!=="string" || !/^09[0-9]{9}$/.test(mobile)) throw Error("OTP_MOBILE_INVALID");
  if(!Number.isInteger(template)||template<1) throw Error("OTP_TEMPLATE_INVALID");
  return {code,mobile,template};
}
async function sendSmsOtp({code,mobile,template=1},{token=process.env.APIIR_TOKEN,fetchImpl=globalThis.fetch,timeoutMs=8000,dryRun=false}={}) {
  const payload=buildPayload({code,mobile,template});
  // Never send unapproved real messages during CI/previews. No OTP value or mobile in logs.
  if(dryRun) return {status:"SIMULATED",delivered:false};
  if(!token||typeof token!=="string"||token.length<12) throw Error("APIIR_TOKEN_NOT_CONFIGURED");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetchImpl(ENDPOINT,{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload),signal:controller.signal,redirect:"error"});
    if(!response.ok) throw Error("APIIR_HTTP_DELIVERY_REJECTED");
    const result=await response.json();
    if(!result||result.success!==true||result.data!==true) throw Error("APIIR_DELIVERY_NOT_CONFIRMED");
    return {status:"PROVIDER_ACCEPTED",delivered:false,providerCode:typeof result.code==="number"?result.code:null};
  } catch (e) {
    if(e?.message?.startsWith("APIIR_")) throw e;
    throw Error("APIIR_PROVIDER_UNAVAILABLE");
  } finally {clearTimeout(timeout);}
}
module.exports={ENDPOINT,buildPayload,sendSmsOtp};