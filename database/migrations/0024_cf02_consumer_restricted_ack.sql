-- #154 Restricted CF02 consumer database identity and durable delivery control.
-- No login credential, runtime activation, hosted migration or service scheduler.
BEGIN;
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tto_cf02_consumer') THEN
  CREATE ROLE tto_cf02_consumer NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION NOBYPASSRLS;
 END IF;
END $role$;
REVOKE ALL ON SCHEMA tto FROM tto_cf02_consumer;
GRANT USAGE ON SCHEMA tto TO tto_cf02_consumer;
-- Existing projector validates tenant, verified Party, approval, evidence, separation
-- and source monotonic version in a single PostgreSQL transaction.
-- No direct projector EXECUTE for consumer; use bound wrapper.
CREATE TABLE tto.cf02_child06_delivery_state (
 source_event_id uuid PRIMARY KEY REFERENCES tto.cooperative_relationship_outbox(event_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 processed_version bigint NOT NULL CHECK(processed_version>0),
 state text NOT NULL CHECK(state IN ('ACKED','QUARANTINED')),
 reason text,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((state='ACKED' AND reason IS NULL) OR (state='QUARANTINED' AND reason IS NOT NULL))
);
REVOKE ALL ON tto.cf02_child06_delivery_state FROM PUBLIC,tto_app,tto_cf02_consumer;
ALTER TABLE tto.cf02_child06_delivery_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cf02_child06_delivery_state FORCE ROW LEVEL SECURITY;
CREATE TABLE tto.cf02_consumer_login_bindings(
 login_name name NOT NULL,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 valid_until timestamptz NOT NULL,revoked_at timestamptz,
 PRIMARY KEY(login_name,tenant_id),CHECK(actor_id<>approved_by));
REVOKE ALL ON tto.cf02_consumer_login_bindings FROM PUBLIC,tto_app,tto_cf02_consumer;
ALTER TABLE tto.cf02_consumer_login_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cf02_consumer_login_bindings FORCE ROW LEVEL SECURITY;
CREATE FUNCTION tto.cf02_consumer_bound(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(session_user NOT IN ('postgres','tto_app','tto_cf02_consumer')
 AND pg_has_role(session_user,'tto_cf02_consumer','MEMBER')
 AND p_tenant=tto.context_tenant_id()
 AND EXISTS(SELECT 1 FROM tto.cf02_consumer_login_bindings b WHERE b.login_name=session_user
 AND b.tenant_id=p_tenant AND b.actor_id=tto.context_actor_id()
 AND b.valid_until>clock_timestamp() AND b.revoked_at IS NULL
 AND tto.valid_identity_evidence(p_tenant,b.evidence_id)),false) $f$;
REVOKE ALL ON FUNCTION tto.cf02_consumer_bound(uuid) FROM PUBLIC,tto_app;
REVOKE EXECUTE ON FUNCTION tto.cf02_project_child06_relationship_event(uuid,uuid) FROM tto_cf02_consumer;
CREATE FUNCTION tto.cf02_consumer_project(p_tenant uuid,p_event uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
BEGIN
 IF NOT tto.cf02_consumer_bound(p_tenant) THEN RETURN 'DENIED'; END IF;
 RETURN tto.cf02_project_child06_relationship_event(p_tenant,p_event);
END $f$;
REVOKE ALL ON FUNCTION tto.cf02_consumer_project(uuid,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cf02_consumer_project(uuid,uuid) TO tto_cf02_consumer;
-- One source-owned committed event can be ACKED only after its immutable receipt exists.
CREATE FUNCTION tto.cf02_consumer_durable_ack(p_tenant uuid,p_event uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE e tto.cooperative_relationship_outbox%ROWTYPE; s text;
BEGIN
 IF p_tenant IS DISTINCT FROM tto.context_tenant_id()
    OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
 OR NOT tto.cf02_consumer_bound(p_tenant)
 THEN RETURN 'DENIED'; END IF;
 SELECT * INTO e FROM tto.cooperative_relationship_outbox
 WHERE event_id=p_event AND tenant_id=p_tenant;
 IF NOT FOUND THEN RETURN 'UNKNOWN_SOURCE_EVENT'; END IF;
 IF NOT EXISTS (SELECT 1 FROM tto.cf02_relationship_projection_receipts rr
  WHERE rr.source_event_id=p_event AND rr.tenant_id=p_tenant
    AND rr.party_id=e.party_id AND rr.source_version=e.source_version)
 THEN RETURN 'UNCOMMITTED_PROJECTION'; END IF;
 INSERT INTO tto.cf02_child06_delivery_state(source_event_id,tenant_id,processed_version,state)
 VALUES(p_event,p_tenant,e.source_version,'ACKED')
 ON CONFLICT(source_event_id) DO NOTHING;
 SELECT state INTO s FROM tto.cf02_child06_delivery_state
 WHERE source_event_id=p_event AND tenant_id=p_tenant;
 IF s='ACKED' THEN RETURN 'ACKED'; END IF;
 RETURN 'CONFLICT';
END $fn$;
-- Never grant bare ACK; a stale worker must present its fenced lease token.
REVOKE ALL ON FUNCTION tto.cf02_consumer_durable_ack(uuid,uuid) FROM PUBLIC,tto_app,tto_cf02_consumer;
-- Restricted consumer-facing polling/lease functions. Source outbox remains immutable.
ALTER TABLE tto.cf02_child06_delivery_state ADD COLUMN attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0);
ALTER TABLE tto.cf02_child06_delivery_state ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE tto.cf02_child06_delivery_state ADD COLUMN lease_until timestamptz;
-- A fully ACKED entry remains final; only a lease ledger is mutated through guarded functions.
CREATE TABLE tto.cf02_child06_delivery_leases(
 source_event_id uuid PRIMARY KEY REFERENCES tto.cooperative_relationship_outbox(event_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 claimed_until timestamptz NOT NULL,
 claim_token uuid NOT NULL,
 attempts integer NOT NULL DEFAULT 1 CHECK(attempts>0),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON tto.cf02_child06_delivery_leases FROM PUBLIC,tto_app,tto_cf02_consumer;
ALTER TABLE tto.cf02_child06_delivery_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cf02_child06_delivery_leases FORCE ROW LEVEL SECURITY;
CREATE FUNCTION tto.cf02_consumer_claim(p_tenant uuid,p_lease_seconds integer DEFAULT 30)
RETURNS TABLE(event_id uuid,claim_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE e uuid; v uuid:=gen_random_uuid();
BEGIN
 IF p_lease_seconds<1 OR p_lease_seconds>300 OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
 OR NOT tto.cf02_consumer_bound(p_tenant)
 THEN RETURN; END IF;
 SELECT o.event_id INTO e FROM tto.cooperative_relationship_outbox o
 LEFT JOIN tto.cf02_child06_delivery_state d ON d.source_event_id=o.event_id AND d.state IN('ACKED','QUARANTINED')
 LEFT JOIN tto.cf02_child06_delivery_leases l ON l.source_event_id=o.event_id
 WHERE o.tenant_id=p_tenant AND d.source_event_id IS NULL
 AND (l.source_event_id IS NULL OR (l.claimed_until<clock_timestamp() AND l.available_at<=clock_timestamp()))
 ORDER BY o.recorded_at,o.event_id LIMIT 1 FOR UPDATE OF o SKIP LOCKED;
 IF e IS NULL THEN RETURN; END IF;
 INSERT INTO tto.cf02_child06_delivery_leases(source_event_id,tenant_id,claimed_until,claim_token)
 VALUES(e,p_tenant,clock_timestamp()+make_interval(secs=>p_lease_seconds),v)
 ON CONFLICT(source_event_id) DO UPDATE SET
 claimed_until=EXCLUDED.claimed_until,claim_token=EXCLUDED.claim_token,
 attempts=tto.cf02_child06_delivery_leases.attempts+1
 WHERE tto.cf02_child06_delivery_leases.claimed_until<clock_timestamp()
 AND tto.cf02_child06_delivery_leases.available_at<=clock_timestamp();
 IF NOT FOUND THEN RETURN; END IF;
 event_id:=e;claim_token:=v;RETURN NEXT;
END $f$;
-- Must own an unexpired claim to durably ACK after projector has committed.
CREATE FUNCTION tto.cf02_consumer_complete(p_tenant uuid,p_event uuid,p_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE ret text;
BEGIN
 IF p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
 OR NOT tto.cf02_consumer_bound(p_tenant) THEN RETURN 'DENIED'; END IF;
 -- Already-committed immutable delivery is safe to acknowledge on redelivery.
 IF EXISTS(SELECT 1 FROM tto.cf02_child06_delivery_state
 WHERE source_event_id=p_event AND tenant_id=p_tenant AND state='ACKED')
 THEN RETURN 'ACKED'; END IF;
 PERFORM 1 FROM tto.cf02_child06_delivery_leases
 WHERE source_event_id=p_event AND tenant_id=p_tenant AND claim_token=p_token
 AND claimed_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN 'STALE_CLAIM'; END IF;
 ret:=tto.cf02_consumer_durable_ack(p_tenant,p_event);
 IF ret='ACKED' THEN DELETE FROM tto.cf02_child06_delivery_leases WHERE source_event_id=p_event; END IF;
 RETURN ret;
END $f$;
CREATE FUNCTION tto.cf02_consumer_retry(p_tenant uuid,p_event uuid,p_token uuid,p_backoff_seconds integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
BEGIN
 IF p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
 OR NOT tto.cf02_consumer_bound(p_tenant)
 OR p_backoff_seconds<1 OR p_backoff_seconds>3600 THEN RETURN 'DENIED'; END IF;
 UPDATE tto.cf02_child06_delivery_leases
 SET claimed_until=clock_timestamp()-interval '1 second',
 available_at=clock_timestamp()+make_interval(secs=>p_backoff_seconds)
 WHERE source_event_id=p_event AND tenant_id=p_tenant AND claim_token=p_token
 AND claimed_until>clock_timestamp();
 IF FOUND THEN RETURN 'RETRY_SCHEDULED'; END IF;
 RETURN 'STALE_CLAIM';
END $f$;
REVOKE ALL ON FUNCTION tto.cf02_consumer_claim(uuid,integer),
 tto.cf02_consumer_complete(uuid,uuid,uuid),
 tto.cf02_consumer_retry(uuid,uuid,uuid,integer) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cf02_consumer_claim(uuid,integer),
 tto.cf02_consumer_complete(uuid,uuid,uuid),
 tto.cf02_consumer_retry(uuid,uuid,uuid,integer) TO tto_cf02_consumer;
-- A permanent invalid event is fenced and quarantined durably, never re-polled.
CREATE FUNCTION tto.cf02_consumer_quarantine(p_tenant uuid,p_event uuid,p_token uuid,p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE e tto.cooperative_relationship_outbox%ROWTYPE;
BEGIN
 IF p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
 OR NOT tto.cf02_consumer_bound(p_tenant)
 OR p_reason NOT IN ('SOURCE_MISMATCH','UNKNOWN_SOURCE_EVENT','SOURCE_RELATIONSHIP_INVALID',
 'SOURCE_DECISION_INVALID','STALE_OR_CONFLICTING_SOURCE_VERSION','SOURCE_VERSION_GAP',
 'LEGACY_OR_ACTIVE_PROJECTION_CONFLICT')
 THEN RETURN 'DENIED'; END IF;
 PERFORM 1 FROM tto.cf02_child06_delivery_leases
 WHERE source_event_id=p_event AND tenant_id=p_tenant AND claim_token=p_token
 AND claimed_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN 'STALE_CLAIM'; END IF;
 SELECT * INTO e FROM tto.cooperative_relationship_outbox WHERE event_id=p_event AND tenant_id=p_tenant;
 IF NOT FOUND THEN RETURN 'UNKNOWN_SOURCE_EVENT'; END IF;
 INSERT INTO tto.cf02_child06_delivery_state(source_event_id,tenant_id,processed_version,state,reason)
 VALUES(p_event,p_tenant,e.source_version,'QUARANTINED',p_reason)
 ON CONFLICT(source_event_id) DO NOTHING;
 DELETE FROM tto.cf02_child06_delivery_leases WHERE source_event_id=p_event;
 RETURN 'QUARANTINED';
END $f$;
REVOKE ALL ON FUNCTION tto.cf02_consumer_quarantine(uuid,uuid,uuid,text) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cf02_consumer_quarantine(uuid,uuid,uuid,text) TO tto_cf02_consumer;
CREATE FUNCTION tto.cf02_consumer_source(p_tenant uuid,p_event uuid)
RETURNS TABLE(event_id uuid,tenant_id uuid,party_id uuid,relationship_id uuid,source_version bigint,event_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT o.event_id,o.tenant_id,o.party_id,o.relationship_id,o.source_version,o.event_name
 FROM tto.cooperative_relationship_outbox o WHERE o.tenant_id=p_tenant
 AND o.event_id=p_event AND p_tenant=tto.context_tenant_id()
 AND tto.cf02_relationship_projector_authorized(p_tenant)
 AND tto.cf02_consumer_bound(p_tenant)
$f$;
REVOKE ALL ON FUNCTION tto.cf02_consumer_source(uuid,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cf02_consumer_source(uuid,uuid) TO tto_cf02_consumer;
COMMENT ON ROLE tto_cf02_consumer IS 'CF02 Child06 restricted NOLOGIN executor: separate deployment credential mapping required; no automatic dispatcher';
COMMIT;
