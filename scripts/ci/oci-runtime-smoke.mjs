const TARGET = "http://127.0.0.1:3000/";
export function pageIsSafe(status, html) {
  return status === 200 && html.includes('dir="rtl"') && html.includes("\u062f\u0627\u062f\u0647");
}
export async function verifyHome(request = fetch) {
  try {
    const response = await request(TARGET, {redirect:"manual", signal:AbortSignal.timeout(3000)});
    return response.status === 200 && pageIsSafe(response.status, await response.text());
  } catch { return false; }
}
if (process.argv[1]?.endsWith("oci-runtime-smoke.mjs")) {
  const ok = await verifyHome();
  process.stdout.write(ok ? "TTO_OCI_RUNTIME_PASS\n" : "TTO_OCI_RUNTIME_NOT_READY\n");
  if (!ok) process.exitCode = 1;
}
