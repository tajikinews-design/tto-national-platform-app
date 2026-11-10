-- NAV02 W1: PREVIEW-ONLY collections and immutable member-number reservation.
-- Non-production schema proposal; DO NOT APPLY without a dedicated PostgreSQL17
-- migration audit, owner approval, backup and review of existing preview data.
-- The identifier is a permanent administrative reference, NOT legal admission.
BEGIN;

CREATE TABLE tto.nav02_member_number_policy(
 order_id uuid PRIMARY KEY REFERENCES tto.commerce_demo_workspace_owners(order_id),
 next_serial bigint NOT NULL DEFAULT 1 CHECK(next_serial BETWEEN 1 AND 999999999999),
 prefix text NOT NULL DEFAULT '' CHECK(prefix ~ '^[A-Z0-9-]{0,12}$'),
 suffix text NOT NULL DEFAULT '' CHECK(suffix ~ '^[A-Z0-9-]{0,12}$'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE tto.nav02_member_number_registry(
 registry_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 draft_id uuid NOT NULL UNIQUE,
 serial bigint NOT NULL CHECK(serial>0),
 member_number text NOT NULL UNIQUE CHECK(length(member_number)<=100),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 retired_at timestamptz,
 UNIQUE(order_id,serial),
 CHECK(retired_at IS NULL OR retired_at>=issued_at)
);
COMMENT ON TABLE tto.nav02_member_number_registry IS
 'Administrative reference/tombstone. Neither member admission nor shareholder rights. Never delete rows or reuse issued numbers.';
CREATE TABLE tto.nav02_member_collections(
 collection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 100),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX nav02_member_collection_unique
 ON tto.nav02_member_collections(order_id,lower(btrim(name)));
CREATE INDEX nav02_member_registry_owner ON tto.nav02_member_number_registry(order_id,draft_id);
DO $permissions$ BEGIN
 EXECUTE 'ALTER TABLE tto.nav02_member_number_policy ENABLE ROW LEVEL SECURITY';
 EXECUTE 'ALTER TABLE tto.nav02_member_number_policy FORCE ROW LEVEL SECURITY';
 EXECUTE 'ALTER TABLE tto.nav02_member_number_registry ENABLE ROW LEVEL SECURITY';
 EXECUTE 'ALTER TABLE tto.nav02_member_number_registry FORCE ROW LEVEL SECURITY';
 EXECUTE 'ALTER TABLE tto.nav02_member_collections ENABLE ROW LEVEL SECURITY';
 EXECUTE 'ALTER TABLE tto.nav02_member_collections FORCE ROW LEVEL SECURITY';
END $permissions$;
REVOKE ALL ON tto.nav02_member_number_policy,tto.nav02_member_number_registry,
 tto.nav02_member_collections FROM PUBLIC,tto_app;
REVOKE ALL ON SEQUENCE tto.nav02_member_number_registry_registry_id_seq FROM PUBLIC,tto_app;

CREATE FUNCTION tto.nav02_member_owner_order(p_slug text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
 THEN RAISE EXCEPTION 'INVALID_WORKSPACE' USING ERRCODE='22023'; END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE o.slug=p_slug AND w.user_id=tto.context_actor_id()
 AND w.state='ACTIVE' AND o.expires_at>clock_timestamp()
 FOR UPDATE OF w;
 IF v_order IS NULL THEN
  RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN v_order;
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_owner_order(text) FROM PUBLIC,tto_app;

CREATE FUNCTION tto.nav02_member_number_policy_get(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_result jsonb;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 SELECT jsonb_build_object('nextSerial',next_serial::text,
  'prefix',prefix,'suffix',suffix)
 INTO v_result FROM tto.nav02_member_number_policy WHERE order_id=v_order;
 RETURN COALESCE(v_result,'{"nextSerial":"1","prefix":"","suffix":""}'::jsonb);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_number_policy_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_policy_get(text) TO tto_app;

CREATE FUNCTION tto.nav02_member_number_policy_set(
 p_slug text,p_start bigint,p_prefix text,p_suffix text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_next bigint;
BEGIN
 IF p_start IS NULL OR p_start<1 OR p_start>999999999999
 OR p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9-]{0,12}$'
 OR p_suffix IS NULL OR p_suffix !~ '^[A-Z0-9-]{0,12}$'
 THEN RAISE EXCEPTION 'INVALID_NUMBER_POLICY' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 INSERT INTO tto.nav02_member_number_policy(order_id)
 VALUES(v_order) ON CONFLICT DO NOTHING;
 SELECT next_serial INTO v_next FROM tto.nav02_member_number_policy
 WHERE order_id=v_order FOR UPDATE;
 IF p_start<v_next THEN
  RAISE EXCEPTION 'MONOTONIC_MEMBER_SEQUENCE_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE tto.nav02_member_number_policy
 SET next_serial=p_start,prefix=p_prefix,suffix=p_suffix,updated_at=clock_timestamp()
 WHERE order_id=v_order;
 RETURN jsonb_build_object('nextSerial',p_start::text,'prefix',p_prefix,'suffix',p_suffix);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_number_policy_set(text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_policy_set(text,bigint,text,text) TO tto_app;

CREATE FUNCTION tto.nav02_member_number_issue(p_slug text,p_draft uuid) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_serial bigint;v_prefix text;v_suffix text;v_number text;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(
  SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
  JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
  WHERE d.draft_id=p_draft AND d.order_id=v_order
   AND d.verification_state='DRAFT_UNVERIFIED'
 ) THEN RAISE EXCEPTION 'NO_AUTHORIZED_MEMBER_DRAFT' USING ERRCODE='42501';END IF;
 SELECT member_number INTO v_number FROM tto.nav02_member_number_registry
 WHERE order_id=v_order AND draft_id=p_draft FOR UPDATE;
 IF v_number IS NOT NULL THEN RETURN v_number;END IF;
 INSERT INTO tto.nav02_member_number_policy(order_id) VALUES(v_order) ON CONFLICT DO NOTHING;
 SELECT next_serial,prefix,suffix INTO v_serial,v_prefix,v_suffix
 FROM tto.nav02_member_number_policy WHERE order_id=v_order FOR UPDATE;
 IF v_serial>=999999999999 THEN RAISE EXCEPTION 'NUMBER_RANGE_EXHAUSTED';END IF;
 -- Workspace slug is a permanent namespace at issuance, even if an alias
 -- changes later. The persisted formatted number itself is immutable.
 v_number:=p_slug||'-'||v_prefix||lpad(v_serial::text,6,'0')||v_suffix;
 INSERT INTO tto.nav02_member_number_registry(order_id,draft_id,serial,member_number)
 VALUES(v_order,p_draft,v_serial,v_number);
 UPDATE tto.nav02_member_number_policy SET next_serial=v_serial+1,
  updated_at=clock_timestamp() WHERE order_id=v_order;
 RETURN v_number;
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_number_issue(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_issue(text,uuid) TO tto_app;

CREATE FUNCTION tto.nav02_member_numbers_for_owner(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN(SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'draftId',n.draft_id,'membershipNumber',n.member_number,
  'retired',n.retired_at IS NOT NULL)), '[]'::jsonb)
 FROM tto.nav02_member_number_registry n WHERE n.order_id=v_order);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_numbers_for_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_numbers_for_owner(text) TO tto_app;

CREATE FUNCTION tto.nav02_member_number_retire() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
BEGIN
 UPDATE tto.nav02_member_number_registry SET retired_at=clock_timestamp()
 WHERE draft_id=OLD.draft_id AND retired_at IS NULL;
 RETURN OLD;
END $f$;
CREATE TRIGGER nav02_member_number_tombstone BEFORE DELETE
 ON tto.commerce_demo_shareholder_drafts FOR EACH ROW
 EXECUTE FUNCTION tto.nav02_member_number_retire();
REVOKE ALL ON FUNCTION tto.nav02_member_number_retire() FROM PUBLIC,tto_app;

CREATE FUNCTION tto.nav02_member_collections_list(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',collection_id,
  'name',name) ORDER BY created_at),'[]'::jsonb)
  FROM tto.nav02_member_collections WHERE order_id=v_order);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_collections_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_collections_list(text) TO tto_app;

CREATE FUNCTION tto.nav02_member_collection_create(p_slug text,p_name text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;v_name text;
BEGIN
 v_name:=btrim(p_name);
 IF v_name IS NULL OR length(v_name) NOT BETWEEN 3 AND 100
 THEN RAISE EXCEPTION 'INVALID_COLLECTION_NAME' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 INSERT INTO tto.nav02_member_collections(order_id,name,created_by)
 VALUES(v_order,v_name,tto.context_actor_id())
 ON CONFLICT DO NOTHING RETURNING collection_id INTO v_id;
 IF v_id IS NULL THEN
  SELECT collection_id INTO v_id FROM tto.nav02_member_collections
  WHERE order_id=v_order AND lower(btrim(name))=lower(v_name);
 END IF;
 IF v_id IS NULL THEN RAISE EXCEPTION 'COLLECTION_NOT_CREATED';END IF;
 RETURN jsonb_build_object('id',v_id,'name',v_name);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_collection_create(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_collection_create(text,text) TO tto_app;
COMMIT;
