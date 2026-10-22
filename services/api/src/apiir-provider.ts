/** API.ir SMSOTP server-side transport: never imported by a browser entrypoint. */
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
@Injectable()
export class ApiIrSmsOtpProvider {
  async send(mobile:string,code:string):Promise<boolean>{
    if(process.env.NODE_ENV==="test" && process.env.TTO_MOCK_SMSOTP_PROVIDER==="true") {
      if(code!=="111222") throw new ServiceUnavailableException("Invalid synthetic OTP");
      return true;
    }
    const token=process.env.APIIR_TOKEN;
    if(!token || token.length<12) throw new ServiceUnavailableException("SMS provider not configured");
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try {
      const response=await fetch("https://s.api.ir/api/sw1/SmsOTP",{
        method:"POST",redirect:"error",signal:controller.signal,
        headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify({code,mobile,template:1})
      });
      if(!response.ok) return false;
      const json=await response.json() as {success?:boolean;data?:boolean};
      // Provider accepted the request; this is NOT proof the SMS reached the handset.
      return json?.success===true && json?.data===true;
    }catch{return false;}
    finally{clearTimeout(timer);}
  }
}
