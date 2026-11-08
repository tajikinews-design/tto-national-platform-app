-- PH12 disposable INDEPENDENT PostgreSQL17 witness authority.
-- This file NEVER enters product migrations or hosted DB.
BEGIN;
CREATE SCHEMA ph12_anchor;
CREATE TABLE ph12_anchor.signed_highwater(
 tenant_id uuid NOT NULL,
 entity_id text NOT NULL CHECK(entity_id ~ '^SYNTHETIC_[A-Za-z0-9_]{1,80}$'),
 anchor_seq bigint NOT NULL CHECK(anchor_seq>0),
 trust_epoch bigint NOT NULL CHECK(trust_epoch>0),
 source_version bigint NOT NULL CHECK(source_version>0),
 revoked boolean NOT NULL,
 witness jsonb NOT NULL CHECK(jsonb_typeof(witness)='object'),
 inserted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,entity_id,anchor_seq)
);
CREATE FUNCTION ph12_anchor.verify_append() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,ph12_anchor AS $fn$
DECLARE prior record;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'PH12_ANCHOR_APPEND_ONLY' USING ERRCODE='42501';END IF;
 IF NEW.witness->'record'->>'tenantId'<>NEW.tenant_id::text OR
    NEW.witness->'record'->>'entityId'<>NEW.entity_id OR
    (NEW.witness->'record'->>'trustEpoch')::bigint<>NEW.trust_epoch OR
    (NEW.witness->'record'->>'sourceVersion')::bigint<>NEW.source_version OR
    (NEW.witness->'record'->>'revoked')::boolean<>NEW.revoked THEN
  RAISE EXCEPTION 'PH12_ANCHOR_MALFORMED' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':'||NEW.entity_id,0));
 SELECT a.* INTO prior FROM ph12_anchor.signed_highwater a
 WHERE tenant_id=NEW.tenant_id AND entity_id=NEW.entity_id
 ORDER BY anchor_seq DESC LIMIT 1;
 IF FOUND AND (NEW.anchor_seq<>prior.anchor_seq+1 OR
    NEW.trust_epoch<prior.trust_epoch OR NEW.source_version<prior.source_version OR
    (prior.revoked AND NOT NEW.revoked)) THEN
   RAISE EXCEPTION 'PH12_ANCHOR_ROLLBACK_OR_REVOCATION_REPLAY'
    USING ERRCODE='42501';
 END IF;
 IF NOT FOUND AND NEW.anchor_seq<>1 THEN
  RAISE EXCEPTION 'PH12_ANCHOR_GENESIS_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_anchor_guard BEFORE INSERT OR UPDATE OR DELETE
 ON ph12_anchor.signed_highwater FOR EACH ROW
 EXECUTE FUNCTION ph12_anchor.verify_append();
REVOKE ALL ON SCHEMA ph12_anchor FROM PUBLIC;
REVOKE ALL ON ph12_anchor.signed_highwater FROM PUBLIC;
COMMIT;
