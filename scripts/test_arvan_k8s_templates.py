#!/usr/bin/env python3
"""Static validation only; NEVER deploy manifests."""
from pathlib import Path
import yaml

root=Path(__file__).resolve().parents[1]
resources=[x for x in yaml.safe_load_all((root/"infra/arvan/k8s/base.yaml").read_text()) if x]
deploy=[x for x in resources if x["kind"]=="Deployment"]
svc=[x for x in resources if x["kind"]=="Service"]
names={"tto-shareholder","tto-cooperative-management","tto-national-admin","tto-api"}
assert len(deploy)==len(svc)==4
assert {x["metadata"]["name"] for x in deploy}==names
assert {x["metadata"]["name"] for x in svc}==names
for d in deploy:
    pod=d["spec"]["template"]["spec"]
    assert not pod["automountServiceAccountToken"]
    assert pod["securityContext"]["runAsNonRoot"]
    c=pod["containers"][0]
    assert c["image"].startswith("registry.example.invalid/")
    assert "REPLACE_WITH_APPROVED_DIGEST" in c["image"]
    assert c["securityContext"]["allowPrivilegeEscalation"] is False
    assert c["readinessProbe"]["httpGet"]["path"]==("/ready" if c["name"]=="api" else "/")
    assert not any("password" in str(v).lower() and "value" in v for v in c.get("env",[]))
    if c["name"]=="api":
        secrets=[e.get("valueFrom",{}).get("secretKeyRef") for e in c.get("env",[]) if "valueFrom" in e]
        assert len(secrets)==2 and all(x["name"]=="tto-api-runtime" for x in secrets)
print("TTO_ARVAN_STATIC_K8S_PORTABILITY_PASS_4_SERVICES_NO_DEPLOY")
