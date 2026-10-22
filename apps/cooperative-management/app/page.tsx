import { PortalShell, OtpLogin } from "@tto/ui";
export default function Home() { return <PortalShell surface="cooperative"><OtpLogin enabled={Boolean(process.env.TTO_API_BASE_URL)}/></PortalShell>; }
