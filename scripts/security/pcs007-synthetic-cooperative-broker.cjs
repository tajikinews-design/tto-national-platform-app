"use strict";
/** Fictional source-admission lab. Never an official membership or ownership authority. */
const http=require("node:http");
const crypto=require("node:crypto");
const tenant="DEMO-TENANT-001",party="DEMO-PARTY-001";
const advanced=process.env.TTO_PCS009_LAB==="1";
if(process.env.CI!=="true"||process.env.TTO_PCS007_LAB!=="1"||
 process.env.NODE_ENV!=="test"||process.env.VERCEL||process.env.DATABASE_URL||
 process.env.TTO_API_BASE_URL||process.env.APIIR_TOKEN||
 !process.env.TTO_PCS007_TOKEN||
 (advanced&&(!process.env.TTO_PCS009_MANAGER_TOKEN||!process.env.TTO_PCS009_HOLDER_TOKEN||
 process.env.TTO_PCS009_MANAGER_TOKEN===process.env.TTO_PCS009_HOLDER_TOKEN)))
 throw Error("PCS_SYNTHETIC_PRIVATE_ONLY");
let review="PENDING",revision=0;
const events=[];
function json(res,status,body){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"private, no-store"});res.end(JSON.stringify(body))}
function reject(res,status,code){return json(res,status,{available:false,code})}
const source=()=>({kind:"SYNTHETIC_ONLY",tenantId:tenant,partyId:party,reviewStatus:review,revision,
 member:review==="APPROVED_SYNTHETIC"?{status:"DEMO_ACTIVE",sourceVersion:revision}:null,
 holdings:review==="APPROVED_SYNTHETIC"?{quantity:"125",ledgerVersion:revision}:null,
 official:false,canTransfer:false,canTrade:false});
const server=http.createServer(async(req,res)=>{
 if(!["127.0.0.1","::ffff:127.0.0.1"].includes(req.socket.remoteAddress))return reject(res,403,"LOOPBACK_ONLY");
 if(!advanced){
  if(req.headers["x-pcs007-lab-token"]!==process.env.TTO_PCS007_TOKEN)return reject(res,403,"LAB_TOKEN_REQUIRED");
  if(req.url==="/approve"&&req.method==="POST"){review="APPROVED_SYNTHETIC";revision++;return reject(res,200,"DEMO_APPROVED_NO_LEGAL_EFFECT")}
  if(req.url==="/view"&&req.method==="GET")return json(res,200,source());
  return reject(res,404,"NOT_FOUND");
 }
 const auth=req.headers["x-pcs007-lab-token"];
 const role=auth===process.env.TTO_PCS009_MANAGER_TOKEN?"MANAGER":auth===process.env.TTO_PCS009_HOLDER_TOKEN?"SHAREHOLDER":null;
 if(!role)return reject(res,401,"TEST_ACTOR_REQUIRED");
 if(req.headers["x-demo-tenant"]!==tenant)return reject(res,403,"TENANT_DENIED");
 if(req.headers["x-demo-party"]!==party)return reject(res,403,"PARTY_DENIED");
 if(req.url==="/view"&&req.method==="GET")return json(res,200,source());
 if(req.url==="/audit"&&req.method==="GET"){
  if(role!=="MANAGER")return reject(res,403,"MANAGER_ONLY");
  return json(res,200,{kind:"SYNTHETIC_ONLY",events:events.slice(),official:false});
 }
 if(req.url==="/approve"&&req.method==="POST"){
  if(role!=="MANAGER")return reject(res,403,"MANAGER_ONLY");
  if(review==="APPROVED_SYNTHETIC")return reject(res,409,"ALREADY_APPROVED");
  review="APPROVED_SYNTHETIC";revision++;
  const event={id:crypto.randomUUID(),actor:"DEMO-MANAGER",tenantId:tenant,partyId:party,
   action:"APPROVE_SYNTHETIC",revision,at:new Date().toISOString(),official:false};
  events.push(Object.freeze(event));
  return json(res,200,{code:"DEMO_APPROVED_NO_LEGAL_EFFECT",revision});
 }
 return reject(res,404,"NOT_FOUND");
});
server.listen(32990,"127.0.0.1");
