/* Real HTTP+PostgreSQL integration checks: synthetic fixtures only, no persisted test credentials. */
const { Client } = require("pg");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userA = "55555555-5555-4555-8555-555555555555";
const userB = "22222222-2222-4222-8222-222222222222";
const dbUrl = process.env.TEST_ADMIN_DATABASE_URL;
if (!dbUrl) throw Error("TEST_ADMIN_DATABASE_URL required; synthetic CI DB only");
const admin = new Client({ connectionString: dbUrl });
let server;

async function waitForServer(base) {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Nest server exited before health endpoint");
    try {
      const res = await fetch(base + "/health");
      if (res.status === 200) return;
    } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw Error("Nest did not start");
}
async function assertRequest(base, path, token, expected, validate) {
  const response = await fetch(base + path, {
    headers: token ? {authorization: "Bearer " + token} : {}
  });
  assert.equal(response.status, expected, path + " expected " + expected + " got " + response.status);
  if (validate) await validate(await response.json());
}
async function issueSession(userId) {
  const opaqueToken = randomBytes(48).toString("base64url");
  const hash = createHash("sha256").update(opaqueToken).digest();
  await admin.query(
    "INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at) VALUES($1,$2,$3,0,now()+interval '5 minutes')",
    [randomUUID(), userId, hash]
  );
  return opaqueToken;
}
async function run() {
  await admin.connect();
  await admin.query("ALTER ROLE tto_app LOGIN"); // only ephemeral CI database; no password or remote access
  await admin.query("INSERT INTO tto.user_accounts(user_id) VALUES($1)", [userA]);
  await admin.query(
    "INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES($1,$2,$3,'MEMBER')",
    [randomUUID(), userA, tenantA]
  );
  const tokenA = await issueSession(userA);
  const tokenB = await issueSession(userB);
  const port = 31239;
  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {...process.env,DATABASE_URL:"postgresql://tto_app@127.0.0.1:5432/tto",PORT:String(port)},
    stdio:["ignore","pipe","pipe"]
  });
  // Keep logging redacted and only on test failure. Never print a session token.
  let serverError = "";
  server.stderr.on("data", data => {serverError += data.toString().slice(0, 1000);});
  const base = "http://127.0.0.1:" + port;
  await waitForServer(base);
  await assertRequest(base, "/v1/tenants/" + tenantA + "/context", null, 401);
  await assertRequest(base, "/v1/tenants/" + tenantA + "/context", tokenA, 200,
    body => assert.equal(body.tenant_id,tenantA));
  await assertRequest(base, "/v1/tenants/" + tenantB + "/context", tokenA, 403);
  await assertRequest(base, "/v1/tenants/" + tenantA + "/documents", tokenA, 200, body => {
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].title, "Synthetic A member notice");
    assert.equal(body.items.some(d=>d.classification === "RESTRICTED" || d.classification === "HIGHLY_RESTRICTED"),false);
  });
  await assertRequest(base, "/v1/tenants/" + tenantB + "/documents", tokenA, 403);
  await assertRequest(base, "/v1/tenants/" + tenantB + "/documents", tokenB, 200, body => {
    assert.equal(body.items.length,1);
    assert.equal(body.items[0].title,"Synthetic B member notice");
  });
  await admin.query("UPDATE tto.role_assignments SET revoked_at=now() WHERE user_id=$1",[userA]);
  await assertRequest(base, "/v1/tenants/" + tenantA + "/context", tokenA, 403);
  await admin.query("UPDATE tto.user_accounts SET security_epoch=1 WHERE user_id=$1",[userB]);
  await assertRequest(base, "/v1/tenants/" + tenantB + "/context", tokenB, 401);
  await assertRequest(base, "/v1/tenants/" + tenantB + "/context", "invalid-token-not-valid", 401);
  console.log("TTO_API_POSTGRES_INTEGRATION_PASS: 10 authenticated/negative HTTP cases");
}
run().catch(err => {console.error("TTO_API_POSTGRES_INTEGRATION_FAIL:", err.message);process.exitCode=1;})
.finally(async () => {
  if (server && server.exitCode === null) server.kill("SIGTERM");
  await admin.end().catch(() => {});
});
