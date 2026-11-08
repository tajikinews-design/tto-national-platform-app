-- CHILD06 / PH12: source-declared conflict evidence + independent laboratory disposition.
-- This is an immutable audit workflow; a review can NEVER grant legal authority.
BEGIN;
CREATE TABLE tto.cooperative_governance_conflict_cases (
 case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 as_of_jalali text NOT NULL CHECK(as_of_jalali ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
 conflict_code text NOT NULL CHECK(length(conflict_code) BETWEEN 12 AND 180 AND
    conflict_code ~ '^(MULTIPLE_CLAIMANTS|OVERLAPPING_SIGNING_RULES|CONFLICTING_NOTICE_TRANSITIONS|MULTIPLE_PREDECESSORS|CORRECTION_CYCLE|AMBIGUOUS_SAME_DAY_OFFICE):'),
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 opened_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 provenance_status text NOT NULL DEFAULT 'USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'
    CHECK(provenance_status='USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'),
 UNIQUE(tenant_id,opened_by,request_key)
);
CREATE TABLE tto.cooperative_governance_conflict_evidence (
 evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL REFERENCES tto.cooperative_governance_conflict_cases(case_id),
 source_kind text NOT NULL CHECK(source_kind IN('NOTICE','TRANSITION')),
 source_id uuid NOT NULL,
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 12 AND 350
   AND source_reference !~ '(^|[^0-9])[0-9]{10}([^0-9]|$)'),
 claimed_attachment_sha256 text CHECK(claimed_attachment_sha256 IS NULL OR
   claimed_attachment_sha256 ~ '^[0-9a-f]{64}$'),
 recorded_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 source_verified boolean NOT NULL DEFAULT false CHECK(source_verified=false),
 UNIQUE(case_id,source_kind,source_id)
);
CREATE TABLE tto.cooperative_governance_conflict_dispositions (
 disposition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_governance_conflict_cases(case_id),
 disposition text NOT NULL CHECK(disposition IN
   ('HOLD_OFFICIAL_SOURCE_REQUIRED','REJECT_SOURCE_CLAIM','HOLD_INSUFFICIENT_EVIDENCE')),
 evidence_ids uuid[] NOT NULL CHECK(cardinality(evidence_ids) BETWEEN 1 AND 20),
 review_reason text NOT NULL CHECK(length(review_reason) BETWEEN 25 AND 1400
   AND review_reason !~ '(^|[^0-9])[0-9]{10}([^0-9]|$)'),
 reviewer_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 legal_authority_verified boolean NOT NULL DEFAULT false CHECK(legal_authority_verified=false),
 tariff_activated boolean NOT NULL DEFAULT false CHECK(tariff_activated=false),
 UNIQUE(tenant_id,reviewer_id,request_key)
);
CREATE INDEX cooperative_conflict_cases_scope
 ON tto.cooperative_governance_conflict_cases(tenant_id,opened_at DESC);
CREATE INDEX cooperative_conflict_evidence_case
 ON tto.cooperative_governance_conflict_evidence(tenant_id,case_id);
DO $ddl$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY[
  'cooperative_governance_conflict_cases','cooperative_governance_conflict_evidence',
  'cooperative_governance_conflict_dispositions'] LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON TABLE tto.%I FROM PUBLIC,tto_app',tab);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON tto.%I FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes()',
    tab||'_immutable',tab);
 END LOOP;
END $ddl$;

CREATE FUNCTION tto.cooperative_open_governance_conflict_case(
 p_as_of text,p_conflict text,p_sha text,p_evidence jsonb,p_request uuid)
RETURNS TABLE(case_id uuid,state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 old record; new_id uuid; e jsonb;source_uuid uuid; source_kind text; evidence_count integer;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_OPEN_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 IF p_as_of IS NULL OR p_as_of !~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$' OR
    p_conflict IS NULL OR p_conflict !~ '^(MULTIPLE_CLAIMANTS|OVERLAPPING_SIGNING_RULES|CONFLICTING_NOTICE_TRANSITIONS|MULTIPLE_PREDECESSORS|CORRECTION_CYCLE|AMBIGUOUS_SAME_DAY_OFFICE):' OR
    length(p_conflict)>180 OR p_sha IS NULL OR p_sha !~ '^[0-9a-f]{64}$' OR
    p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'array' OR
    jsonb_array_length(p_evidence) NOT BETWEEN 1 AND 20 OR p_request IS NULL
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_OPEN_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':conflict:'||actor::text||':'||p_request::text,0));
 SELECT * INTO old FROM tto.cooperative_governance_conflict_cases
  WHERE tenant_id=tid AND opened_by=actor AND request_key=p_request;
 IF FOUND THEN
  IF old.as_of_jalali<>p_as_of OR old.conflict_code<>p_conflict OR old.source_sha256<>p_sha OR
     (SELECT coalesce(jsonb_agg(jsonb_build_object('kind',v.source_kind,
       'sourceId',v.source_id,'reference',v.source_reference,
       'sha256',v.claimed_attachment_sha256) ORDER BY v.source_kind,v.source_id),'[]'::jsonb)
      FROM tto.cooperative_governance_conflict_evidence v WHERE v.case_id=old.case_id)
     IS DISTINCT FROM
     (SELECT coalesce(jsonb_agg(jsonb_build_object('kind',x->>'kind',
       'sourceId',(x->>'sourceId')::uuid,'reference',x->>'reference',
       'sha256',nullif(x->>'sha256','')) ORDER BY x->>'kind',(x->>'sourceId')::uuid),'[]'::jsonb)
      FROM jsonb_array_elements(p_evidence) x)
  THEN RAISE EXCEPTION 'CHILD06_CONFLICT_OPEN_REPLAY_DIFFERENT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT old.case_id,old.provenance_status,true;RETURN;
 END IF;
 -- Fully validate source scope and payload before any case is committed.
 FOR e IN SELECT value FROM jsonb_array_elements(p_evidence) LOOP
  IF jsonb_typeof(e)<>'object' OR
    (SELECT count(*) FROM jsonb_object_keys(e) k WHERE k NOT IN
      ('kind','sourceId','reference','sha256'))>0 OR
    e->>'kind' NOT IN ('NOTICE','TRANSITION') OR
    (e->>'sourceId') IS NULL OR (e->>'sourceId') !~
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
    length(e->>'reference') NOT BETWEEN 12 AND 350 OR
    e->>'reference' ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)' OR
    (nullif(e->>'sha256','') IS NOT NULL AND nullif(e->>'sha256','') !~ '^[0-9a-f]{64}$')
  THEN RAISE EXCEPTION 'CHILD06_CONFLICT_EVIDENCE_INVALID' USING ERRCODE='22023';END IF;
  source_uuid:=(e->>'sourceId')::uuid;source_kind:=e->>'kind';
  IF (source_kind='NOTICE' AND NOT EXISTS(SELECT 1
     FROM tto.cooperative_legal_notice_archive n WHERE n.notice_id=source_uuid AND n.tenant_id=tid))
    OR (source_kind='TRANSITION' AND NOT EXISTS(SELECT 1
     FROM tto.cooperative_notice_transitions t WHERE t.transition_id=source_uuid AND t.tenant_id=tid))
  THEN RAISE EXCEPTION 'CHILD06_CONFLICT_FOREIGN_EVIDENCE' USING ERRCODE='42501';END IF;
 END LOOP;
 INSERT INTO tto.cooperative_governance_conflict_cases AS c
  (tenant_id,as_of_jalali,conflict_code,source_sha256,opened_by,request_key)
 VALUES(tid,p_as_of,p_conflict,p_sha,actor,p_request) RETURNING c.case_id INTO new_id;
 INSERT INTO tto.cooperative_governance_conflict_evidence
  (tenant_id,case_id,source_kind,source_id,source_reference,claimed_attachment_sha256,recorded_by)
 SELECT tid,new_id,x->>'kind',(x->>'sourceId')::uuid,x->>'reference',
  nullif(x->>'sha256',''),actor FROM jsonb_array_elements(p_evidence) x;
 RETURN QUERY SELECT new_id,'USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'::text,false;
END $fn$;

CREATE FUNCTION tto.cooperative_review_governance_conflict(
 p_case uuid,p_disposition text,p_evidence_ids uuid[],p_reason text,p_request uuid)
RETURNS TABLE(disposition_id uuid,outcome text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 source_case record;old record;new_id uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_REVIEWER_DENIED' USING ERRCODE='42501';END IF;
 IF p_case IS NULL OR p_disposition NOT IN('HOLD_OFFICIAL_SOURCE_REQUIRED',
      'REJECT_SOURCE_CLAIM','HOLD_INSUFFICIENT_EVIDENCE') OR
    p_evidence_ids IS NULL OR cardinality(p_evidence_ids) NOT BETWEEN 1 AND 20 OR
    p_reason IS NULL OR length(p_reason) NOT BETWEEN 25 AND 1400 OR
    p_reason ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)' OR p_request IS NULL
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_REVIEW_INPUT_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO source_case FROM tto.cooperative_governance_conflict_cases
  WHERE tenant_id=tid AND case_id=p_case FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHILD06_CONFLICT_CASE_FOREIGN' USING ERRCODE='42501';END IF;
 IF source_case.opened_by=actor OR
   EXISTS(SELECT 1 FROM tto.cooperative_governance_conflict_evidence e
     LEFT JOIN tto.cooperative_legal_notice_archive n ON
       e.source_kind='NOTICE' AND n.notice_id=e.source_id
     LEFT JOIN tto.cooperative_notice_transitions t ON
       e.source_kind='TRANSITION' AND t.transition_id=e.source_id
    WHERE e.case_id=p_case AND (e.recorded_by=actor OR n.submitted_by=actor OR t.reported_by=actor))
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_INDEPENDENCE_REQUIRED' USING ERRCODE='42501';END IF;
 IF (SELECT count(DISTINCT v) FROM unnest(p_evidence_ids) v)<>cardinality(p_evidence_ids) OR
    EXISTS(SELECT 1 FROM unnest(p_evidence_ids) v
     WHERE NOT EXISTS(SELECT 1 FROM tto.cooperative_governance_conflict_evidence e
      WHERE e.case_id=p_case AND e.tenant_id=tid AND e.evidence_id=v))
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_EVIDENCE_BINDING_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':conflict-review:'||p_case::text,0));
 SELECT * INTO old FROM tto.cooperative_governance_conflict_dispositions
  WHERE tenant_id=tid AND case_id=p_case;
 IF FOUND THEN
  IF old.reviewer_id=actor AND old.request_key=p_request AND
   old.disposition=p_disposition AND old.review_reason=p_reason AND
   old.evidence_ids @> p_evidence_ids AND p_evidence_ids @> old.evidence_ids
  THEN RETURN QUERY SELECT old.disposition_id,old.disposition,true;RETURN;END IF;
  RAISE EXCEPTION 'CHILD06_CONFLICT_DISPOSITION_ALREADY_FIXED' USING ERRCODE='23505';
 END IF;
 INSERT INTO tto.cooperative_governance_conflict_dispositions AS d
  (tenant_id,case_id,disposition,evidence_ids,review_reason,reviewer_id,request_key)
 VALUES(tid,p_case,p_disposition,p_evidence_ids,p_reason,actor,p_request)
 RETURNING d.disposition_id INTO new_id;
 RETURN QUERY SELECT new_id,p_disposition,false;
END $fn$;

CREATE FUNCTION tto.cooperative_governance_conflict_audit()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT (
    tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
    tto.has_tenant_role(tid,'LEGAL_REVIEWER'))
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_AUDIT_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF (SELECT count(*) FROM tto.cooperative_governance_conflict_cases WHERE tenant_id=tid)>100
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_AUDIT_TOO_LARGE' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('tenantId',tid,'legalAuthorityVerified',false,
  'tariffActivated',false,'officialEvidenceAuthenticated',false,
  'cases',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'caseId',c.case_id,'asOf',c.as_of_jalali,'conflictCode',c.conflict_code,
   'sourceSha256',c.source_sha256,'openedAt',c.opened_at,
   'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'evidenceId',e.evidence_id,'kind',e.source_kind,'sourceId',e.source_id,
    'reference',e.source_reference,'claimedSha256',e.claimed_attachment_sha256,
    'sourceVerified',false) ORDER BY e.recorded_at,e.evidence_id)
    FROM tto.cooperative_governance_conflict_evidence e WHERE e.case_id=c.case_id),'[]'::jsonb),
   'review', (SELECT jsonb_build_object('dispositionId',d.disposition_id,
     'outcome',d.disposition,'reason',d.review_reason,'evidenceIds',d.evidence_ids,
     'reviewedAt',d.reviewed_at,'legalAuthorityVerified',false,'tariffActivated',false)
    FROM tto.cooperative_governance_conflict_dispositions d WHERE d.case_id=c.case_id))
   ORDER BY c.opened_at,c.case_id) FROM tto.cooperative_governance_conflict_cases c
   WHERE c.tenant_id=tid),'[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_open_governance_conflict_case(text,text,text,jsonb,uuid),
 tto.cooperative_review_governance_conflict(uuid,text,uuid[],text,uuid),
 tto.cooperative_governance_conflict_audit() FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_open_governance_conflict_case(text,text,text,jsonb,uuid),
 tto.cooperative_review_governance_conflict(uuid,text,uuid[],text,uuid),
 tto.cooperative_governance_conflict_audit() TO tto_app;
COMMIT;
