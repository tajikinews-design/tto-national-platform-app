import { spawn } from "node:child_process";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const slugs=["shareholder","cooperative-management","national-admin"];
let checks=0;
for (let idx=0;idx<slugs.length;idx++){
 const slug=slugs[idx],port=32110+idx;
 const cwd=resolve(root,"apps",slug);
 const next=resolve(cwd,"node_modules/next/dist/bin/next");
 const server=spawn(process.execPath,[next,"start","-p",String(port)],{
  cwd,env:{...process.env,TTO_API_BASE_URL:"",PORT:String(port),NEXT_TELEMETRY_DISABLED:"1"},stdio:"ignore"
 });
 try{
  let ready=false;
  for(let n=0;n<80;n++){
   if(server.exitCode!==null)throw Error(slug+" exited");
   try{const r=await fetch("http://127.0.0.1:"+port+"/");if(r.ok){ready=true;const html=await r.text();
    if(!html.includes("ورود با رمز یک‌بارمصرف"))throw Error(slug+" missing OTP form");
    if(!html.includes("در این نسخه پیش‌نمایش"))throw Error(slug+" did not fail closed");
    checks++;break;}}catch{}
   await new Promise(r=>setTimeout(r,200));
  }
  if(!ready)throw Error(slug+" not ready");
  for(const route of ["/api/auth/otp/request","/api/auth/otp/verify"]){
   const response=await fetch("http://127.0.0.1:"+port+route,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile:"09123456789",otp:"123456"})
   });
   if(response.status!==503)throw Error(slug+" "+route+" unexpectedly returned "+response.status);
   checks++;
  }
 }finally{server.kill("SIGTERM");}
}
console.log("TTO_NEXT_VAZIRMATN_OTP_FAIL_CLOSED_SMOKE_PASS="+checks);
