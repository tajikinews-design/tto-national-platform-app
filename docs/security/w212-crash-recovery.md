# W2.12 — synthetic crash-recoverable coordinator

Baseline: W2.11 exact SHA `53a6046e90f94d026df1bc9ec528c6be5dad5d63`.

W2.12 adds a disposable filesystem append-only hash-chained journal for simulated REVOKE, ROTATE and COMMIT records. A clean restart replays records, restores revocation/epoch, detects duplicate simulated effects and rejects tampered, missing, reordered or torn log entries. Each record is fsync-ed before reporting success. A failed write puts the instance in quarantine and returns an UNKNOWN outcome, requiring recovery rather than blind retry.

**Threat model and limitations:** SHA256 links do not authenticate the journal against a privileged attacker who can rewrite the entire file. There is no separately protected durable monotonic root, cross-process exclusive write lock, true atomic external effect, multiprocess shared storage, consensus, quorum, strong power-loss durability guarantee or idempotent real downstream integration. The journal is not coordinated with W2.11's IPC broker and therefore does not make that broker recoverable. An attacker can truncate whole valid records without an independent checkpoint, and two coordinators writing the same file can race. This is a scoped unit-test contract only, not production capability.

No user/share data, actual authority, trading, payments, production route, Docker, SQL, OCI, merge or deployment. Acceptance is exact-HEAD successful GitHub Actions with W2–W2.11 regressions green and all six Docker-related steps skipped.