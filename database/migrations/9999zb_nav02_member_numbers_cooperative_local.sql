-- Issue #185: member number is solely the cooperative's chosen local identifier.
-- Two independent cooperatives may issue identical prefix, serial and suffix.
-- Existing issued values are left unchanged; no global renumber/mass rewrite.
-- Apply after 9999za on an approved isolated schema with scoped regression tests.
BEGIN;
ALTER TABLE tto.nav02_member_number_registry
 DROP CONSTRAINT IF EXISTS nav02_member_number_registry_member_number_key;
ALTER TABLE tto.nav02_member_number_current
 DROP CONSTRAINT IF EXISTS nav02_member_number_current_member_number_key;
ALTER TABLE tto.nav02_member_number_history
 DROP CONSTRAINT IF EXISTS nav02_member_number_history_member_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS nav02_number_registry_per_coop_unique
 ON tto.nav02_member_number_registry(order_id,member_number);
CREATE UNIQUE INDEX IF NOT EXISTS nav02_number_current_per_coop_unique
 ON tto.nav02_member_number_current(order_id,member_number);
CREATE UNIQUE INDEX IF NOT EXISTS nav02_number_history_per_coop_unique
 ON tto.nav02_member_number_history(order_id,member_number);
CREATE OR REPLACE FUNCTION tto.nav02_member_number_issue(p_slug text,p_draft uuid) RETURNS text
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
 -- Cooperative-scoped number: never prepend workspace slug.
 v_number:=v_prefix||lpad(v_serial::text,6,'0')||v_suffix;
 INSERT INTO tto.nav02_member_number_registry(order_id,draft_id,serial,member_number)
 VALUES(v_order,p_draft,v_serial,v_number);
 UPDATE tto.nav02_member_number_policy SET next_serial=v_serial+1,
  updated_at=clock_timestamp() WHERE order_id=v_order;
 RETURN v_number;
END $f$;
CREATE OR REPLACE FUNCTION tto.nav02_member_number_reissue(
 p_slug text,p_start bigint,p_prefix text,p_suffix text,p_expected integer,p_ack text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_current bigint;v_count integer;v_revision uuid;v_row record;
 v_serial bigint;v_number text;
BEGIN
 IF p_ack<>'REISSUE_ALL_MEMBERS_ACKNOWLEDGED' OR p_expected IS NULL OR p_expected<1 OR
    p_start IS NULL OR p_start<1 OR p_start>999999999000 OR
    p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9-]{0,12}$' OR
    p_suffix IS NULL OR p_suffix !~ '^[A-Z0-9-]{0,12}$'
 THEN RAISE EXCEPTION 'EXPLICIT_REISSUE_CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 INSERT INTO tto.nav02_member_number_policy(order_id) VALUES(v_order) ON CONFLICT DO NOTHING;
 SELECT next_serial INTO v_current FROM tto.nav02_member_number_policy WHERE order_id=v_order FOR UPDATE;
 SELECT count(*) INTO v_count FROM tto.nav02_member_number_registry
  WHERE order_id=v_order AND retired_at IS NULL;
 IF v_count=0 OR v_count<>p_expected THEN
  RAISE EXCEPTION 'REISSUE_SET_CHANGED' USING ERRCODE='40001';END IF;
 IF p_start<v_current OR p_start+v_count>999999999999 THEN
  RAISE EXCEPTION 'MONOTONIC_REISSUE_START_REQUIRED' USING ERRCODE='22023';END IF;
 v_revision:=gen_random_uuid();
 INSERT INTO tto.nav02_member_number_revisions(revision_id,order_id,changed_by,expected_count,
  starting_serial,prefix,suffix) VALUES(v_revision,v_order,tto.context_actor_id(),v_count,p_start,p_prefix,p_suffix);
 v_serial:=p_start;
 FOR v_row IN SELECT draft_id FROM tto.nav02_member_number_registry
  WHERE order_id=v_order AND retired_at IS NULL ORDER BY issued_at,registry_id FOR UPDATE LOOP
  v_number:=p_prefix||lpad(v_serial::text,6,'0')||p_suffix;
  IF EXISTS(SELECT 1 FROM tto.nav02_member_number_registry WHERE order_id=v_order AND member_number=v_number)
   OR EXISTS(SELECT 1 FROM tto.nav02_member_number_current WHERE order_id=v_order AND member_number=v_number)
   OR EXISTS(SELECT 1 FROM tto.nav02_member_number_history WHERE order_id=v_order AND member_number=v_number)
  THEN RAISE EXCEPTION 'REISSUE_NUMBER_ALREADY_USED' USING ERRCODE='23505';END IF;
  INSERT INTO tto.nav02_member_number_history(order_id,draft_id,revision_id,member_number)
   SELECT order_id,draft_id,revision_id,member_number
    FROM tto.nav02_member_number_current WHERE draft_id=v_row.draft_id;
  INSERT INTO tto.nav02_member_number_current(draft_id,order_id,revision_id,serial,member_number)
   VALUES(v_row.draft_id,v_order,v_revision,v_serial,v_number)
   ON CONFLICT(draft_id) DO UPDATE SET revision_id=EXCLUDED.revision_id,serial=EXCLUDED.serial,
    member_number=EXCLUDED.member_number,assigned_at=clock_timestamp();
  v_serial:=v_serial+1;
 END LOOP;
 UPDATE tto.nav02_member_number_policy SET next_serial=v_serial,prefix=p_prefix,
  suffix=p_suffix,updated_at=clock_timestamp() WHERE order_id=v_order;
 RETURN jsonb_build_object('reissued',true,'count',v_count,'revisionId',v_revision,
  'nextSerial',v_serial::text);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_number_issue(text,uuid),
 tto.nav02_member_number_reissue(text,bigint,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_issue(text,uuid),
 tto.nav02_member_number_reissue(text,bigint,text,text,integer,text) TO tto_app;
COMMENT ON INDEX tto.nav02_number_registry_per_coop_unique IS
 'Same membership number across cooperatives is explicitly allowed; no global uniqueness.';
COMMIT;
