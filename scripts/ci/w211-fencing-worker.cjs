"use strict";
// W2.11 disposable worker process: IPC requests, no authority and no real access.
if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||
 process.env.TTO_W211_MULTIPROCESS_LAB!=="1"||!process.send||
 process.env.DATABASE_URL||process.env.VERCEL||process.env.TTO_API_BASE_URL)
 throw Error("W211_CHILD_LAB_DISABLED");
const pending=new Map();
process.on("message",msg=>{
 if(!msg||msg.kind!=="REPLY"||typeof msg.id!=="string")return;
 const cb=pending.get(msg.id);if(!cb)return;
 pending.delete(msg.id);cb(msg.result);
});
function request(id,action,payload={}){
 return new Promise(resolve=>{
  pending.set(id,resolve);
  process.send({kind:"REQUEST",id,action,payload});
 });
}
process.on("message",async msg=>{
 if(!msg||msg.kind!=="COMMAND"||typeof msg.id!=="string")return;
 if(msg.action==="EXIT"){process.exit(0)}
 if(msg.action==="WAIT"){setTimeout(()=>process.send({kind:"RESULT",id:msg.id,result:{ready:true}}),msg.delay||0);return}
 const result=await request(msg.id,msg.action,msg.payload||{});
 process.send({kind:"RESULT",id:msg.id,result});
});
process.send({kind:"READY"});
