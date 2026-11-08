/** ClamAV clamd INSTREAM adapter. No filesystem plaintext or network services. */
import { connect } from "node:net";
import { isAbsolute } from "node:path";

export type MalwareVerdict = { verdict: "CLEAN" | "MALWARE"; engine: string; signature: string };
const MAX_BYTES = 524288;
function localSocketPath(): string {
  const path=process.env.TTO_COOP_CLAMD_SOCKET??"";
  // Never allow a remote scanner endpoint, TCP fallback, relative paths or NUL.
  if(!isAbsolute(path)||path.includes("\0")||path.length>180)
    throw new Error("CLAMD_LOCAL_SOCKET_REQUIRED");
  return path;
}
function command(socketPath:string, payload:Buffer, timeoutMs=6000):Promise<string>{
 return new Promise((resolve,reject)=>{
  const socket=connect({path:socketPath});
  let done=false;let received=Buffer.alloc(0);
  const finish=(err?:Error,value?:string)=>{
   if(done)return;done=true;socket.destroy();
   if(err)reject(err);else resolve(value??"");
  };
  socket.setTimeout(timeoutMs,()=>finish(new Error("CLAMD_TIMEOUT")));
  socket.on("error",()=>finish(new Error("CLAMD_TRANSPORT_FAILURE")));
  socket.on("data",(chunk:Buffer)=>{
   received=Buffer.concat([received,chunk]);
   if(received.length>512)return finish(new Error("CLAMD_RESPONSE_TOO_LONG"));
   const end=received.indexOf(0);
   if(end>=0)return finish(undefined,received.subarray(0,end).toString("utf8").trim());
   const lf=received.indexOf(10);
   if(lf>=0)return finish(undefined,received.subarray(0,lf).toString("utf8").trim());
  });
  socket.on("close",()=>{if(!done)finish(new Error("CLAMD_NO_RESPONSE"));});
  socket.on("connect",()=>socket.end(payload));
 });
}
export async function scanQuarantineBytes(bytes:Buffer):Promise<MalwareVerdict>{
 if(bytes.length===0||bytes.length>MAX_BYTES)throw new Error("CLAMD_BYTES_OUT_OF_RANGE");
 const socketPath=localSocketPath();
 // Use a short-lived local UNIX socket for both VERSION and INSTREAM.
 // In CI a synthetic signature DB is used; this DOES NOT assert daily CVD freshness.
 let version=await command(socketPath,Buffer.from("zVERSION\0"));
 if(version==="COMMAND UNAVAILABLE"){
  // Some hardened ClamAV daemons disable VERSION: check exact local PING.
  // PONG alone is NOT a signature freshness certification.
  const ping=await command(socketPath,Buffer.from("zPING\0"));
  if(ping!=="PONG")throw new Error("CLAMD_PING_UNVERIFIED");
  version="ClamAV PING_OK_VERSION_DISABLED";
 }else if(!/^ClamAV [0-9][\x20-\x7e]{3,200}$/.test(version)){
  throw new Error("CLAMD_VERSION_UNVERIFIED");
 }
 const size=Buffer.alloc(4);size.writeUInt32BE(bytes.length,0);
 const zero=Buffer.alloc(4);
 const result=await command(socketPath,Buffer.concat([
   Buffer.from("zINSTREAM\0"),size,bytes,zero
 ]));
 if(/^stream: OK$/.test(result))
   return {verdict:"CLEAN",engine:version,signature:"NONE"};
 const found=/^stream: ([\w.:-]{1,120}) FOUND$/.exec(result);
 if(found)return {verdict:"MALWARE",engine:version,signature:found[1]};
 throw new Error("CLAMD_SCAN_FAILED_CLOSED");
}
