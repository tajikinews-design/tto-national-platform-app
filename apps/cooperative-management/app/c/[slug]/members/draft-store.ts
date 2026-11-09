/* Browser-tab memory only. NO persistent storage, API, cookies, localStorage or network.
   Holds fictional preview form entries; lost on hard reload / tab close.
   This is NOT Member Master or official share ownership. */
export type InvestorTitle="آقا"|"خانم"|"شرکت"|"سازمان"|"اداره";
export type DraftPerson={
 id:string;title:InvestorTitle;fullName:string;group:string;nationalIdentifier:string;
 fatherName:string;birthCertificate:string;birthDate:string;birthPlace:string;
 telephone:string;mobile:string;postalCode:string;address:string;
 photoName:string;createdAt:string;
};
export type DraftCapital={
 id:string;personId:string;initialShares:string;committedShares:string;
 nominalValue:string;paidAmount:string;paymentDate:string;receiptNumber:string;createdAt:string;
};
type DraftBucket={people:DraftPerson[];capital:DraftCapital[]};
const buckets=new Map<string,DraftBucket>();
function bucket(slug:string):DraftBucket{
 let b=buckets.get(slug);
 if(!b){b={people:[],capital:[]};buckets.set(slug,b)}
 return b;
}
export function peopleFor(slug:string):DraftPerson[]{return [...bucket(slug).people]}
export function capitalFor(slug:string):DraftCapital[]{return [...bucket(slug).capital]}
export function addPerson(slug:string,person:DraftPerson):boolean{
 const b=bucket(slug);
 if(b.people.some(p=>p.nationalIdentifier===person.nationalIdentifier))return false;
 b.people=[person,...b.people];return true;
}
export function addCapital(slug:string,record:DraftCapital):boolean{
 const b=bucket(slug);
 if(!b.people.some(x=>x.id===record.personId))return false;
 b.capital=[record,...b.capital];return true;
}
export function clearDrafts(slug:string){buckets.delete(slug)}
export function latinDigits(input:string):string{
 return input.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
 .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
}
export function maskIdentifier(value:string):string{
 return value.length<5?"••••":value.slice(0,2)+"••••"+value.slice(-3);
}
