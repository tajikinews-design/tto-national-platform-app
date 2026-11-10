"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const fs=require("node:fs");
const {resolve}=require("node:path");
const {createRequire}=require("node:module");
const ROOT=resolve(__dirname,"../..");
const ts=createRequire(resolve(ROOT,"apps/cooperative-management/package.json"))("typescript");
const file=resolve(ROOT,"apps/cooperative-management/lib/nav02-xlsx.ts");
const out=ts.transpileModule(fs.readFileSync(file,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  esModuleInterop:true}}).outputText;
const mod={exports:{}};
new Function("require","module","exports",out)(require,mod,mod.exports);
const {workbookXlsx,parseMemberXlsx}=mod.exports;
test("NAV02 real Excel ZIP UTF8 Persian and leading zeros roundtrip",()=>{
 const rows=[["نام","کد ملی","شماره همراه"],["شخص ساختگی","0012345678","09111111111"]];
 const buffer=workbookXlsx(rows);
 assert.equal(buffer.subarray(0,2).toString("ascii"),"PK");
 assert.deepEqual(parseMemberXlsx(buffer),rows);
});
test("NAV02 typed values and Excel formula escape",()=>{
 const buf=workbookXlsx([["عنوان","نام"],["آزمایش","=HYPERLINK(\"http://bad\")"]]);
 const data=parseMemberXlsx(buf);
 assert.equal(data[1][1],"'=HYPERLINK(\"http://bad\")");
});
test("NAV02 malformed archive and size limits fail closed",()=>{
 assert.throws(()=>parseMemberXlsx(Buffer.from("fake")));
 assert.throws(()=>parseMemberXlsx(Buffer.alloc(2097153)));
 assert.throws(()=>workbookXlsx(Array.from({length:251},()=>["x"])));
});
