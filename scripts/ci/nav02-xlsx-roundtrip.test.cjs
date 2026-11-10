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

test("NAV02 complete 25-column Persian worksheet has visible nonempty data",()=>{
 const headers=Array.from({length:25},(_,i)=>"ستون شماره "+(i+1));
 const values=Array.from({length:25},(_,i)=>"نمونه مقدار "+(i+1));
 values[3]="1234567891";values[4]="09000000000";
 const xlsx=workbookXlsx([headers,values]);
 const sheet=parseMemberXlsx(xlsx);
 assert.equal(sheet.length,2);
 assert.equal(sheet[0].length,25);
 assert.equal(sheet[1].length,25);
 assert.deepEqual(sheet,[headers,values]);
 assert.ok(xlsx.includes(Buffer.from("xl/styles.xml")));
 assert.ok(xlsx.includes(Buffer.from("xl/worksheets/sheet1.xml")));
});

test("NAV02 legacy cooperative prefix hides only for matching workspace without ledger rewrite",()=>{
 const source=fs.readFileSync(resolve(ROOT,"apps/cooperative-management/lib/nav02-member-number.ts"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const helper={exports:{}};
 new Function("require","module","exports",compiled)(require,helper,helper.exports);
 const display=helper.exports.displayMemberNumber;
 assert.equal(display("torghabeh","torghabeh-001003"),"001003");
 assert.equal(display("torghabeh","001004"),"001004");
 assert.equal(display("other","torghabeh-001003"),"torghabeh-001003");
 assert.equal(display("torghabeh",null),null);
});
