-- Issue 185: owner-only GOVERNANCE DRAFTS, never statutory appointment or legal signing authority.
-- This is an isolated preview migration. Requires 9999zb and existing NAV02 owner functions.
BEGIN;
CREATE TABLE tto.nav02_office_holder_drafts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 member_draft_id uuid REFERENCES tto.commerce_demo_shareholder_drafts(draft_id),
 external_name text,
 ceo_source text NOT NULL CHECK(ceo_source IN('MEMBER','EXTERNAL')),
 office_code text NOT NULL CHECK(office_code IN(
  'BOARD_CHAIR','BOARD_VICE_CHAIR','CEO','BOARD_MEMBER','BOARD_SECRETARY',
  'AUDITOR_PRIMARY','AUDITOR_ALT1','AUDITOR_ALT2')),
 signing_authorized boolean NOT NULL DEFAULT false,
 signing_scope text NOT NULL DEFAULT '',
 start_date date NOT NULL,
 end_date date NOT NULL,
 gazette_name text NOT NULL DEFAULT '',
 gazette_date date,
 gazette_issue text NOT NULL DEFAULT '',
 notice_number text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'DRAFT_ONLY' CHECK(status='DRAFT_ONLY'),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(end_date>=start_date),
 CHECK(length(signing_scope)<=1000),
 CHECK(length(gazette_name)<=160 AND length(gazette_issue)<=80 AND length(notice_number)<=100),
 CHECK((ceo_source='EXTERNAL' AND office_code='CEO' AND member_draft_id IS NULL
         AND length(btrim(external_name)) BETWEEN 3 AND 180)
    OR (ceo_source='MEMBER' AND member_draft_id IS NOT NULL AND external_name IS NULL))
);
CREATE INDEX nav02_office_draft_order_idx ON tto.nav02_office_holder_drafts(order_id,created_at DESC);
ALTER TABLE tto.nav02_office_holder_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.nav02_office_holder_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.nav02_office_holder_drafts FROM PUBLIC,tto_app;
CREATE FUNCTION tto.nav02_office_holder_drafts_list(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',x.id,'memberDraftId',x.member_draft_id,'externalName',x.external_name,
  'ceoSource',x.ceo_source,'officeCode',x.office_code,
  'signingAuthorized',x.signing_authorized,'signingScope',x.signing_scope,
  'startDate',x.start_date,'endDate',x.end_date,
  'gazetteName',x.gazette_name,'gazetteDate',x.gazette_date,
  'gazetteIssue',x.gazette_issue,'noticeNumber',x.notice_number,
  'status',x.status) ORDER BY x.created_at DESC),'[]'::jsonb)
  FROM tto.nav02_office_holder_drafts x WHERE x.order_id=v_order);
END $f$;
CREATE FUNCTION tto.nav02_office_holder_draft_create(
 p_slug text,p_member uuid,p_external_name text,p_ceo_source text,p_office text,
 p_signing boolean,p_scope text,p_start date,p_end date,
 p_gazette_name text,p_gazette_date date,p_gazette_issue text,p_notice text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF p_member IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
  JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
  WHERE d.draft_id=p_member AND d.order_id=v_order AND d.verification_state='DRAFT_UNVERIFIED')
 THEN RAISE EXCEPTION 'MEMBER_NOT_IN_COOPERATIVE' USING ERRCODE='42501';END IF;
 INSERT INTO tto.nav02_office_holder_drafts(order_id,member_draft_id,external_name,
  ceo_source,office_code,signing_authorized,signing_scope,start_date,end_date,
  gazette_name,gazette_date,gazette_issue,notice_number,created_by)
 VALUES(v_order,p_member,p_external_name,p_ceo_source,p_office,p_signing,p_scope,
  p_start,p_end,p_gazette_name,p_gazette_date,p_gazette_issue,p_notice,tto.context_actor_id())
 RETURNING id INTO v_id;
 RETURN v_id;
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_office_holder_drafts_list(text),
 tto.nav02_office_holder_draft_create(text,uuid,text,text,text,boolean,text,date,date,text,date,text,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_office_holder_drafts_list(text),
 tto.nav02_office_holder_draft_create(text,uuid,text,text,text,boolean,text,date,date,text,date,text,text)
 TO tto_app;
COMMENT ON TABLE tto.nav02_office_holder_drafts IS
 'Unapproved governance data-entry preview; no appointment, legal signature or voting effect.';
COMMIT;
