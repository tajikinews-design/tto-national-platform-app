"use strict";
const { Client }=require("pg");
const { spawn }=require("node:child_process");
const { randomUUID }=require("node:crypto");
const assert=require("node:assert/strict");
const path=require("node:path");
const conn=process.env.TEST_ADMIN_DATABASE_URL;
if(!conn)throw Error("EPHEMERAL_POSTGRES_REQUIRED");
const db=new Client({connectionString:conn});let proc;
const base="http://127.0.0.1:31993";
async function request(url,body,status){
 const res=await fetch(base+url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 assert.equal(res.status,status,url+": "+res.status);return res.json();
}
async function run(){
 await db.connect();
 await db.query("ALTER ROLE tto_app LOGIN");
 await db.query("INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes) VALUES('SESSION_CHALLENGE',3,15)");
 const user=randomUUID();
 await db.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)",[user]);
 await db.query("INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at) VALUES('09123456789',$1,now())",[user]);
 proc=spawn(process.execPath,["dist/main.js"],{
  cwd:path.resolve(__dirname,".."),
  env:{...process.env,DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:"31993",
   AUTH_CHALLENGE_HMAC_SECRET:"test-only-hmac-32chars-0123456789-abcdefgh",
   NODE_ENV:"test",TTO_MOCK_SMSOTP_PROVIDER:"true"},
  stdio:"ignore"
 });
 let ready=false;
 for(let i=0;i<90;i++){
  if(proc.exitCode!==null)throw Error("SERVER_EXIT");
  try{const r=await fetch(base+"/ready");if(r.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(!ready)throw Error("SERVER_NOT_READY");
 // Wrong code does not create session; accepted provider sends only to registered identifier.
 const good=await request("/v1/auth/challenges/request",{mobile:"09123456789"},202);
 assert.equal(good.status,"ACCEPTED");
 const wrong=await request("/v1/auth/challenges/verify",{challengeId:good.requestId,otp:"999999"},401);
 assert.ok(wrong.statusCode===401);
 const login=await request("/v1/auth/challenges/verify",{challengeId:good.requestId,otp:"111222"},200);
 assert.equal(typeof login.accessToken,"string");
 await request("/v1/auth/challenges/verify",{challengeId:good.requestId,otp:"111222"},401);
 // Absence of an enrolled mobile cannot be detected by request response itself.
 const absent=await request("/v1/auth/challenges/request",{mobile:"09123456780"},202);
 assert.equal(absent.status,good.status);
 await request("/v1/auth/challenges/verify",{challengeId:absent.requestId,otp:"111222"},401);
 for(let i=0;i<2;i++){
  const next=await request("/v1/auth/challenges/request",{mobile:"09123456789"},202);
  assert.equal(next.status,"ACCEPTED");
 }
 const throttled=await request("/v1/auth/challenges/request",{mobile:"09123456789"},202);
 await request("/v1/auth/challenges/verify",{challengeId:throttled.requestId,otp:"111222"},401);
 await request("/v1/auth/challenges/request",{mobile:"123"},400);
 const result=await db.query("SELECT count(*)::integer AS n FROM tto.auth_challenges WHERE purpose='SMSOTP_LOGIN'");
 assert.equal(result.rows[0].n,3);
 console.log("TTO_SMSOTP_SERVER_HTTP_PG17_PASS=11 (fake transport, zero real SMS)");
}
run().catch(e=>{console.error("SMSOTP_HTTP_FAIL",e.message);process.exitCode=1;})
.finally(async()=>{if(proc&&proc.exitCode===null)proc.kill("SIGTERM");await db.end().catch(()=>{});});
