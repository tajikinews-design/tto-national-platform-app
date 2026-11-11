"use strict";
/**
 * National-root credential policy for owner-selected initial Preview credentials.
 * The owner's national ID is the username; their verified mobile is the initial
 * password. No identifier or password is embedded, logged, or committed.
 * This module does NOT create an administrator or grant any authorization.
 */
const {randomBytes,scryptSync,timingSafeEqual}=require("node:crypto");

function isNationalId(value){
 if(typeof value!=="string"||!/^\d{10}$/.test(value)||/^(\d)\1{9}$/.test(value))return false;
 const check=Number(value[9]);
 let sum=0;for(let i=0;i<9;i++)sum+=Number(value[i])*(10-i);
 const remainder=sum%11;
 return check===(remainder<2?remainder:11-remainder);
}
function isMobile(value){
 return typeof value==="string"&&/^09\d{9}$/.test(value);
}
function createNationalRootInitialScrypt({nationalId,mobile}){
 if(!isNationalId(nationalId)||!isMobile(mobile))
  throw Error("INVALID_NATIONAL_ID_OR_MOBILE");
 const salt=randomBytes(16);
 const digest=scryptSync(mobile,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return {username:nationalId,passwordScrypt:"scrypt$v1$"+salt.toString("hex")+"$"+digest.toString("hex")};
}
function verifiesInitialMobileHash(mobile,encoded){
 if(!isMobile(mobile)||typeof encoded!=="string"||
    !/^scrypt\$v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded))return false;
 const [, ,salt,hex]=encoded.split("$");
 const compare=scryptSync(mobile,Buffer.from(salt,"hex"),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(compare,Buffer.from(hex,"hex"));
}
module.exports={isNationalId,isMobile,createNationalRootInitialScrypt,verifiesInitialMobileHash};
