#!/usr/bin/env python3
"""Offline, fail-closed evidence preflight for the planned TTO ArvanCloud release.

This is not a deployment command and does not authenticate to any cloud. It
checks operator-supplied evidence shape before human verification. Never put
passwords, tokens, private keys, PII, or database URLs in the evidence JSON.
"""
import json
import re
import sys
from pathlib import Path

PREVIEW_DB = "zkfwsgrgslxxlusxrwce"
SERVICES = ("shareholder", "cooperative-management", "national-admin", "api")
FIELDS = {
    "release": ("owner_approval_ref", "reviewed_commit", "release_review_ref"),
    "arvan": ("account_ref", "cluster_ref", "namespace_ref", "region_approval_ref",
              "tls_ingress_evidence", "private_registry_evidence",
              "secret_injection_evidence", "rollback_evidence"),
    "database": ("production_instance_ref", "migration_evidence", "restricted_role_evidence",
                 "backup_restore_evidence", "residency_approval_ref"),
    "acceptance": ("national_login_e2e", "cooperative_registration_e2e",
                   "cooperative_login_e2e", "shareholder_login_e2e",
                   "tenant_isolation_e2e", "audit_evidence", "security_signoff"),
}
DIGEST = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._:/-]+@sha256:[a-fA-F0-9]{64}$")
SHA = re.compile(r"^[a-fA-F0-9]{40}$")
FORBIDDEN_KEYS = re.compile(r"(?:^|[_-])(password|api[_-]?key|private[_-]?key|access[_-]?token|bearer|credential|database[_-]?url)(?:$|[_-])", re.I)


def checks(evidence):
    failures = []
    if not isinstance(evidence, dict):
        return ["evidence MUST be a JSON object"]
    if evidence.get("provider") != "arvancloud":
        failures.append("provider must be arvancloud")
    if evidence.get("environment") != "production":
        failures.append("environment must be production")
    if evidence.get("deployed") is True:
        failures.append("preflight cannot validate an already-deployed claim")
    for section, keys in FIELDS.items():
        data = evidence.get(section)
        if not isinstance(data, dict):
            failures.append(f"{section}: section is required")
            continue
        for key in keys:
            value = data.get(key)
            if not isinstance(value, str) or len(value.strip()) < 8 or "REPLACE_" in value.upper():
                failures.append(f"{section}.{key}: verified evidence reference required")
    release = evidence.get("release") or {}
    if isinstance(release, dict) and not SHA.fullmatch(str(release.get("reviewed_commit", ""))):
        failures.append("release.reviewed_commit: exact 40-character SHA required")
    db = evidence.get("database") or {}
    if isinstance(db, dict):
        ref = str(db.get("production_instance_ref", ""))
        if PREVIEW_DB in ref or "preview" in ref.lower() or "demo" in ref.lower():
            failures.append("database.production_instance_ref: must be independent of preview/demo")
    images = evidence.get("images")
    if not isinstance(images, dict) or set(images) != set(SERVICES):
        failures.append("images: four exact service names required")
    else:
        for service in SERVICES:
            image = images[service]
            if (not isinstance(image, str) or not DIGEST.fullmatch(image)
                    or "example.invalid" in image or "placeholder" in image.lower()):
                failures.append(f"images.{service}: approved private registry sha256 digest required")
    def scan(obj, prefix=""):
        if isinstance(obj, dict):
            for key, value in obj.items():
                field = f"{prefix}.{key}" if prefix else key
                if FORBIDDEN_KEYS.search(key):
                    failures.append(f"{field}: secret-like field forbidden in evidence")
                scan(value, field)
        elif isinstance(obj, list):
            for idx, value in enumerate(obj):
                scan(value, f"{prefix}[{idx}]")
        elif isinstance(obj, str):
            if re.search(r"://[^/\s@]+:[^/\s@]+@", obj) or "-----BEGIN PRIVATE KEY-----" in obj:
                failures.append(f"{prefix}: embedded credential forbidden")
    scan(evidence)
    return sorted(set(failures))


def main(argv):
    if len(argv) != 2:
        print("BLOCKED: evidence JSON path required; no deployment performed")
        return 2
    try:
        raw = Path(argv[1]).read_text(encoding="utf-8")
        evidence = json.loads(raw)
    except (OSError, ValueError):
        print("BLOCKED: evidence file cannot be read as JSON; no deployment performed")
        return 2
    failures = checks(evidence)
    if failures:
        print("BLOCKED: ArvanCloud production release evidence incomplete; NO DEPLOY")
        for failure in failures:
            print(" - " + failure)
        return 1
    print("EVIDENCE_PRESENT_NOT_DEPLOYED: structural checklist complete.")
    print("Human verification of evidence, exact cloud configuration, and explicit release approval remain mandatory.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
