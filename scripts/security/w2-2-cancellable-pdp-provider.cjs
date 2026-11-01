"use strict";
/**
 * W2.2 test-only cancellable PDP adapter.
 *
 * Never load from production Next App Router / Nest AppModule. Every invocation
 * launches a single allowlisted, isolated child WITHOUT a shell, DB, API token
 * or external network. AbortSignal kills the child, not merely Promise.race.
 * The returned object is still only an untrusted synthetic policy candidate.
 */
const {spawn}=require("node:child_process");
const {resolve}=require("node:path");

const ROOT=resolve(__dirname,"../..");
const TEST_MODES=new Set(["hang","late","crash","invalid","oversize"]);
const MAX_INPUT=8192,MAX_OUTPUT=8192;
const active=new Set();
const counters={started:0,closed:0,aborted:0,oversize:0};

function labOnly(){
 return process.env.CI==="true"&&process.env.NODE_ENV==="test"&&
  process.env.TTO_LOOPBACK_E2E==="1"&&
  process.env.TTO_W2_OFFLINE_LAB==="1"&&
  process.env.TTO_W22_CANCELLABLE_LAB==="1"&&
  !process.env.VERCEL&&!process.env.DATABASE_URL&&
  !process.env.TTO_API_BASE_URL&&!process.env.TEST_ADMIN_DATABASE_URL&&
  !process.env.APIIR_TOKEN&&!process.env.TTO_DB_POOLER_HOST&&
  !process.env.TTO_DB_APP_PASSWORD;
}

function stats(){
 return Object.freeze({...counters,active:active.size});
}

/**
 * @param {string} operation Only read is permitted at the offline gateway.
 * @param {object} context An internal synthetic context, never a live record.
 * @param {{signal:AbortSignal,mode?:string}} options
 * The optional whitelisted mode is for intentionally hostile child fixtures.
 */
function runW22CancellablePDP(operation,context,options){
 if(!labOnly())return Promise.reject(Error("LAB_DISABLED"));
 if(operation!=="read"||!context||typeof context!=="object"||
    !options||!(options.signal instanceof AbortSignal))
  return Promise.reject(Error("PDP_INPUT_INVALID"));
 const {signal,mode="bridge"}=options;
 if(signal.aborted)return Promise.reject(Error("PDP_ABORTED"));
 if(mode!=="bridge"&&!TEST_MODES.has(mode))
  return Promise.reject(Error("PDP_MODE_INVALID"));
 const input=JSON.stringify({operation,context});
 if(Buffer.byteLength(input,"utf8")>MAX_INPUT)
  return Promise.reject(Error("PDP_INPUT_TOO_LARGE"));
 const isFixture=mode!=="bridge";
 const command=isFixture?process.execPath:"python3";
 const args=isFixture?
  [resolve(ROOT,"scripts/ci/w2-2-cancellable-pdp-fixture.cjs"),mode]:
  ["-m","scripts.security.w1_isolated_http_bridge"];
 // Never inherit the host environment, secrets or arbitrary runtime flags.
 const env={
  PATH:process.env.PATH||"/usr/bin:/bin",
  PYTHONDONTWRITEBYTECODE:"1",
  TTO_W22_CHILD_FIXTURE:"1"
 };
 return new Promise((resolvePromise,rejectPromise)=>{
  let child,finished=false,aborted=false,tooLarge=false;
  let stdoutSize=0,stdout=[];
  function settle(error,value){
   if(finished)return;
   finished=true;
   signal.removeEventListener("abort",onAbort);
   if(error)rejectPromise(error);
   else resolvePromise(value);
  }
  function onAbort(){
   if(finished)return;
   aborted=true;
   counters.aborted++;
   if(child&&!child.killed)child.kill("SIGKILL");
   // The caller must never have to wait for a blocked child to exit before
   // refusing access; the child remains monitored until its 'close' event.
   settle(Error("PDP_ABORTED"));
  }
  try{
   child=spawn(command,args,{
    cwd:ROOT,env,stdio:["pipe","pipe","pipe"],
    shell:false,windowsHide:true
   });
  }catch{
   settle(Error("PDP_UNAVAILABLE"));
   return;
  }
  counters.started++;
  active.add(child);
  child.stdout.on("data",chunk=>{
   if(finished||tooLarge)return;
   stdoutSize+=chunk.length;
   if(stdoutSize>MAX_OUTPUT){
    tooLarge=true;counters.oversize++;
    child.kill("SIGKILL");
    settle(Error("PDP_RESPONSE_TOO_LARGE"));
    return;
   }
   stdout.push(chunk);
  });
  // Never log child stderr; the bridge is not permitted to leak input.
  child.stderr.on("data",()=>{});
  child.on("error",()=>settle(Error("PDP_UNAVAILABLE")));
  child.on("close",code=>{
   active.delete(child);counters.closed++;
   if(finished)return;
   if(aborted||signal.aborted){settle(Error("PDP_ABORTED"));return}
   if(tooLarge){settle(Error("PDP_RESPONSE_TOO_LARGE"));return}
   if(code!==0){settle(Error("PDP_UNAVAILABLE"));return}
   try{
    const json=JSON.parse(Buffer.concat(stdout).toString("utf8"));
    settle(null,json);
   }catch{settle(Error("PDP_RESPONSE_INVALID"))}
  });
  child.stdin.on("error",()=>{});
  // Attach close/error handlers BEFORE observing abort: an already-cancelled
  // child still needs its 'close' event to remove PID from the active set.
  signal.addEventListener("abort",onAbort,{once:true});
  if(signal.aborted){onAbort();return}
  child.stdin.end(isFixture?"":input);
 });
}
module.exports={runW22CancellablePDP,labOnly,stats};
