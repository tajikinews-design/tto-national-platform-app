-- NAV02-02: versioned member reference replacement; audit-safe collection and termination requests.
-- This migration is for the isolated Preview branch. Never erase an issued identifier.
BEGIN;
ALTER TABLE tto.nav02_member_collections
 ADD COLUMN IF NOT EXISTS archived_at timestamptz,
 ADD COLUMN IF NOT EXISTS archived_by uuid;
CREATE TABLE IF NOT EXISTS tto.nav02_member_number_revisions(
 revision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 changed_by uuid NOT NULL, expected_count integer NOT NULL CHECK(expected_count>0),
 starting_serial bigint NOT NULL CHECK(starting_serial>0),
 prefix text NOT NULL, suffix text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS tto.nav02_member_number_current(
 draft_id uuid PRIMARY KEY REFERENCES tto.commerce_demo_shareholder_drafts(draft_id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 revision_id uuid NOT NULL REFERENCES tto.nav02_member_number_revisions(revision_id),
 serial bigint NOT NULL CHECK(serial>0),
 member_number text NOT NULL UNIQUE CHECK(length(member_number)<=100),
 assigned_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS tto.nav02_member_number_history(
 history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 draft_id uuid NOT NULL, order_id uuid NOT NULL,
 revision_id uuid NOT NULL REFERENCES tto.nav02_member_number_revisions(revision_id),
 member_number text NOT NULL UNIQUE,
 superseded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS tto.nav02_member_end_requests(
 request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 draft_id uuid NOT NULL REFERENCES tto.commerce_demo_shareholder_drafts(draft_id),
 submitted_by uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN('RESIGNATION','DEATH','LEGAL_EXPULSION','FULL_SHARE_TRANSFER')),
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 5 AND 160),
 proposed_date date,
 state text NOT NULL DEFAULT 'PENDING_LEGAL_REVIEW' CHECK(state='PENDING_LEGAL_REVIEW'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS nav02_end_one_pending
 ON tto.nav02_member_end_requests(order_id,draft_id) WHERE state='PENDING_LEGAL_REVIEW';
ALTER TABLE tto.nav02_member_number_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_number_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_number_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_number_current FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_number_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_number_history FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_end_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_end_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.nav02_member_number_revisions,tto.nav02_member_number_current,
 tto.nav02_member_number_history,tto.nav02_member_end_requests FROM PUBLIC,anon,authenticated,tto_app;
REVOKE ALL ON SEQUENCE tto.nav02_member_number_history_history_id_seq FROM PUBLIC,anon,authenticated,tto_app;

CREATE OR REPLACE FUNCTION tto.nav02_member_collections_list(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',collection_id,'name',name)
  ORDER BY created_at),'[]'::jsonb) FROM tto.nav02_member_collections
  WHERE order_id=v_order AND archived_at IS NULL);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_collections_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_collections_list(text) TO tto_app;

CREATE OR REPLACE FUNCTION tto.nav02_member_collection_create(p_slug text,p_name text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;v_name text;
BEGIN
 v_name:=btrim(p_name);
 IF v_name IS NULL OR length(v_name) NOT BETWEEN 3 AND 100
 THEN RAISE EXCEPTION 'INVALID_COLLECTION_NAME' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 UPDATE tto.nav02_member_collections SET archived_at=NULL,archived_by=NULL
 WHERE order_id=v_order AND lower(btrim(name))=lower(v_name) AND archived_at IS NOT NULL
 RETURNING collection_id INTO v_id;
 IF v_id IS NULL THEN
  INSERT INTO tto.nav02_member_collections(order_id,name,created_by)
   VALUES(v_order,v_name,tto.context_actor_id())
   ON CONFLICT DO NOTHING RETURNING collection_id INTO v_id;
 END IF;
 IF v_id IS NULL THEN
  SELECT collection_id INTO v_id FROM tto.nav02_member_collections
  WHERE order_id=v_order AND lower(btrim(name))=lower(v_name);
 END IF;
 IF v_id IS NULL THEN RAISE EXCEPTION 'COLLECTION_NOT_CREATED';END IF;
 RETURN jsonb_build_object('id',v_id,'name',v_name);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_collection_create(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_collection_create(text,text) TO tto_app;

CREATE FUNCTION tto.nav02_member_collection_archive(p_slug text,p_name text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 UPDATE tto.nav02_member_collections SET archived_at=clock_timestamp(),
  archived_by=tto.context_actor_id() WHERE order_id=v_order AND lower(btrim(name))=lower(btrim(p_name))
  AND archived_at IS NULL RETURNING collection_id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'COLLECTION_NOT_FOUND' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('archived',true,'id',v_id);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_collection_archive(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_collection_archive(text,text) TO tto_app;

-- Prevent accidental "future only" edits on an already numbered set.
CREATE OR REPLACE FUNCTION tto.nav02_member_number_policy_set(
 p_slug text,p_start bigint,p_prefix text,p_suffix text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_next bigint;
BEGIN
 IF p_start IS NULL OR p_start<1 OR p_start>999999999999 OR
  p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9-]{0,12}$' OR
  p_suffix IS NULL OR p_suffix !~ '^[A-Z0-9-]{0,12}$'
 THEN RAISE EXCEPTION 'INVALID_NUMBER_POLICY' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 INSERT INTO tto.nav02_member_number_policy(order_id) VALUES(v_order) ON CONFLICT DO NOTHING;
 SELECT next_serial INTO v_next FROM tto.nav02_member_number_policy
 WHERE order_id=v_order FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tto.nav02_member_number_registry WHERE order_id=v_order AND retired_at IS NULL)
 THEN RAISE EXCEPTION 'REISSUE_CONFIRMATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF p_start<v_next THEN RAISE EXCEPTION 'MONOTONIC_MEMBER_SEQUENCE_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE tto.nav02_member_number_policy SET next_serial=p_start,prefix=p_prefix,
  suffix=p_suffix,updated_at=clock_timestamp() WHERE order_id=v_order;
 RETURN jsonb_build_object('nextSerial',p_start::text,'prefix',p_prefix,'suffix',p_suffix,'issuedCount',0);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_number_policy_set(text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_policy_set(text,bigint,text,text) TO tto_app;

CREATE OR REPLACE FUNCTION tto.nav02_member_number_policy_get(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_result jsonb;v_count integer;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 SELECT count(*) INTO v_count FROM tto.nav02_member_number_registry WHERE order_id=v_order AND retired_at IS NULL;
 SELECT jsonb_build_object('nextSerial',next_serial::text,'prefix',prefix,'suffix',suffix,
  'issuedCount',v_count) INTO v_result FROM tto.nav02_member_number_policy WHERE order_id=v_order;
 RETURN COALESCE(v_result,jsonb_build_object('nextSerial','1','prefix','','suffix','','issuedCount',v_count));
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_number_policy_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_policy_get(text) TO tto_app;

CREATE OR REPLACE FUNCTION tto.nav02_member_numbers_for_owner(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN(SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'draftId',n.draft_id,'membershipNumber',COALESCE(c.member_number,n.member_number),
  'retired',n.retired_at IS NOT NULL)),'[]'::jsonb)
 FROM tto.nav02_member_number_registry n
 LEFT JOIN tto.nav02_member_number_current c ON c.draft_id=n.draft_id
 WHERE n.order_id=v_order);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_numbers_for_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_numbers_for_owner(text) TO tto_app;

CREATE FUNCTION tto.nav02_member_number_reissue(
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
  v_number:=p_slug||'-'||p_prefix||lpad(v_serial::text,6,'0')||p_suffix;
  IF EXISTS(SELECT 1 FROM tto.nav02_member_number_registry WHERE member_number=v_number)
   OR EXISTS(SELECT 1 FROM tto.nav02_member_number_current WHERE member_number=v_number)
   OR EXISTS(SELECT 1 FROM tto.nav02_member_number_history WHERE member_number=v_number)
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
REVOKE ALL ON FUNCTION tto.nav02_member_number_reissue(text,bigint,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_number_reissue(text,bigint,text,text,integer,text) TO tto_app;

CREATE FUNCTION tto.nav02_member_end_request_submit(p_slug text,p_draft uuid,
 p_reason text,p_reference text,p_date date) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;
BEGIN
 IF p_reason NOT IN('RESIGNATION','DEATH','LEGAL_EXPULSION','FULL_SHARE_TRANSFER') OR
    p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 5 AND 160
 THEN RAISE EXCEPTION 'INVALID_END_REQUEST' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
  JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
  WHERE d.draft_id=p_draft AND d.order_id=v_order)
 THEN RAISE EXCEPTION 'MEMBER_CASE_NOT_FOUND' USING ERRCODE='42501';END IF;
 INSERT INTO tto.nav02_member_end_requests(order_id,draft_id,submitted_by,reason,evidence_reference,proposed_date)
 VALUES(v_order,p_draft,tto.context_actor_id(),p_reason,btrim(p_reference),p_date)
 RETURNING request_id INTO v_id;
 RETURN jsonb_build_object('requestId',v_id,'state','PENDING_LEGAL_REVIEW');
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_end_request_submit(text,uuid,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_end_request_submit(text,uuid,text,text,date) TO tto_app;
-- Photo release is scanner-evidence-only. This migration does not approve or scan existing photos.
ALTER TABLE tto.commerce_demo_nav02_photo_quarantine
 DROP CONSTRAINT commerce_demo_nav02_photo_quarantine_scan_status_check,
 DROP CONSTRAINT commerce_demo_nav02_photo_quarantine_disclosure_status_check;
ALTER TABLE tto.commerce_demo_nav02_photo_quarantine
 ADD CONSTRAINT nav02_photo_scan_status CHECK(scan_status IN('QUARANTINED','CLEAN','MALWARE')),
 ADD CONSTRAINT nav02_photo_private_disclosure CHECK(
  disclosure_status IN('BLOCKED','OWNER_ALLOWED') AND
  (disclosure_status='BLOCKED' OR scan_status='CLEAN'));
CREATE FUNCTION tto.nav02_photo_ready_for_owner(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN(SELECT COALESCE(jsonb_agg(p.draft_id),'[]'::jsonb)
  FROM tto.commerce_demo_nav02_photo_quarantine p
  WHERE p.order_id=v_order AND p.scan_status='CLEAN'
   AND p.disclosure_status='OWNER_ALLOWED' AND p.expires_at>clock_timestamp());
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_photo_ready_for_owner(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tto.nav02_photo_ready_for_owner(text) TO tto_app;

CREATE FUNCTION tto.nav02_photo_payload_for_owner(p_slug text,p_draft uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN(SELECT jsonb_build_object('mime',p.declared_mime,'iv',encode(p.aes_gcm_iv,'base64'),
  'tag',encode(p.aes_gcm_tag,'base64'),'cipher',encode(p.encrypted_bytes,'base64'),
  'sha',encode(p.content_sha256,'hex'),'size',p.plaintext_bytes)
 FROM tto.commerce_demo_nav02_photo_quarantine p
 WHERE p.order_id=v_order AND p.draft_id=p_draft AND
  p.scan_status='CLEAN' AND p.disclosure_status='OWNER_ALLOWED'
  AND p.expires_at>clock_timestamp());
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_photo_payload_for_owner(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tto.nav02_photo_payload_for_owner(text,uuid) TO tto_app;
COMMIT;
