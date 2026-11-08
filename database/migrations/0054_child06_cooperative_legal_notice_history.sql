-- CHILD-06 + PH12: complete cooperative legal notice archive and longitudinal board/signing records.
-- Only archival claims (may be based on publicly supplied notices); never grants legal roles or tariff approval.
-- PII such as individual national identification numbers MUST NOT be copied into this archive.
BEGIN;
CREATE TABLE tto.cooperative_legal_notice_archive (
 notice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 cooperative_legal_national_id text NOT NULL CHECK(cooperative_legal_national_id ~ '^[0-9]{11}$'),
 cooperative_registration_no text NOT NULL CHECK(cooperative_registration_no ~ '^[0-9]{1,12}$'),
 source_type text NOT NULL CHECK(source_type IN('COMPANY_REGISTRY','OFFICIAL_GAZETTE')),
 notice_kind text NOT NULL CHECK(notice_kind IN
  ('ESTABLISHMENT','BOARD_CHANGE','CEO_CHANGE','SIGNATORY_CHANGE','BYLAWS_CHANGE',
   'CAPITAL_CHANGE','ADDRESS_CHANGE','GENERAL_ASSEMBLY','DISSOLUTION','OTHER')),
 source_notice_number text CHECK(source_notice_number IS NULL OR length(source_notice_number) BETWEEN 3 AND 100),
 gazette_issue_number text CHECK(gazette_issue_number IS NULL OR length(gazette_issue_number) BETWEEN 1 AND 40),
 published_on_jalali text CHECK(published_on_jalali IS NULL OR published_on_jalali ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
 resolution_on_jalali text NOT NULL CHECK(resolution_on_jalali ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
 cooperative_authority_letter text,
 cooperative_authority_letter_on_jalali text CHECK(cooperative_authority_letter_on_jalali IS NULL OR cooperative_authority_letter_on_jalali ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
 public_summary text NOT NULL CHECK(length(public_summary) BETWEEN 30 AND 6000
    AND public_summary !~ '(^|[^0-9])[0-9]{10}([^0-9]|$)'),
 original_url text CHECK(original_url IS NULL OR (original_url LIKE 'https://%' AND length(original_url)<=500)),
 text_sha256 bytea NOT NULL CHECK(octet_length(text_sha256)=32),
 provenance_status text NOT NULL DEFAULT 'USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'
   CHECK(provenance_status='USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'),
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,submitted_by,request_key)
);
CREATE UNIQUE INDEX cooperative_legal_notices_issuer_no_unique
 ON tto.cooperative_legal_notice_archive(tenant_id,source_type,source_notice_number)
 WHERE source_notice_number IS NOT NULL;

CREATE TABLE tto.cooperative_board_office_history (
 record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 notice_id uuid NOT NULL REFERENCES tto.cooperative_legal_notice_archive(notice_id),
 person_name text NOT NULL CHECK(length(person_name) BETWEEN 3 AND 160 AND person_name !~ '[0-9]{10}'),
 office text NOT NULL CHECK(office IN
  ('BOARD_CHAIR','BOARD_VICE_CHAIR','BOARD_SECRETARY','BOARD_MEMBER','CEO','INSPECTOR','OTHER')),
 event_type text NOT NULL CHECK(event_type IN('APPOINTED','RESIGNED','REAPPOINTED','REMOVED','REPORTED')),
 event_on_jalali text NOT NULL CHECK(event_on_jalali ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[0-9]|[12][0-9]|3[01])$'),
 term_end_jalali text CHECK(term_end_jalali IS NULL OR term_end_jalali ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[0-9]|[12][0-9]|3[01])$'),
 previous_term_start_known boolean NOT NULL DEFAULT false,
 CHECK(term_end_jalali IS NULL OR term_end_jalali >= event_on_jalali OR event_type IN ('RESIGNED','REMOVED')),
 UNIQUE(notice_id,person_name,office,event_type)
);
CREATE INDEX board_history_tenant_timeline ON tto.cooperative_board_office_history
 (tenant_id,event_on_jalali DESC,notice_id);

CREATE TABLE tto.cooperative_signing_authority_history (
 rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 notice_id uuid NOT NULL REFERENCES tto.cooperative_legal_notice_archive(notice_id),
 authority_kind text NOT NULL CHECK(authority_kind IN('BINDING_FINANCIAL','ORDINARY_LETTERS')),
 required_signer text NOT NULL CHECK(length(required_signer) BETWEEN 3 AND 160),
 alternate_signers jsonb NOT NULL CHECK(jsonb_typeof(alternate_signers)='array'
   AND jsonb_array_length(alternate_signers) BETWEEN 0 AND 8),
 requires_cooperative_seal boolean NOT NULL DEFAULT true,
 effective_from_jalali text NOT NULL,
 stated_end_jalali text,
 source_description text NOT NULL CHECK(length(source_description) BETWEEN 20 AND 1300
   AND source_description !~ '(^|[^0-9])[0-9]{10}([^0-9]|$)'),
 CHECK(effective_from_jalali ~ '^14[0-9]{2}/[0-1][0-9]/[0-3][0-9]$'),
 CHECK(stated_end_jalali IS NULL OR stated_end_jalali >= effective_from_jalali),
 UNIQUE(notice_id,authority_kind)
);
ALTER TABLE tto.cooperative_legal_notice_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_legal_notice_archive FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_board_office_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_board_office_history FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_signing_authority_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_signing_authority_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_legal_notice_archive,
 tto.cooperative_board_office_history,tto.cooperative_signing_authority_history FROM PUBLIC,tto_app;
CREATE TRIGGER cooperative_notices_immutable BEFORE UPDATE OR DELETE
 ON tto.cooperative_legal_notice_archive FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();
CREATE TRIGGER cooperative_board_history_immutable BEFORE UPDATE OR DELETE
 ON tto.cooperative_board_office_history FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();
CREATE TRIGGER cooperative_signing_history_immutable BEFORE UPDATE OR DELETE
 ON tto.cooperative_signing_authority_history FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.cooperative_append_legal_notice(
 p_legal_id text,p_registration_no text,p_source_type text,p_kind text,
 p_notice_number text,p_gazette_issue text,p_published_j text,p_resolution_j text,
 p_letter text,p_letter_j text,p_summary text,p_url text,
 p_board jsonb,p_signing jsonb,p_request_key uuid)
RETURNS TABLE(notice_id uuid,source_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
 old record;new_id uuid; b jsonb;rule jsonb; i integer;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 IF p_legal_id IS NULL OR p_legal_id !~ '^[0-9]{11}$'
   OR p_registration_no IS NULL OR p_registration_no !~ '^[0-9]{1,12}$'
   OR p_source_type NOT IN ('COMPANY_REGISTRY','OFFICIAL_GAZETTE')
   OR p_kind NOT IN ('ESTABLISHMENT','BOARD_CHANGE','CEO_CHANGE','SIGNATORY_CHANGE','BYLAWS_CHANGE',
    'CAPITAL_CHANGE','ADDRESS_CHANGE','GENERAL_ASSEMBLY','DISSOLUTION','OTHER')
   OR p_resolution_j IS NULL OR p_resolution_j !~ '^14[0-9]{2}/[0-1][0-9]/[0-3][0-9]$'
   OR p_summary IS NULL OR length(p_summary) NOT BETWEEN 30 AND 6000
   OR p_summary ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)'
   OR p_request_key IS NULL OR p_board IS NULL OR jsonb_typeof(p_board)<>'array'
   OR jsonb_array_length(p_board)>30 OR p_signing IS NULL OR jsonb_typeof(p_signing)<>'array'
   OR jsonb_array_length(p_signing)>6
 THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_INPUT_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':notice:'||actor::text||':'||p_request_key::text,0));
 SELECT n.* INTO old FROM tto.cooperative_legal_notice_archive n
 WHERE n.tenant_id=tid AND n.submitted_by=actor AND n.request_key=p_request_key;
 IF FOUND THEN
  IF old.cooperative_legal_national_id<>p_legal_id OR old.cooperative_registration_no<>p_registration_no
    OR old.source_type<>p_source_type OR old.notice_kind<>p_kind
    OR old.resolution_on_jalali<>p_resolution_j OR old.public_summary<>p_summary
    OR old.source_notice_number IS DISTINCT FROM nullif(p_notice_number,'')
    OR old.gazette_issue_number IS DISTINCT FROM nullif(p_gazette_issue,'')
    OR old.original_url IS DISTINCT FROM nullif(p_url,'')
    OR old.published_on_jalali IS DISTINCT FROM nullif(p_published_j,'')
    OR old.cooperative_authority_letter IS DISTINCT FROM nullif(p_letter,'')
    OR old.cooperative_authority_letter_on_jalali IS DISTINCT FROM nullif(p_letter_j,'')
    OR (SELECT coalesce(jsonb_agg(jsonb_build_object(
     'personName',h.person_name,'office',h.office,'eventType',h.event_type,
     'eventOn',h.event_on_jalali,'termEnd',h.term_end_jalali) ORDER BY h.person_name,h.office,h.event_type),'[]'::jsonb)
       FROM tto.cooperative_board_office_history h WHERE h.notice_id=old.notice_id)
      IS DISTINCT FROM
      (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'personName',x->>'personName','office',x->>'office','eventType',x->>'eventType',
      'eventOn',x->>'eventOn','termEnd',nullif(x->>'termEnd','')) ORDER BY x->>'personName',x->>'office',x->>'eventType'),'[]'::jsonb)
       FROM jsonb_array_elements(p_board) x)
    OR (SELECT coalesce(jsonb_agg(jsonb_build_object('authorityKind',h.authority_kind,
        'requiredSigner',h.required_signer,'alternateSigners',h.alternate_signers,
        'requiresSeal',h.requires_cooperative_seal,'effectiveFrom',h.effective_from_jalali,
        'statedEnd',h.stated_end_jalali,'description',h.source_description)
        ORDER BY h.authority_kind),'[]'::jsonb)
       FROM tto.cooperative_signing_authority_history h WHERE h.notice_id=old.notice_id)
      IS DISTINCT FROM
      (SELECT coalesce(jsonb_agg(jsonb_build_object('authorityKind',x->>'authorityKind',
        'requiredSigner',x->>'requiredSigner','alternateSigners',x->'alternateSigners',
        'requiresSeal',(x->>'requiresSeal')::boolean,'effectiveFrom',x->>'effectiveFrom',
        'statedEnd',nullif(x->>'statedEnd',''),'description',x->>'description')
        ORDER BY x->>'authorityKind'),'[]'::jsonb)
       FROM jsonb_array_elements(p_signing) x)
  THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_REPLAY_CONFLICT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT old.notice_id,old.provenance_status,true;RETURN;
 END IF;
 INSERT INTO tto.cooperative_legal_notice_archive AS n
 (tenant_id,cooperative_legal_national_id,cooperative_registration_no,source_type,notice_kind,
  source_notice_number,gazette_issue_number,published_on_jalali,resolution_on_jalali,
  cooperative_authority_letter,cooperative_authority_letter_on_jalali,public_summary,
  original_url,text_sha256,submitted_by,request_key)
 VALUES(tid,p_legal_id,p_registration_no,p_source_type,p_kind,
  nullif(p_notice_number,''),nullif(p_gazette_issue,''),nullif(p_published_j,''),
  p_resolution_j,nullif(p_letter,''),nullif(p_letter_j,''),p_summary,nullif(p_url,''),
  sha256(convert_to(p_summary,'UTF8')),actor,p_request_key)
 RETURNING n.notice_id INTO new_id;
 FOR b IN SELECT value FROM jsonb_array_elements(p_board) LOOP
  IF jsonb_typeof(b)<>'object' OR b ? 'nationalId' OR b ? 'national_id' OR
    length(b->>'personName') NOT BETWEEN 3 AND 160 OR
    b->>'personName' ~ '[0-9]{10}' OR
    b->>'office' NOT IN('BOARD_CHAIR','BOARD_VICE_CHAIR','BOARD_SECRETARY','BOARD_MEMBER','CEO','INSPECTOR','OTHER') OR
    b->>'eventType' NOT IN('APPOINTED','RESIGNED','REAPPOINTED','REMOVED','REPORTED') OR
    (b->>'eventOn') !~ '^14[0-9]{2}/[0-1][0-9]/[0-3][0-9]$'
  THEN RAISE EXCEPTION 'COOPERATIVE_BOARD_INPUT_INVALID' USING ERRCODE='22023';END IF;
  INSERT INTO tto.cooperative_board_office_history
   (tenant_id,notice_id,person_name,office,event_type,event_on_jalali,term_end_jalali,
    previous_term_start_known)
  VALUES(tid,new_id,b->>'personName',b->>'office',b->>'eventType',
    b->>'eventOn',nullif(b->>'termEnd',''),false);
 END LOOP;
 FOR rule IN SELECT value FROM jsonb_array_elements(p_signing) LOOP
  IF jsonb_typeof(rule)<>'object' OR
    rule->>'authorityKind' NOT IN('BINDING_FINANCIAL','ORDINARY_LETTERS') OR
    length(rule->>'requiredSigner') NOT BETWEEN 3 AND 160 OR
    rule->>'requiredSigner' ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)' OR
    jsonb_typeof(rule->'alternateSigners')<>'array' OR
    jsonb_array_length(rule->'alternateSigners')>8 OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(rule->'alternateSigners') AS alt(value)
      WHERE jsonb_typeof(alt.value)<>'string' OR
       length(alt.value #>> '{}') NOT BETWEEN 3 AND 160 OR
       (alt.value #>> '{}') ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)') OR
    length(rule->>'description') NOT BETWEEN 20 AND 1300 OR
    rule->>'description' ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)'
  THEN RAISE EXCEPTION 'COOPERATIVE_SIGNING_RULE_INVALID' USING ERRCODE='22023';END IF;
  INSERT INTO tto.cooperative_signing_authority_history
   (tenant_id,notice_id,authority_kind,required_signer,alternate_signers,
    requires_cooperative_seal,effective_from_jalali,stated_end_jalali,source_description)
  VALUES(tid,new_id,rule->>'authorityKind',rule->>'requiredSigner',
   rule->'alternateSigners',coalesce((rule->>'requiresSeal')::boolean,true),
   rule->>'effectiveFrom',nullif(rule->>'statedEnd',''),rule->>'description');
 END LOOP;
 RETURN QUERY SELECT new_id,'USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'::text,false;
END $fn$;

-- Shareholder-visible chronology. Retains all historical events, no implied tenure
-- outside the notice date; source status is always unverified until separately attested.
CREATE FUNCTION tto.cooperative_shareholder_governance_history()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT (
    tto.has_tenant_role(tid,'MEMBER') OR
    tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
    tto.has_tenant_role(tid,'LEGAL_REVIEWER'))
 THEN RAISE EXCEPTION 'COOPERATIVE_HISTORY_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object(
  'tenantId',tid,'publishedVerified',false,
  'displayMode','SOURCE_DECLARED_HISTORY_PENDING_AUTHENTICATION',
  'confersSigningPower',false,'confersVotingRights',false,
  'notices',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',n.notice_id,'sourceType',n.source_type,'noticeKind',n.notice_kind,
    'legalNationalId',n.cooperative_legal_national_id,'registrationNumber',n.cooperative_registration_no,
    'sourceNoticeNumber',n.source_notice_number,'gazetteIssue',n.gazette_issue_number,
    'publishedOn',n.published_on_jalali,'resolutionOn',n.resolution_on_jalali,
    'authorityLetter',n.cooperative_authority_letter,
    'authorityLetterOn',n.cooperative_authority_letter_on_jalali,
    'summary',n.public_summary,'sourceUrl',n.original_url,
    'provenance',n.provenance_status)
   ORDER BY n.resolution_on_jalali DESC,n.submitted_at DESC) FROM (
     SELECT * FROM tto.cooperative_legal_notice_archive
     WHERE tenant_id=tid ORDER BY resolution_on_jalali DESC,submitted_at DESC LIMIT 100
    ) n),'[]'::jsonb),
  'boardHistory',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',h.notice_id,'personName',h.person_name,'office',h.office,
    'eventType',h.event_type,'eventOn',h.event_on_jalali,'termEnd',h.term_end_jalali,
    'sourceVerified',false) ORDER BY h.event_on_jalali DESC,h.person_name) FROM (
     SELECT * FROM tto.cooperative_board_office_history
     WHERE tenant_id=tid ORDER BY event_on_jalali DESC,record_id DESC LIMIT 300
    ) h),'[]'::jsonb),
  'signingHistory',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',h.notice_id,'authorityKind',h.authority_kind,'requiredSigner',h.required_signer,
    'alternateSigners',h.alternate_signers,'requiresSeal',h.requires_cooperative_seal,
    'effectiveFrom',h.effective_from_jalali,'statedEnd',h.stated_end_jalali,
    'description',h.source_description,'sourceVerified',false)
     ORDER BY h.effective_from_jalali DESC) FROM (
     SELECT * FROM tto.cooperative_signing_authority_history
     WHERE tenant_id=tid ORDER BY effective_from_jalali DESC,rule_id DESC LIMIT 200
    ) h),'[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_append_legal_notice(
 text,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,uuid),
 tto.cooperative_shareholder_governance_history() FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_append_legal_notice(
 text,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,uuid),
 tto.cooperative_shareholder_governance_history() TO tto_app;
COMMENT ON TABLE tto.cooperative_legal_notice_archive IS
 'Append-only source-declared legal notice archive; source authenticity and signatory powers are never implied.';
COMMIT;
