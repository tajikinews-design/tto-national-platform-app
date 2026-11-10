-- Issue185 scanned owner-private member attachments (never official evidence or signing power).
-- ClamAV CLEAN and cryptographic checks are enforced by the API; DB refuses
-- direct app-role table reads. Missing scanner/config must fail closed.
BEGIN;
CREATE TABLE tto.nav02_member_attachment_drafts(
 attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 draft_id uuid NOT NULL REFERENCES tto.commerce_demo_shareholder_drafts(draft_id),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 160),
 mime text NOT NULL CHECK(mime IN('application/pdf','image/jpeg','image/png')),
 original_filename text NOT NULL CHECK(length(original_filename) BETWEEN 1 AND 180),
 byte_count integer NOT NULL CHECK(byte_count BETWEEN 68 AND 524288),
 sha256 bytea NOT NULL CHECK(octet_length(sha256)=32),
 iv bytea NOT NULL CHECK(octet_length(iv)=12),
 tag bytea NOT NULL CHECK(octet_length(tag)=16),
 encrypted_data bytea NOT NULL,
 scan_verdict text NOT NULL CHECK(scan_verdict='CLEAN'),
 scan_engine text NOT NULL CHECK(length(scan_engine) BETWEEN 6 AND 210),
 state text NOT NULL DEFAULT 'PRIVATE_READY' CHECK(state='PRIVATE_READY'),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(octet_length(encrypted_data)=byte_count)
);
CREATE INDEX nav02_member_attachment_owner_draft ON
 tto.nav02_member_attachment_drafts(order_id,draft_id,created_at);
ALTER TABLE tto.nav02_member_attachment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_member_attachment_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.nav02_member_attachment_drafts FROM PUBLIC,tto_app;
CREATE FUNCTION tto.nav02_attachment_save(
 p_slug text,p_draft uuid,p_subject text,p_mime text,p_name text,
 p_bytes integer,p_sha bytea,p_iv bytea,p_tag bytea,p_cipher bytea,p_engine text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(
  SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
  JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
  WHERE d.order_id=v_order AND d.draft_id=p_draft AND
   d.verification_state='DRAFT_UNVERIFIED')
 THEN RAISE EXCEPTION 'ATTACHMENT_MEMBER_NOT_FOUND' USING ERRCODE='42501';END IF;
 INSERT INTO tto.nav02_member_attachment_drafts(
  order_id,draft_id,subject,mime,original_filename,byte_count,sha256,iv,tag,
  encrypted_data,scan_verdict,scan_engine,created_by)
 VALUES(v_order,p_draft,btrim(p_subject),p_mime,p_name,p_bytes,p_sha,p_iv,p_tag,
  p_cipher,'CLEAN',p_engine,tto.context_actor_id()) RETURNING attachment_id INTO v_id;
 RETURN v_id;
END $f$;
CREATE FUNCTION tto.nav02_attachment_list(p_slug text,p_draft uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts
  WHERE order_id=v_order AND draft_id=p_draft)
 THEN RAISE EXCEPTION 'ATTACHMENT_MEMBER_NOT_FOUND' USING ERRCODE='42501';END IF;
 RETURN(SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',a.attachment_id,'subject',a.subject,'mime',a.mime,
  'filename',a.original_filename,'size',a.byte_count,'createdAt',a.created_at,
  'state',a.state) ORDER BY a.created_at DESC),'[]'::jsonb)
 FROM tto.nav02_member_attachment_drafts a WHERE a.order_id=v_order AND a.draft_id=p_draft);
END $f$;
CREATE FUNCTION tto.nav02_attachment_fetch_owner(p_slug text,p_draft uuid,p_id uuid)
 RETURNS TABLE(mime text,filename text,byte_count integer,sha bytea,
 iv bytea,tag bytea,cipher bytea)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN QUERY SELECT a.mime,a.original_filename,a.byte_count,a.sha256,
  a.iv,a.tag,a.encrypted_data
 FROM tto.nav02_member_attachment_drafts a
 WHERE a.order_id=v_order AND a.draft_id=p_draft AND a.attachment_id=p_id
  AND a.scan_verdict='CLEAN' AND a.state='PRIVATE_READY';
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_attachment_save(text,uuid,text,text,text,integer,bytea,bytea,bytea,bytea,text),
 tto.nav02_attachment_list(text,uuid),tto.nav02_attachment_fetch_owner(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_attachment_save(text,uuid,text,text,text,integer,bytea,bytea,bytea,bytea,text),
 tto.nav02_attachment_list(text,uuid),tto.nav02_attachment_fetch_owner(text,uuid,uuid) TO tto_app;
COMMENT ON TABLE tto.nav02_member_attachment_drafts IS
 'ClamAV-screened and AES-GCM-sealed member attachments for tenant-owner only. No official legal significance.';
COMMIT;
