/** Minimal bounded XLSX interchange for NAV02 preview/export without extra packages.
 * Does not parse formulas, macros, external links, drawings, encrypted archives
 * or arbitrary XML extensions. Formula-bearing input is rejected fail closed.
 */
import {deflateRawSync,inflateRawSync} from "node:zlib";
const MAX_XLSX=2*1024*1024,MAX_XML=3*1024*1024,MAX_ROWS=250,MAX_COLS=36;
function crc32(buf:Buffer){let crc=0xffffffff;for(const x of buf){
 crc^=x;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
}return(crc^0xffffffff)>>>0}
const xmlEscape=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;")
 .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const xmlDecode=(s:string)=>s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,(_,v:string)=>{
 if(v==="amp")return "&";if(v==="lt")return "<";if(v==="gt")return ">";
 if(v==="quot")return '"';if(v==="apos")return "'";
 const n=v.startsWith("#x")?parseInt(v.slice(2),16):parseInt(v.slice(1),10);
 return Number.isSafeInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):"";
});
function colName(index:number){let result="";for(let v=index+1;v;v=Math.floor((v-1)/26))
 result=String.fromCharCode(65+(v-1)%26)+result;return result}
export function workbookXlsx(rows:string[][]):Buffer{
 if(rows.length<1||rows.length>MAX_ROWS||rows.some(row=>row.length>MAX_COLS))
  throw Error("ROW_LIMIT");
 const source=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{
  const cell=String(v??"").slice(0,1000);
  // Inline strings avoid auto-number coercion and Excel formula injection.
  return '<c r="'+colName(j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+
   xmlEscape(/^[=+@\-\t\r]/.test(cell)?"'"+cell:cell)+'</t></is></c>';
 }).join("")+'</row>').join("");
 const files:[string,string][]=[
  ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
  ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="اعضا" sheetId="1" r:id="rId1"/></sheets></workbook>'],
  ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ["xl/worksheets/sheet1.xml",'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>'+source+'</sheetData></worksheet>']
 ];
 const locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,data] of files){
  const n=Buffer.from(name,"utf8"),plain=Buffer.from(data,"utf8");
  const zipped=deflateRawSync(plain),crc=crc32(plain);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);
  h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);
  h.writeUInt32LE(zipped.length,18);h.writeUInt32LE(plain.length,22);
  h.writeUInt16LE(n.length,26);
  locals.push(h,n,zipped);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);
  c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(zipped.length,20);
  c.writeUInt32LE(plain.length,24);c.writeUInt16LE(n.length,28);
  c.writeUInt32LE(offset,42);central.push(c,n);
  offset+=h.length+n.length+zipped.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
 end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,...central,end]);
}
function zipEntries(buffer:Buffer){
 if(buffer.length<50||buffer.length>MAX_XLSX)throw Error("XLSX_SIZE_LIMIT");
 const endAt=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(endAt<0||endAt+22>buffer.length)throw Error("INVALID_XLSX_ZIP");
 const count=buffer.readUInt16LE(endAt+10),offset=buffer.readUInt32LE(endAt+16);
 if(count<1||count>60||offset>=endAt)throw Error("XLSX_STRUCTURE_LIMIT");
 let p=offset,total=0;const found=new Map<string,string>();
 for(let i=0;i<count;i++){
  if(p+46>buffer.length||buffer.readUInt32LE(p)!==0x02014b50)throw Error("INVALID_XLSX_ENTRY");
  const method=buffer.readUInt16LE(p+10),flags=buffer.readUInt16LE(p+8);
  const crc=buffer.readUInt32LE(p+16),size=buffer.readUInt32LE(p+20);
  const rawSize=buffer.readUInt32LE(p+24),n=buffer.readUInt16LE(p+28);
  const extra=buffer.readUInt16LE(p+30),comment=buffer.readUInt16LE(p+32);
  const local=buffer.readUInt32LE(p+42);
  if(n<1||n>255||rawSize>MAX_XML||size>MAX_XLSX||total+rawSize>6*MAX_XML||
   flags&1||!([0,8].includes(method))||p+46+n+extra+comment>buffer.length)
    throw Error("UNSAFE_XLSX_ENTRY");
  const name=buffer.subarray(p+46,p+46+n).toString("utf8");
  if(name.includes("..")||name.startsWith("/")||found.has(name))throw Error("INVALID_XLSX_PATH");
  if(/vbaProject|externalLinks|connections|embeddings|activeX|oleObject/i.test(name))
   throw Error("ACTIVE_XLSX_NOT_ALLOWED");
  if(name.endsWith(".xml")){
   if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)
    throw Error("INVALID_XLSX_LOCAL_HEADER");
   const dataAt=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
   if(dataAt+size>buffer.length)throw Error("TRUNCATED_XLSX_ENTRY");
   const raw=method===8?inflateRawSync(buffer.subarray(dataAt,dataAt+size),
    {maxOutputLength:MAX_XML}):buffer.subarray(dataAt,dataAt+size);
   if(raw.length!==rawSize||crc32(raw)!==crc)throw Error("INVALID_XLSX_CRC");
   found.set(name,raw.toString("utf8"));total+=rawSize;
  }
  p+=46+n+extra+comment;
 }
 return found;
}
export function parseMemberXlsx(buffer:Buffer):string[][]{
 const files=zipEntries(buffer);
 if([...files.keys()].some(k=>/vbaProject|externalLinks|connections/i.test(k)))
  throw Error("ACTIVE_XLSX_NOT_ALLOWED");
 const sheet=files.get("xl/worksheets/sheet1.xml");
 if(!sheet)throw Error("MISSING_FIRST_WORKSHEET");
 if(/<(?:(?:\w+):)?f(?:\s|>)/i.test(sheet))throw Error("FORMULAS_NOT_ALLOWED");
 const shared=files.get("xl/sharedStrings.xml")||"";
 const sharedStrings=[...shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
  .map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
   .map(t=>xmlDecode(t[1])).join(""));
 const rows:string[][]=[];
 for(const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  if(rows.length>=MAX_ROWS)throw Error("TOO_MANY_ROWS");
  const cells:string[]=[];
  for(const match of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
   const ref=/\br="([A-Z]{1,2})[0-9]+"/.exec(match[1]);
   if(!ref)throw Error("MISSING_CELL_REFERENCE");
   let col=0;for(const ch of ref[1])col=col*26+ch.charCodeAt(0)-64;col--;
   if(col>=MAX_COLS)throw Error("TOO_MANY_COLUMNS");
   const type=/\bt="([^"]+)"/.exec(match[1])?.[1]||"n";
   const val=type==="inlineStr"?[...match[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map(x=>xmlDecode(x[1])).join(""):xmlDecode(/<v>([\s\S]*?)<\/v>/.exec(match[2])?.[1]||"");
   if(type==="s"&&!/^\d+$/.test(val))throw Error("INVALID_SHARED_STRING");
   cells[col]=type==="s"?(sharedStrings[Number(val)]??""):val;
  }
  rows.push(Array.from({length:Math.max(0,cells.length)},(_,i)=>String(cells[i]??"").slice(0,1000)));
 }
 if(!rows.length)throw Error("EMPTY_WORKBOOK");
 return rows;
}
