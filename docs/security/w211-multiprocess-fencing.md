# W2.11 — real OS process fencing lab (not distributed consensus)

Stacked on accepted W2.10 exact SHA `cc6c28c5f31f046828b4604c0e68e51618cf6132`.

This test creates multiple independent child OS processes exchanging IPC messages with a single trusted parent acting as serialized synthetic authority and synthetic effect ledger. The *parent* orders revocation, rotation and synthetic commit, so stale prepared tickets are rejected. Covers partition, delayed IPC, crash and worker replacement, duplicated tickets and distinct PIDs. All positive test effects explicitly have `canGrantPermission:false`.

**Safety boundaries:** Child processes are truly independent but the arbiter/effect log is single-process and volatile. This is NOT distributed consensus, fault-tolerant multi-node linearizability, durable authority, a genuine partitioned network, credential-authenticated IPC, transactionally fenced share transfers, or a production service. Parent crash loses the entire ledger, there is no authenticated membership, quorum, replicated commit, or real PDP attestation. The simulated partition is broker reachability denial, not a real network partition. In a future real system, atomic revocation and external effect must share one linearizable ordering domain or a strictly validated durable fencing token.

Only GitHub synthetic Draft CI. No Docker, PostgreSQL, OCI, real shares, payment, merge or deployment. Acceptance requires exact HEAD CI success and all six Docker/SQL/OCI stages skipped.