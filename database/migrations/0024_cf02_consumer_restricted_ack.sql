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
GRANT EXECUTE ON FUNCTION tto.cf02_project_child06_relationship_event(uuid,uuid) TO tto_cf02_consumer;
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
-- One source-owned committed event can be ACKED only after its immutable receipt exists.
CREATE FUNCTION tto.cf02_consumer_durable_ack(p_tenant uuid,p_event uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE e tto.cooperative_relationship_outbox%ROWTYPE; s text;
BEGIN
 IF p_tenant IS DISTINCT FROM tto.context_tenant_id()
    OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
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
REVOKE ALL ON FUNCTION tto.cf02_consumer_durable_ack(uuid,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cf02_consumer_durable_ack(uuid,uuid) TO tto_cf02_consumer;
COMMENT ON ROLE tto_cf02_consumer IS 'CF02 Child06 restricted NOLOGIN executor: separate deployment credential mapping required; no automatic dispatcher';
COMMIT;
