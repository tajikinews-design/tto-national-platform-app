import { PortalShell, OtpLogin } from "@tto/ui";
// Availability of the protected API is resolved at runtime, never frozen at build time.
export const dynamic = "force-dynamic";
export default function Home() { return <PortalShell surface="national"><OtpLogin enabled={Boolean(process.env.TTO_API_BASE_URL)}/></PortalShell>; }
