-- PH12 synthetic issuer bridge. CI-only SQL, NEVER A PRODUCTION MIGRATION.
-- This schema is installed only in disposable PG17 inside GitHub Actions.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE tto.ph12_mock_lab_trust(
 tenant_id uuid PRIMARY KEY REFERENCES tto.tenants(tenant_id),
 issuer_id text NOT NULL CHECK(issuer_id='PH12_SYNTHETIC_ISSUER_NOT_OFFICIAL'),
 key_id text NOT NULL CHECK(key_id IN('PH12_TEST_ED25519_KEY_01','PH12_TEST_ED25519_KEY_02')),
 trust_epoch bigint NOT NULL CHECK(trust_epoch>0),
 issuer_url text NOT NULL CHECK(issuer_url ~ '^http://127[.]0[.]0[.]1:[0-9]{2,5}$'),
 public_key_pem text NOT NULL CHECK(public_key_pem LIKE '-----BEGIN PUBLIC KEY-----%'),
 modified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Lab-only trust rotation audit. Admin's trust-store changes must be
-- strictly monotonic; a retired key can never be silently reintroduced.
CREATE TABLE tto.ph12_mock_lab_trust_history(
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 trust_epoch bigint NOT NULL CHECK(trust_epoch>0),
 key_id text NOT NULL,
 issuer_url text NOT NULL,
 public_key_fingerprint text NOT NULL CHECK(public_key_fingerprint ~ '^[a-f0-9]{64}
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 entity_id text NOT NULL CHECK(entity_id ~ '^SYNTHETIC_[A-Za-z0-9_]{1,80}$'),
 source_version bigint NOT NULL CHECK(source_version>0),
 record_hash text NOT NULL CHECK(record_hash ~ '^[0-9a-f]{64}$'),
 revoked boolean NOT NULL,
 trust_epoch bigint NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,entity_id)
);
ALTER TABLE tto.ph12_mock_lab_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_trust FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_trust_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_trust_history FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_checkpoints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_mock_lab_trust,tto.ph12_mock_lab_checkpoints,tto.ph12_mock_lab_trust_history FROM PUBLIC,tto_app;

CREATE FUNCTION tto.ph12_mock_lab_lock_trust()
RETURNS TABLE(issuer_id text,key_id text,issuer_url text,public_key_pem text,trust_epoch bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
    OR tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
    OR tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_MOCK_LAB_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 -- This row lock serializes two Nest processes and administrative key rotation.
 RETURN QUERY SELECT t.issuer_id,t.key_id,t.issuer_url,t.public_key_pem,t.trust_epoch
 FROM tto.ph12_mock_lab_trust t WHERE t.tenant_id=tid FOR UPDATE;
END $fn$;

CREATE FUNCTION tto.ph12_mock_lab_accept(
 p_entity text,p_version bigint,p_hash text,p_revoked boolean,p_epoch bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 tr record;prior record;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
    OR tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
    OR tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_MOCK_LAB_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 IF p_entity IS NULL OR p_entity !~ '^SYNTHETIC_[A-Za-z0-9_]{1,80}$' OR
  p_version IS NULL OR p_version<=0 OR
  p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR
  p_revoked IS NULL OR p_epoch IS NULL
 THEN RAISE EXCEPTION 'PH12_MOCK_LAB_INPUT_DENIED' USING ERRCODE='22023';END IF;
 SELECT * INTO tr FROM tto.ph12_mock_lab_trust
 WHERE tenant_id=tid FOR UPDATE;
 IF NOT FOUND OR tr.trust_epoch<>p_epoch
 THEN RETURN 'MOCK_HOLD_TRUST_EPOCH_CHANGED';END IF;
 SELECT * INTO prior FROM tto.ph12_mock_lab_checkpoints
 WHERE tenant_id=tid AND entity_id=p_entity FOR UPDATE;
 IF FOUND AND p_version<prior.source_version THEN RETURN 'MOCK_HOLD_VERSION_ROLLBACK';END IF;
 IF FOUND AND p_version=prior.source_version AND prior.record_hash<>p_hash
 THEN RETURN 'MOCK_HOLD_VERSION_EQUIVOCATION';END IF;
 IF FOUND AND p_epoch<prior.trust_epoch THEN RETURN 'MOCK_HOLD_TRUST_EPOCH_ROLLBACK';END IF;
 INSERT INTO tto.ph12_mock_lab_checkpoints AS c
   (tenant_id,entity_id,source_version,record_hash,revoked,trust_epoch)
 VALUES(tid,p_entity,p_version,p_hash,p_revoked OR coalesce(prior.revoked,false),p_epoch)
 ON CONFLICT(tenant_id,entity_id) DO UPDATE
 SET source_version=EXCLUDED.source_version,record_hash=EXCLUDED.record_hash,
     revoked=EXCLUDED.revoked,trust_epoch=EXCLUDED.trust_epoch,updated_at=clock_timestamp();
 IF p_revoked OR coalesce(prior.revoked,false) THEN RETURN 'MOCK_HOLD_REVOKED';END IF;
 RETURN 'MOCK_ELIGIBLE_IN_LAB_ONLY';
END $fn$;

REVOKE ALL ON FUNCTION tto.ph12_mock_lab_lock_trust(),
 tto.ph12_mock_lab_accept(text,bigint,text,boolean,bigint) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_mock_lab_lock_trust(),
 tto.ph12_mock_lab_accept(text,bigint,text,boolean,bigint) TO tto_app;
COMMIT;
),
 transition text NOT NULL CHECK(transition IN ('BOOTSTRAP','ROTATION')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,trust_epoch),
 UNIQUE(tenant_id,key_id)
);
CREATE FUNCTION tto.ph12_mock_lab_trust_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'PH12_MOCK_TRUST_DELETE_DENIED' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant_id<>OLD.tenant_id OR
     NEW.issuer_id<>OLD.issuer_id OR
     NEW.trust_epoch<>OLD.trust_epoch+1 OR
     NEW.key_id=OLD.key_id OR
     NEW.public_key_pem=OLD.public_key_pem OR
     EXISTS(SELECT 1 FROM tto.ph12_mock_lab_trust_history h
             WHERE h.tenant_id=OLD.tenant_id AND h.key_id=NEW.key_id)
  THEN RAISE EXCEPTION 'PH12_MOCK_TRUST_ROTATION_FENCED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION tto.ph12_mock_lab_record_trust_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 INSERT INTO tto.ph12_mock_lab_trust_history AS h
  (tenant_id,trust_epoch,key_id,issuer_url,public_key_fingerprint,transition)
 VALUES(NEW.tenant_id,NEW.trust_epoch,NEW.key_id,NEW.issuer_url,
        encode(digest(convert_to(NEW.public_key_pem,'UTF8'),'sha256'),'hex'),
        CASE WHEN TG_OP='INSERT' THEN 'BOOTSTRAP' ELSE 'ROTATION' END);
 RETURN NEW;
END $fn$;
CREATE FUNCTION tto.ph12_mock_lab_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN RAISE EXCEPTION 'PH12_MOCK_TRUST_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END $fn$;
CREATE TRIGGER ph12_mock_trust_guard
 BEFORE UPDATE OR DELETE ON tto.ph12_mock_lab_trust
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_mock_lab_trust_guard();
CREATE TRIGGER ph12_mock_trust_log
 AFTER INSERT OR UPDATE ON tto.ph12_mock_lab_trust
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_mock_lab_record_trust_history();
CREATE TRIGGER ph12_mock_trust_log_immutable
 BEFORE UPDATE OR DELETE ON tto.ph12_mock_lab_trust_history
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_mock_lab_immutable();

CREATE TABLE tto.ph12_mock_lab_checkpoints(
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 entity_id text NOT NULL CHECK(entity_id ~ '^SYNTHETIC_[A-Za-z0-9_]{1,80}$'),
 source_version bigint NOT NULL CHECK(source_version>0),
 record_hash text NOT NULL CHECK(record_hash ~ '^[0-9a-f]{64}$'),
 revoked boolean NOT NULL,
 trust_epoch bigint NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,entity_id)
);
ALTER TABLE tto.ph12_mock_lab_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_trust FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_mock_lab_checkpoints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_mock_lab_trust,tto.ph12_mock_lab_checkpoints FROM PUBLIC,tto_app;

CREATE FUNCTION tto.ph12_mock_lab_lock_trust()
RETURNS TABLE(issuer_id text,key_id text,issuer_url text,public_key_pem text,trust_epoch bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
    OR tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
    OR tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_MOCK_LAB_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 -- This row lock serializes two Nest processes and administrative key rotation.
 RETURN QUERY SELECT t.issuer_id,t.key_id,t.issuer_url,t.public_key_pem,t.trust_epoch
 FROM tto.ph12_mock_lab_trust t WHERE t.tenant_id=tid FOR UPDATE;
END $fn$;

CREATE FUNCTION tto.ph12_mock_lab_accept(
 p_entity text,p_version bigint,p_hash text,p_revoked boolean,p_epoch bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 tr record;prior record;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
    OR tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
    OR tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_MOCK_LAB_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 IF p_entity IS NULL OR p_entity !~ '^SYNTHETIC_[A-Za-z0-9_]{1,80}$' OR
  p_version IS NULL OR p_version<=0 OR
  p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR
  p_revoked IS NULL OR p_epoch IS NULL
 THEN RAISE EXCEPTION 'PH12_MOCK_LAB_INPUT_DENIED' USING ERRCODE='22023';END IF;
 SELECT * INTO tr FROM tto.ph12_mock_lab_trust
 WHERE tenant_id=tid FOR UPDATE;
 IF NOT FOUND OR tr.trust_epoch<>p_epoch
 THEN RETURN 'MOCK_HOLD_TRUST_EPOCH_CHANGED';END IF;
 SELECT * INTO prior FROM tto.ph12_mock_lab_checkpoints
 WHERE tenant_id=tid AND entity_id=p_entity FOR UPDATE;
 IF FOUND AND p_version<prior.source_version THEN RETURN 'MOCK_HOLD_VERSION_ROLLBACK';END IF;
 IF FOUND AND p_version=prior.source_version AND prior.record_hash<>p_hash
 THEN RETURN 'MOCK_HOLD_VERSION_EQUIVOCATION';END IF;
 IF FOUND AND p_epoch<prior.trust_epoch THEN RETURN 'MOCK_HOLD_TRUST_EPOCH_ROLLBACK';END IF;
 INSERT INTO tto.ph12_mock_lab_checkpoints AS c
   (tenant_id,entity_id,source_version,record_hash,revoked,trust_epoch)
 VALUES(tid,p_entity,p_version,p_hash,p_revoked OR coalesce(prior.revoked,false),p_epoch)
 ON CONFLICT(tenant_id,entity_id) DO UPDATE
 SET source_version=EXCLUDED.source_version,record_hash=EXCLUDED.record_hash,
     revoked=EXCLUDED.revoked,trust_epoch=EXCLUDED.trust_epoch,updated_at=clock_timestamp();
 IF p_revoked OR coalesce(prior.revoked,false) THEN RETURN 'MOCK_HOLD_REVOKED';END IF;
 RETURN 'MOCK_ELIGIBLE_IN_LAB_ONLY';
END $fn$;

REVOKE ALL ON FUNCTION tto.ph12_mock_lab_lock_trust(),
 tto.ph12_mock_lab_accept(text,bigint,text,boolean,bigint) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_mock_lab_lock_trust(),
 tto.ph12_mock_lab_accept(text,bigint,text,boolean,bigint) TO tto_app;
COMMIT;
