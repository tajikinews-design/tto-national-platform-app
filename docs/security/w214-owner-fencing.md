# W2.14 — synthetic exclusive coordinator owner and split-brain fencing

Baseline: W2.13 HEAD `c53885169e1336679209d51f32e7fb731952da42`.

A single in-process registry grants an owner term and rejects competing claims. All simulated journal commits and revocations require exact owner and term. Explicit release or supervised crash permits a new, larger term; stale owner requests fail. A synthetic reachability partition denies all writes. A W2.12 journal records only simulated REVOKE and COMMIT effects; all positives have `canGrantPermission:false`.

**Production release blockers:** The ownership term is volatile and resets when this registry restarts. Ownership is not an independently durable consensus-validated monotonic token. There is no real lease, process failure detector, OS lock, authenticated members, cross-process atomic lock, replicated quorum, monotonic witness, independent storage enforcement, or genuine split-brain safety with two independent coordinator servers. This is a single-owner simulation, not proof that two real writers cannot race. Supervisory crash transfer is explicit; outages cannot automatically transfer ownership. No real shares or financial effects.

GitHub-only Draft testing. No Docker, PostgreSQL, OCI, Merge or Deploy. Require exact-HEAD CI pass and 6 individually skipped Docker/SQL/OCI steps.