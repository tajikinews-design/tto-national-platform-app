import test from "node:test";
import assert from "node:assert/strict";
import { pageIsSafe, verifyHome } from "./oci-runtime-smoke.mjs";

const valid = '<html><main dir="rtl">داده تأییدشده در دسترس نیست</main></html>';
test("OCI preview requires HTTP 200, RTL and non-fabricated data", () => {
  assert.equal(pageIsSafe(200, valid), true);
  assert.equal(pageIsSafe(401, valid), false);
  assert.equal(pageIsSafe(200, '<html dir="ltr">داده</html>'), false);
  assert.equal(pageIsSafe(200, '<html dir="rtl">خدمات</html>'), false);
});
test("OCI probe uses only internal loopback and rejects redirects", async () => {
  let address;
  const ok = await verifyHome(async (url, opts) => {
    address = url;
    assert.equal(opts.redirect, "manual");
    return {status:200, text:async()=>valid};
  });
  assert.equal(ok, true);
  assert.equal(address, "http://127.0.0.1:3000/");
  assert.equal(await verifyHome(async()=>({status:302,text:async()=>valid})),false);
});
test("connection refusal fails closed",async()=>{
  assert.equal(await verifyHome(async()=>{throw Error("Connection refused")}),false);
});
