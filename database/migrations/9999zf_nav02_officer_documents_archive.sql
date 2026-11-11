-- NAV02 officer documents and version-fenced draft removal.
-- Isolated owner-only preview. Not legal approval, signatory or membership authority.
BEGIN;
ALTER TABLE tto.nav02_office_holder_drafts
 ADD COLUMN archived_at timestamptz,
 ADD COLUMN archived_by uuid;
CREATE TABLE tto.nav02_officer_document_drafts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 office_id uuid NOT NULL REFERENCES tto.nav02_office_holder_drafts(id),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 160),
 mime text NOT NULL CHECK(mime IN('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png')),
 original_filename text NOT NULL CHECK(length(original_filename) BETWEEN 1 AND 180),
 byte_count integer NOT NULL CHECK(byte_count BETWEEN 68 AND 524288),
 sha256 bytea NOT NULL CHECK(octet_length(sha256)=32),
 iv bytea NOT NULL CHECK(octet_length(iv)=12),
 tag bytea NOT NULL CHECK(octet_length(tag)=16),
 encrypted_data bytea NOT NULL CHECK(octet_length(encrypted_data)=byte_count),
 scan_verdict text NOT NULL CHECK(scan_verdict='CLEAN'),
 scan_engine text NOT NULL CHECK(length(scan_engine) BETWEEN 6 AND 210),
 state text NOT NULL DEFAULT 'PRIVATE_READY' CHECK(state='PRIVATE_READY'),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX nav02_officer_document_owner_idx ON
 tto.nav02_officer_document_drafts(order_id,office_id,created_at);
ALTER TABLE tto.nav02_officer_document_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_officer_document_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.nav02_officer_document_drafts FROM PUBLIC,tto_app;

-- A removed draft is permanently absent from active lists but immutable audit
-- and encrypted document evidence remain held for authorized governance review.
CREATE FUNCTION tto.nav02_officer_archived_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'DIRECT_DRAFT_PURGE_DENIED' USING ERRCODE='42501';
 END IF;
 IF OLD.archived_at IS NOT NULL THEN
  RAISE EXCEPTION 'ARCHIVED_DRAFT_IMMUTABLE' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER nav02_officer_archived_guard
 BEFORE UPDATE OR DELETE ON tto.nav02_office_holder_drafts
 FOR EACH ROW EXECUTE FUNCTION tto.nav02_officer_archived_guard();
REVOKE ALL ON FUNCTION tto.nav02_officer_archived_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION tto.nav02_office_holder_drafts_list(p_slug text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',x.id,'version',x.version,'memberDraftId',x.member_draft_id,'externalName',x.external_name,
  'ceoSource',x.ceo_source,'officeCode',x.office_code,
  'signingAuthorized',x.signing_authorized,'signingScope',x.signing_scope,
  'startDate',x.start_date,'endDate',x.end_date,
  'gazetteName',x.gazette_name,'gazetteDate',x.gazette_date,
  'gazetteIssue',x.gazette_issue,'noticeNumber',x.notice_number,
  'status',x.status,
  'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',f.id,'subject',f.subject,'mime',f.mime,'filename',f.original_filename,
   'size',f.byte_count,'createdAt',f.created_at)
   ORDER BY f.created_at DESC)
   FROM tto.nav02_officer_document_drafts f
   WHERE f.order_id=v_order AND f.office_id=x.id AND f.state='PRIVATE_READY'),'[]'::jsonb)
  ) ORDER BY x.created_at DESC,x.id),'[]'::jsonb)
 FROM tto.nav02_office_holder_drafts x
 WHERE x.order_id=v_order AND x.archived_at IS NULL);
END $f$;

CREATE FUNCTION tto.nav02_officer_document_save(
 p_slug text,p_office uuid,p_subject text,p_mime text,p_name text,
 p_bytes integer,p_sha bytea,p_iv bytea,p_tag bytea,p_cipher bytea,p_engine text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(SELECT 1 FROM tto.nav02_office_holder_drafts
  WHERE id=p_office AND order_id=v_order AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'OFFICE_DOCUMENT_NOT_AUTHORIZED' USING ERRCODE='42501';END IF;
 INSERT INTO tto.nav02_officer_document_drafts(
  order_id,office_id,subject,mime,original_filename,byte_count,sha256,
  iv,tag,encrypted_data,scan_verdict,scan_engine,created_by)
 VALUES(v_order,p_office,btrim(p_subject),p_mime,p_name,p_bytes,p_sha,
  p_iv,p_tag,p_cipher,'CLEAN',p_engine,tto.context_actor_id())
 RETURNING id INTO v_id;
 RETURN v_id;
END $f$;

CREATE FUNCTION tto.nav02_officer_document_fetch_owner(p_slug text,p_office uuid,p_id uuid)
 RETURNS TABLE(mime text,filename text,byte_count integer,sha bytea,
  iv bytea,tag bytea,cipher bytea)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN QUERY SELECT a.mime,a.original_filename,a.byte_count,a.sha256,
  a.iv,a.tag,a.encrypted_data
 FROM tto.nav02_officer_document_drafts a
 JOIN tto.nav02_office_holder_drafts o ON o.id=a.office_id AND o.order_id=v_order
 WHERE a.order_id=v_order AND a.office_id=p_office AND a.id=p_id
  AND a.scan_verdict='CLEAN' AND a.state='PRIVATE_READY';
END $f$;

CREATE FUNCTION tto.nav02_office_holder_draft_archive(
 p_slug text,p_id uuid,p_expected integer,p_ack text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_old tto.nav02_office_holder_drafts%ROWTYPE;
BEGIN
 IF p_ack<>'ARCHIVE_DRAFT_WITH_AUDIT_ACKNOWLEDGED' THEN
  RAISE EXCEPTION 'EXPLICIT_ARCHIVE_CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 SELECT * INTO v_old FROM tto.nav02_office_holder_drafts
  WHERE order_id=v_order AND id=p_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OFFICE_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF p_expected IS NULL OR p_expected<>v_old.version THEN
  RAISE EXCEPTION 'OFFICER_STALE_VERSION' USING ERRCODE='40001';END IF;
 UPDATE tto.nav02_office_holder_drafts
 SET archived_at=clock_timestamp(),archived_by=tto.context_actor_id(),
  version=version+1 WHERE id=p_id AND order_id=v_order;
 INSERT INTO tto.nav02_office_holder_revision_audit(
  office_id,order_id,version_before,version_after,previous_fields,revised_by)
 VALUES(p_id,v_order,v_old.version,v_old.version+1,jsonb_build_object(
  'action','ARCHIVED_DRAFT','officeCode',v_old.office_code,
  'memberDraftId',v_old.member_draft_id,'externalName',v_old.external_name,
  'startDate',v_old.start_date,'endDate',v_old.end_date,
  'signingAuthorized',v_old.signing_authorized,'signingScope',v_old.signing_scope,
  'noticeNumber',v_old.notice_number),tto.context_actor_id());
 RETURN jsonb_build_object('archived',true,'legalPowerGranted',false);
END $f$;

REVOKE ALL ON FUNCTION tto.nav02_office_holder_drafts_list(text),
 tto.nav02_officer_document_save(text,uuid,text,text,text,integer,bytea,bytea,bytea,bytea,text),
 tto.nav02_officer_document_fetch_owner(text,uuid,uuid),
 tto.nav02_office_holder_draft_archive(text,uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_office_holder_drafts_list(text),
 tto.nav02_officer_document_save(text,uuid,text,text,text,integer,bytea,bytea,bytea,bytea,text),
 tto.nav02_officer_document_fetch_owner(text,uuid,uuid),
 tto.nav02_office_holder_draft_archive(text,uuid,integer,text) TO tto_app;
COMMENT ON TABLE tto.nav02_officer_document_drafts IS
 'ClamAV-clean, AES-256-GCM sealed preview officer documents; owner scope and no statutory legal effect.';
COMMENT ON COLUMN tto.nav02_office_holder_drafts.archived_at IS
 'Not hard-delete: hide draft from active UI while retaining immutable review audit and evidence.';
COMMIT;
