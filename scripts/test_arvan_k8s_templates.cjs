"use strict";

/**
 * Arvan Kubernetes static lint only. No network, no kubectl and no deploy.
 * The pinned js-yaml dependency is already present in pnpm-lock.yaml and is
 * installed with the other project dependencies before the Release stage.
 * Preserve the checks of scripts/test_arvan_k8s_templates.py.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "..");
const manifest = path.join(root, "infra", "arvan", "k8s", "base.yaml");
const names = new Set([
  "tto-shareholder",
  "tto-cooperative-management",
  "tto-national-admin",
  "tto-api",
]);

function verifyManifest(raw) {
  // js-yaml 4.x uses safe loading by default; duplicate mapping keys fail.
  const documents = yaml.loadAll(raw).filter(Boolean);
  const deployments = documents.filter((r) => r && r.kind === "Deployment");
  const services = documents.filter((r) => r && r.kind === "Service");
  assert.equal(documents.length, 8, "Unexpected manifest documents");
  assert.equal(deployments.length, 4, "Expected 4 Deployment resources");
  assert.equal(services.length, 4, "Expected 4 Service resources");
  assert.deepEqual(new Set(deployments.map((r) => r.metadata.name)), names);
  assert.deepEqual(new Set(services.map((r) => r.metadata.name)), names);

  for (const deployment of deployments) {
    const pod = deployment.spec.template.spec;
    assert.equal(pod.automountServiceAccountToken, false, "ServiceAccount token must not mount");
    assert.equal(pod.securityContext.runAsNonRoot, true, "Pod must run non-root");
    const [container, ...extra] = pod.containers;
    assert.equal(extra.length, 0, "Unexpected extra application container");
    assert.equal(typeof container.image, "string");
    assert.ok(container.image.startsWith("registry.example.invalid/"), "Image registry placeholder required");
    assert.ok(container.image.includes("REPLACE_WITH_APPROVED_DIGEST"), "Unapproved image digest");
    assert.equal(container.securityContext.allowPrivilegeEscalation, false, "Privilege escalation allowed");
    assert.equal(
      container.readinessProbe.httpGet.path,
      container.name === "api" ? "/ready" : "/",
      "Incorrect readiness probe",
    );

    const env = container.env || [];
    assert.ok(Array.isArray(env), "Unexpected env shape");
    assert.ok(!env.some((value) =>
      JSON.stringify(value).toLowerCase().includes("password") &&
      Object.prototype.hasOwnProperty.call(value, "value")
    ), "Plaintext password in environment");

    if (container.name === "api") {
      const secrets = env
        .filter((e) => Object.prototype.hasOwnProperty.call(e, "valueFrom"))
        .map((e) => e.valueFrom?.secretKeyRef);
      assert.equal(secrets.length, 2, "Expected exactly 2 API secret references");
      assert.ok(secrets.every((s) => s?.name === "tto-api-runtime"), "Unapproved API secret source");
    }
  }
  return true;
}

// Negative regressions prove the validator rejects insecure manifests.
const original = fs.readFileSync(manifest, "utf8");
verifyManifest(original);
const mutations = [
  ["token mount", "automountServiceAccountToken: false", "automountServiceAccountToken: true"],
  ["root pod", "runAsNonRoot: true", "runAsNonRoot: false"],
  ["privilege", "allowPrivilegeEscalation: false", "allowPrivilegeEscalation: true"],
  ["registry", "registry.example.invalid/", "unapproved.example/"],
  ["digest", "REPLACE_WITH_APPROVED_DIGEST", "latest"],
  ["API secret", "name: tto-api-runtime", "name: unapproved-secret"],
  ["API readiness", "path: /ready", "path: /wrong"],
];
for (const [label, before, after] of mutations) {
  assert.ok(original.includes(before), "Missing regression fixture: " + label);
  assert.throws(() => verifyManifest(original.replace(before, after)), {name: "AssertionError"}, label);
}
console.log("TTO_ARVAN_STATIC_K8S_PORTABILITY_PASS_4_SERVICES_NO_DEPLOY");
console.log("TTO_ARVAN_STATIC_K8S_NEGATIVE_TESTS_PASS=" + mutations.length);
console.log("TTO_ARVAN_YAML_LINT_NETWORK_INSTALLS=0");
