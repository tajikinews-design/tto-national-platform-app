import {NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/**
 * National portal is password-only. OTP remains enabled exclusively in
 * cooperative management and shareholder applications.
 * Do not mint an OTP session cookie on the national origin.
 */
export async function POST(){
 return NextResponse.json({error:"NATIONAL_ROOT_CREDENTIALS_ONLY"},
  {status:403,headers:{"Cache-Control":"no-store, private"}});
}
