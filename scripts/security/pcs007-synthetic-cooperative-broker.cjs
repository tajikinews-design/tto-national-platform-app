"use strict";
const http=require("node:http");
const ID="DEMO-TENANT-001",PARTY="DEMO-PARTY-001";
let review="PENDING",revision=0;
const deny=(res,status,code)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify({available:false,code}))};
if(process.env.CI!=="true"||process.env.TTO_PCS007_LAB!=="1"||process.env.NODE_ENV!=="test"||process.env.VERCEL||process.env.DATABASE_URL||process.env.TTO_API_BASE_URL||process.env.APIIR_TOKEN)throw Error("PCS007_OFFLINE_ONLY");
const server=http.createServer((req,res)=>{
 if(req.socket.remoteAddress!=="127.0.0.1"&&req.socket.remoteAddress!=="::ffff:127.0.0.1")return deny(res,403,"LOOPBACK_ONLY");
 if(req.headers["x-pcs007-lab-token"]!==process.env.TTO_PCS007_TOKEN)return deny(res,403,"LAB_TOKEN_REQUIRED");
 if(req.url==="/approve"&&req.method==="POST"){review="APPROVED_SYNTHETIC";revision++;return deny(res,200,"DEMO_APPROVED_NO_LEGAL_EFFECT")}
 if(req.url==="/view"&&req.method==="GET"){
  const payload={kind:"SYNTHETIC_ONLY",tenantId:ID,partyId:PARTY,reviewStatus:review,revision,
  member:review==="APPROVED_SYNTHETIC"?{status:"DEMO_ACTIVE",sourceVersion:revision}:null,
  holdings:review==="APPROVED_SYNTHETIC"?{quantity:"125",ledgerVersion:revision}:null,
  official:false,canTransfer:false,canTrade:false};
  res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});return res.end(JSON.stringify(payload));
 }
 return deny(res,404,"NOT_FOUND");
});
server.listen(32990,"127.0.0.1");
