-- CHILD06/PH12 temporal reconstruction: append-only notice correction/revocation,
-- and role-scoped, bounded bitemporal source facts.
-- All states are source-DECLARED, never proof of legally valid signature.
BEGIN;
CREATE TABLE tto.cooperative_notice_transitions (
 transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 target_notice_id uuid NOT NULL REFERENCES tto.cooperative_legal_notice_archive(notice_id),
 replacement_notice_id uuid REFERENCES tto.cooperative_legal_notice_archive(notice_id),
 action text NOT NULL CHECK(action IN ('CORRECTED','REVOKED')),
 claimed_effective_on text NOT NULL CHECK(
    claimed_effective_on ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
 published_on text CHECK(
    published_on IS NULL OR published_on ~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 10 AND 300),
 source_status text NOT NULL DEFAULT 'USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'
  CHECK(source_status='USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'),
 reported_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((action='CORRECTED' AND replacement_notice_id IS NOT NULL
         AND replacement_notice_id<>target_notice_id)
    OR (action='REVOKED' AND replacement_notice_id IS NULL)),
 UNIQUE(tenant_id,reported_by,request_key)
);
CREATE INDEX cooperative_transitions_target_time
 ON tto.cooperative_notice_transitions (tenant_id,target_notice_id,claimed_effective_on);
ALTER TABLE tto.cooperative_notice_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_notice_transitions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_notice_transitions FROM PUBLIC,tto_app;
CREATE TRIGGER cooperative_notice_transitions_immutable BEFORE UPDATE OR DELETE
 ON tto.cooperative_notice_transitions FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.cooperative_append_notice_transition(
 p_target uuid,p_replacement uuid,p_action text,p_effective text,
 p_published text,p_reference text,p_request uuid)
RETURNS TABLE(transition_id uuid,state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 prior record;created uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'COOPERATIVE_TRANSITION_MANAGER_REQUIRED' USING ERRCODE='42501';END IF;
 IF p_target IS NULL OR p_action NOT IN ('CORRECTED','REVOKED') OR
   (p_action='CORRECTED' AND (p_replacement IS NULL OR p_replacement=p_target)) OR
   (p_action='REVOKED' AND p_replacement IS NOT NULL) OR
   p_effective IS NULL OR p_effective !~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$' OR
   (p_published IS NOT NULL AND p_published !~ '^14[0-9]{2}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$') OR
   p_reference IS NULL OR length(p_reference) NOT BETWEEN 10 AND 300 OR p_request IS NULL
 THEN RAISE EXCEPTION 'COOPERATIVE_TRANSITION_INPUT_INVALID' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.cooperative_legal_notice_archive
       WHERE tenant_id=tid AND notice_id=p_target) OR
    (p_replacement IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM tto.cooperative_legal_notice_archive
       WHERE tenant_id=tid AND notice_id=p_replacement))
 THEN RAISE EXCEPTION 'COOPERATIVE_TRANSITION_FOREIGN_SOURCE' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':transition:'||actor::text||':'||p_request::text,0));
 SELECT * INTO prior FROM tto.cooperative_notice_transitions
 WHERE tenant_id=tid AND reported_by=actor AND request_key=p_request;
 IF FOUND THEN
  IF prior.target_notice_id<>p_target OR
     prior.replacement_notice_id IS DISTINCT FROM p_replacement OR prior.action<>p_action OR
     prior.claimed_effective_on<>p_effective OR prior.published_on IS DISTINCT FROM p_published OR
     prior.source_reference<>p_reference
  THEN RAISE EXCEPTION 'COOPERATIVE_TRANSITION_REPLAY_CONFLICT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT prior.transition_id,prior.source_status,true;RETURN;
 END IF;
 INSERT INTO tto.cooperative_notice_transitions AS t(
   tenant_id,target_notice_id,replacement_notice_id,action,claimed_effective_on,
   published_on,source_reference,reported_by,request_key)
 VALUES(tid,p_target,p_replacement,p_action,p_effective,p_published,p_reference,actor,p_request)
 RETURNING t.transition_id INTO created;
 RETURN QUERY SELECT created,'USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED'::text,false;
END $fn$;

-- From every source notice captured before the known-at timestamp, return
-- the full bounded history; never silently truncate and infer "current".
CREATE FUNCTION tto.cooperative_governance_temporal_facts(p_known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 n_count integer;b_count integer;s_count integer;t_count integer;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT (
   tto.has_tenant_role(tid,'MEMBER') OR
   tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
   tto.has_tenant_role(tid,'LEGAL_REVIEWER'))
 THEN RAISE EXCEPTION 'COOPERATIVE_TIMELINE_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF p_known_at IS NULL OR p_known_at>clock_timestamp()+interval '1 second'
 THEN RAISE EXCEPTION 'COOPERATIVE_TIMELINE_KNOWN_AT_INVALID' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO n_count FROM tto.cooperative_legal_notice_archive
  WHERE tenant_id=tid AND submitted_at<=p_known_at;
 SELECT count(*) INTO b_count FROM tto.cooperative_board_office_history b
   JOIN tto.cooperative_legal_notice_archive n ON n.notice_id=b.notice_id
   WHERE n.tenant_id=tid AND n.submitted_at<=p_known_at;
 SELECT count(*) INTO s_count FROM tto.cooperative_signing_authority_history s
   JOIN tto.cooperative_legal_notice_archive n ON n.notice_id=s.notice_id
   WHERE n.tenant_id=tid AND n.submitted_at<=p_known_at;
 SELECT count(*) INTO t_count FROM tto.cooperative_notice_transitions
  WHERE tenant_id=tid AND recorded_at<=p_known_at;
 IF n_count>200 OR b_count>2500 OR s_count>400 OR t_count>500
 THEN RAISE EXCEPTION 'COOPERATIVE_TIMELINE_INCOMPLETE_LIMIT' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('tenantId',tid,'knownAt',p_known_at,
  'officiallyVerified',false,'legalSignerAuthorityGranted',false,'tariffActivated',false,
  'notices',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',n.notice_id,'resolutionOn',n.resolution_on_jalali,
    'publishedOn',n.published_on_jalali,'submittedAt',n.submitted_at,
    'sourceType',n.source_type,'sourceNoticeNumber',n.source_notice_number,
    'provenance',n.provenance_status) ORDER BY n.submitted_at,n.notice_id)
    FROM tto.cooperative_legal_notice_archive n
    WHERE n.tenant_id=tid AND n.submitted_at<=p_known_at),'[]'::jsonb),
  'board',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',b.notice_id,'recordId',b.record_id,'personName',b.person_name,
    'office',b.office,'eventType',b.event_type,'eventOn',b.event_on_jalali,
    'termEnd',b.term_end_jalali) ORDER BY b.event_on_jalali,b.record_id)
    FROM tto.cooperative_board_office_history b
    JOIN tto.cooperative_legal_notice_archive n ON n.notice_id=b.notice_id
    WHERE n.tenant_id=tid AND n.submitted_at<=p_known_at),'[]'::jsonb),
  'signing',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',s.notice_id,'ruleId',s.rule_id,'authorityKind',s.authority_kind,
    'requiredSigner',s.required_signer,'alternateSigners',s.alternate_signers,
    'requiresSeal',s.requires_cooperative_seal,'effectiveFrom',s.effective_from_jalali,
    'statedEnd',s.stated_end_jalali,'description',s.source_description)
    ORDER BY s.effective_from_jalali,s.rule_id)
    FROM tto.cooperative_signing_authority_history s
    JOIN tto.cooperative_legal_notice_archive n ON n.notice_id=s.notice_id
    WHERE n.tenant_id=tid AND n.submitted_at<=p_known_at),'[]'::jsonb),
  'transitions',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'transitionId',t.transition_id,'targetNoticeId',t.target_notice_id,
    'replacementNoticeId',t.replacement_notice_id,'action',t.action,
    'effectiveOn',t.claimed_effective_on,'publishedOn',t.published_on,
    'recordedAt',t.recorded_at,'sourceReference',t.source_reference,
    'sourceStatus',t.source_status) ORDER BY t.recorded_at,t.transition_id)
    FROM tto.cooperative_notice_transitions t
    WHERE t.tenant_id=tid AND t.recorded_at<=p_known_at),'[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_append_notice_transition(
 uuid,uuid,text,text,text,text,uuid),tto.cooperative_governance_temporal_facts(timestamptz)
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_append_notice_transition(
 uuid,uuid,text,text,text,text,uuid),tto.cooperative_governance_temporal_facts(timestamptz)
 TO tto_app;
COMMENT ON TABLE tto.cooperative_notice_transitions IS
 'Source-declared corrections/revocations; immutable claims only, never authoritative legal powers.';
COMMIT;
