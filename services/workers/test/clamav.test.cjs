"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const {scanBytes} = require("../src/clamav.cjs");

async function fakeClamd(reply, action) {
  const srv = net.createServer(socket => {
    const chunks=[];
    socket.on("data", d => {
      chunks.push(d);
      const bytes = Buffer.concat(chunks);
      const pre = Buffer.from("zINSTREAM\0");
      if(bytes.length < pre.length+8) return;
      assert.ok(bytes.subarray(0,pre.length).equals(pre));
      const n = bytes.readUInt32BE(pre.length);
      if(bytes.length < pre.length+8+n) return;
      assert.equal(bytes.readUInt32BE(pre.length+4+n),0);
      action?.(bytes.subarray(pre.length+4,pre.length+4+n));
      if(reply!==null)socket.end(Buffer.from(reply+"\0"));
      else socket.destroy();
    });
  });
  await new Promise(resolve=>srv.listen(0,"127.0.0.1",resolve));
  return {srv,port:srv.address().port};
}
test("clean content requires an explicit ClamAV OK reply", async()=>{
 const {srv,port}=await fakeClamd("stream: OK",data=>assert.equal(data.toString(),"synthetic-clean"));
 try {
   const out=await scanBytes(Buffer.from("synthetic-clean"),{host:"127.0.0.1",port});
   assert.equal(out.verdict,"CLEAN");
 } finally {srv.close();}
});
test("signature detection blocks content",async()=>{
 const {srv,port}=await fakeClamd("stream: Eicar-Test-Signature FOUND");
 try { assert.equal((await scanBytes(Buffer.from("test bytes"),{host:"127.0.0.1",port})).verdict,"BLOCKED"); }
 finally {srv.close();}
});
test("scanner errors and unexpected replies fail closed",async()=>{
 const {srv,port}=await fakeClamd("stream: ERROR");
 try { await assert.rejects(scanBytes(Buffer.from("test"),{host:"127.0.0.1",port}),/SCAN_ENGINE_ERROR/); }
 finally {srv.close();}
});
test("empty/oversized payloads and missing host denied",async()=>{
 await assert.rejects(scanBytes(Buffer.alloc(0),{host:"127.0.0.1",port:3310}),/INVALID_SCAN_PAYLOAD/);
 await assert.rejects(scanBytes(Buffer.alloc(100),{host:"127.0.0.1",port:3310,maxBytes:10}),/SCAN_SIZE_LIMIT/);
 await assert.rejects(scanBytes(Buffer.from("data"),{}),/CLAMD_NOT_CONFIGURED/);
});
test("closed scanner connection never produces CLEAN",async()=>{
 const {srv,port}=await fakeClamd(null);
 try { await assert.rejects(scanBytes(Buffer.from("not scanned"),{host:"127.0.0.1",port}),/SCAN_UNTRUSTED_CLOSED/); }
 finally {srv.close();}
});
