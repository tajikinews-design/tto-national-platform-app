/** API.ir SMSOTP server-side transport: never imported by a browser entrypoint. */
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
@Injectable()
export class ApiIrSmsOtpProvider {
  async send(mobile:string,code:string):Promise<boolean>{
    if(process.env.NODE_ENV==="test" && process.env.TTO_MOCK_SMSOTP_PROVIDER==="true") {
      if(code!=="111222") throw new ServiceUnavailableException("Invalid synthetic OTP");
      return true;
    }
    // Independent explicit safety switch: merely adding a provider token must
    // never enable actual delivery in protected internal previews.
    if(process.env.TTO_ENABLE_REAL_SMSOTP_DELIVERY!=="true")
      throw new ServiceUnavailableException("SMS delivery is not approved");
    const token=process.env.APIIR_TOKEN;
    if(!token || token.length<12) throw new ServiceUnavailableException("SMS provider not configured");
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    const startedAt=Date.now();
    let outcome:"ACCEPTED"|"PROVIDER_REJECTED"|"HTTP_4XX"|"HTTP_5XX"|
      "HTTP_OTHER"|"TIMEOUT"|"TRANSPORT_OR_FORMAT_ERROR"="TRANSPORT_OR_FORMAT_ERROR";
    try {
      const response=await fetch("https://s.api.ir/api/sw1/SmsOTP",{
        method:"POST",redirect:"error",signal:controller.signal,
        headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify({code,mobile,template:1})
      });
      if(!response.ok){
        outcome=response.status>=500?"HTTP_5XX":response.status>=400?"HTTP_4XX":"HTTP_OTHER";
        return false;
      }
      const json=await response.json() as {success?:boolean;data?:boolean};
      // The provider response confirms acceptance only, not handset delivery.
      const accepted=json?.success===true && json?.data===true;
      outcome=accepted?"ACCEPTED":"PROVIDER_REJECTED";
      return accepted;
    }catch{
      outcome=controller.signal.aborted?"TIMEOUT":"TRANSPORT_OR_FORMAT_ERROR";
      return false;
    }finally{
      clearTimeout(timer);
      // Privacy-safe, structured diagnostics: no mobile, OTP, token, request id,
      // provider response body or user identity is ever written to runtime logs.
      // Used to distinguish API.ir slowness/timeouts from the later SMS operator hop.
      console.info("TTO_SMSOTP_PROVIDER_METRIC",JSON.stringify({
        outcome,elapsedMs:Math.max(0,Date.now()-startedAt)
      }));
    }
  }
}
