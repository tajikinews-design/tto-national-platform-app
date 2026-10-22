# CF03 ClamAV scanner transport

This is a **real TCP ClamAV clamd INSTREAM client**: it frames length-prefixed bytes, enforces a size cap, times out safely, classifies only explicit OK/FOUND and treats missing/invalid responses as failures.

The CI suite runs against a **synthetic mock TCP scanner**. This validates wire framing, classification, timeout/error logic; it is **NOT evidence of actual anti-malware signature detection by ClamAV**. A future staging test must use a trusted, signature-updated ClamAV service (EICAR test artifact only), S3-compatible object store, scanner-only DB credentials and durability/retry checks. Never store or disclose malware payloads in GitHub.

The current SQL layer restricts scan verdict mutation to `tto_scanner` role and marks file objects pending until a clean attestation. The worker that fetches quarantined objects from approved storage, calls this adapter, and writes scan attestations is **not wired** until object-store/provider configuration and secret delivery are approved.
