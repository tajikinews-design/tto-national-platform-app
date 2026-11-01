"use strict";
/**
 * Deliberately hostile child process for W2.2 cancellation tests.
 * Runs only when launched from an explicitly marked offline CI process.
 * No real sources, network or user data.
 */
if(process.env.TTO_W22_CHILD_FIXTURE!=="1"||
   process.env.DATABASE_URL||process.env.APIIR_TOKEN||
   process.env.TTO_API_BASE_URL||process.env.TEST_ADMIN_DATABASE_URL||
   process.env.VERCEL)process.exit(92);

const mode=process.argv[2];
switch(mode){
 case "hang":
  // AbortSignal must terminate this even though it never sends a reply.
  setInterval(()=>{},5000);
  break;
 case "late":
  // Even a syntactically positive response arrives too late for the deadline.
  setTimeout(()=>{
   process.stdout.write(JSON.stringify({
    decision:"SIMULATED_ALLOW",reasonCode:"SIMULATION_ONLY",
    requestId:"11111111-1111-4111-8111-111111111111",
    fixtureTouches:1,auditCount:1,
    legalOperationalEffect:"NONE",canGrantPermission:false,
    hasActualRecord:false
   })+"\n");
  },600);
  break;
 case "crash":
  process.exit(77);
  break;
 case "invalid":
  process.stdout.write('{"unexpected":true}\n');
  break;
 case "oversize":
  process.stdout.write("x".repeat(9000));
  break;
 default:
  process.exit(93);
}
