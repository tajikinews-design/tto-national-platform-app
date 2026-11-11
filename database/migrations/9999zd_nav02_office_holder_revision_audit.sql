-- Tenant-only office-holder draft edits with optimistic locking and immutable revision audit.
-- This never creates official signing authority. Requires 9999zc.
BEGIN;
ALTER TABLE tto.nav02_office_holder_drafts
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>=1);
CREATE TABLE tto.nav02_office_holder_revision_audit(
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 office_id uuid NOT NULL REFERENCES tto.nav02_office_holder_drafts(id),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 version_before integer NOT NULL,
 version_after integer NOT NULL,
 previous_fields jsonb NOT NULL,
 revised_by uuid NOT NULL,
 revised_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX nav02_office_revision_by_office ON tto.nav02_office_holder_revision_audit(order_id,office_id,audit_id);
ALTER TABLE tto.nav02_office_holder_revision_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_office_holder_revision_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.nav02_office_holder_revision_audit FROM PUBLIC,tto_app;
REVOKE ALL ON SEQUENCE tto.nav02_office_holder_revision_audit_audit_id_seq FROM PUBLIC,tto_app;
CREATE OR REPLACE FUNCTION tto.nav02_office_holder_drafts_list(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
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
  'status',x.status) ORDER BY x.created_at DESC,x.id),'[]'::jsonb)
  FROM tto.nav02_office_holder_drafts x WHERE x.order_id=v_order);
END $f$;
CREATE FUNCTION tto.nav02_office_holder_draft_edit(
 p_slug text,p_id uuid,p_expected integer,p_member uuid,p_external_name text,
 p_ceo_source text,p_office text,p_signing boolean,p_scope text,
 p_start date,p_end date,p_gazette_name text,p_gazette_date date,
 p_gazette_issue text,p_notice text) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_old tto.nav02_office_holder_drafts%ROWTYPE;v_version integer;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF p_expected IS NULL OR p_expected<1 THEN
  RAISE EXCEPTION 'OFFICE_STALE_VERSION' USING ERRCODE='40001';END IF;
 SELECT * INTO v_old FROM tto.nav02_office_holder_drafts
  WHERE order_id=v_order AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OFFICE_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF v_old.version<>p_expected THEN
  RAISE EXCEPTION 'OFFICE_STALE_VERSION' USING ERRCODE='40001';END IF;
 IF p_member IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
  JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
  WHERE d.draft_id=p_member AND d.order_id=v_order AND d.verification_state='DRAFT_UNVERIFIED')
 THEN RAISE EXCEPTION 'MEMBER_NOT_IN_COOPERATIVE' USING ERRCODE='42501';END IF;
 UPDATE tto.nav02_office_holder_drafts SET
  member_draft_id=p_member,external_name=p_external_name,
  ceo_source=p_ceo_source,office_code=p_office,
  signing_authorized=p_signing,signing_scope=p_scope,
  start_date=p_start,end_date=p_end,gazette_name=p_gazette_name,
  gazette_date=p_gazette_date,gazette_issue=p_gazette_issue,
  notice_number=p_notice,version=version+1 WHERE id=p_id AND order_id=v_order
 RETURNING version INTO v_version;
 -- Do not store external identity values in revision log beyond essential previous
 -- draft data. This protected audit is inaccessible to direct app roles.
 INSERT INTO tto.nav02_office_holder_revision_audit(
  office_id,order_id,version_before,version_after,previous_fields,revised_by)
 VALUES(p_id,v_order,p_expected,v_version,jsonb_build_object(
  'memberDraftId',v_old.member_draft_id,'externalName',v_old.external_name,
  'ceoSource',v_old.ceo_source,'officeCode',v_old.office_code,
  'signingAuthorized',v_old.signing_authorized,'signingScope',v_old.signing_scope,
  'startDate',v_old.start_date,'endDate',v_old.end_date,
  'gazetteName',v_old.gazette_name,'gazetteDate',v_old.gazette_date,
  'gazetteIssue',v_old.gazette_issue,'noticeNumber',v_old.notice_number,
  'status',v_old.status),tto.context_actor_id());
 RETURN v_version;
END $f$;
CREATE FUNCTION tto.nav02_office_holder_draft_history(p_slug text,p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(SELECT 1 FROM tto.nav02_office_holder_drafts
  WHERE order_id=v_order AND id=p_id)
 THEN RAISE EXCEPTION 'OFFICE_NOT_FOUND' USING ERRCODE='42501';END IF;
 RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'versionBefore',a.version_before,'versionAfter',a.version_after,
  'previous',a.previous_fields,'revisedAt',a.revised_at) ORDER BY a.audit_id DESC),'[]'::jsonb)
  FROM tto.nav02_office_holder_revision_audit a
  WHERE a.order_id=v_order AND a.office_id=p_id);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_office_holder_drafts_list(text),
 tto.nav02_office_holder_draft_edit(text,uuid,integer,uuid,text,text,text,boolean,text,date,date,text,date,text,text),
 tto.nav02_office_holder_draft_history(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_office_holder_drafts_list(text),
 tto.nav02_office_holder_draft_edit(text,uuid,integer,uuid,text,text,text,boolean,text,date,date,text,date,text,text),
 tto.nav02_office_holder_draft_history(text,uuid) TO tto_app;
COMMENT ON TABLE tto.nav02_office_holder_revision_audit IS
 'Append-only officer draft audit. Not an official statutory appointments register.';
COMMIT;
