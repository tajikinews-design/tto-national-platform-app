/** Deterministic LOCAL CI ONLY clamd protocol double.
 * Not actual ClamAV, not production malware clearance or fresh CVD.
 */
"use strict";
const {createServer}=require("node:net");
const {unlink}=require("node:fs/promises");
function mockClamd(socketPath){
 const server=createServer({allowHalfOpen:true},socket=>{
  const chunks=[];
  socket.on("data",chunk=>chunks.push(chunk));
  socket.on("end",()=>{
   const payload=Buffer.concat(chunks);
   let answer="stream: ERROR\0";
   if(payload.subarray(0,9).equals(Buffer.from("zVERSION\0")))
    answer="ClamAV 1.4.0/CI-SYNTHETIC\0";
   else if(payload.subarray(0,10).equals(Buffer.from("zINSTREAM\0")))
    answer=payload.includes(Buffer.from("EICAR"))?
      "stream: Eicar-Test-Signature FOUND\0":"stream: OK\0";
   socket.end(Buffer.from(answer));
  });
 });
 return {
  async start(){
   await unlink(socketPath).catch(e=>{if(e.code!=="ENOENT")throw e;});
   await new Promise((resolve,reject)=>{
    server.once("error",reject);server.listen(socketPath,resolve);
   });return socketPath;
  },
  async stop(){
   await new Promise(resolve=>server.close(resolve));
   await unlink(socketPath).catch(()=>{});
  }
 };
}
module.exports={mockClamd};
