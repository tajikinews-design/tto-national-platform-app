-- PH12 #171: append-only withdrawal/invalidation of an observed source check
-- and derived fail-closed as-of assessment. No official registry connected.
-- A withdrawn/expired check cannot be silently treated as still current.
-- No legally approved status, no tariff activation, no mutation of history.
BEGIN;
CREATE TABLE tto.ph12_tariff_board_source_invalidations (
 invalidation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL REFERENCES tto.ph12_tariff_board_evidence_cases(case_id),
 check_id uuid NOT NULL UNIQUE REFERENCES tto.ph12_tariff_board_legal_source_checks(check_id),
 invalidated_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 reason text NOT NULL CHECK (reason IN
  ('SOURCE_WITHDRAWN','SOURCE_UNREACHABLE','SOURCE_SUPERSEDED_REPORTED','SOURCE_REVOCATION_REPORTED')),
 evidence_reference text NOT NULL CHECK(length(evidence_reference) BETWEEN 8 AND 160),
 request_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,invalidated_by,request_key)
);
CREATE INDEX ph12_source_invalidations_tenant_case_idx
 ON tto.ph12_tariff_board_source_invalidations(tenant_id,case_id,recorded_at DESC);
ALTER TABLE tto.ph12_tariff_board_source_invalidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_board_source_invalidations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_tariff_board_source_invalidations FROM PUBLIC,tto_app;
CREATE TRIGGER ph12_board_source_invalidations_immutable
 BEFORE UPDATE OR DELETE ON tto.ph12_tariff_board_source_invalidations
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.ph12_invalidate_tariff_board_source_check(
 p_check uuid,p_reason text,p_evidence_reference text,p_request_key uuid)
RETURNS TABLE(invalidation_id uuid,source_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
 original record; prior record; inserted record;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_INVALIDATION_LEGAL_REVIEWER_REQUIRED' USING ERRCODE='42501';END IF;
 IF p_check IS NULL OR p_request_key IS NULL OR
    p_reason IS NULL OR p_reason NOT IN (
      'SOURCE_WITHDRAWN','SOURCE_UNREACHABLE',
      'SOURCE_SUPERSEDED_REPORTED','SOURCE_REVOCATION_REPORTED') OR
    p_evidence_reference IS NULL OR
    p_evidence_reference !~ '^[A-Za-z0-9_.:/-]{8,160}$'
 THEN RAISE EXCEPTION 'PH12_INVALIDATION_INPUT_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
   tid::text||':ph12:source-invalidation:'||p_check::text,0));
 SELECT sc.check_id,sc.case_id,sc.checked_by,c.submitted_by,
        c.signer_claims,d.created_by AS draft_author,r.reviewed_by AS document_reviewer
 INTO original
 FROM tto.ph12_tariff_board_legal_source_checks sc
 JOIN tto.ph12_tariff_board_evidence_cases c
   ON c.case_id=sc.case_id AND c.tenant_id=sc.tenant_id
 JOIN tto.ph12_tariff_drafts d
   ON d.draft_id=c.draft_id AND d.tenant_id=c.tenant_id
 LEFT JOIN tto.ph12_tariff_board_review_events r
   ON r.case_id=c.case_id AND r.tenant_id=c.tenant_id
 WHERE sc.tenant_id=tid AND sc.check_id=p_check;
 IF NOT FOUND THEN RAISE EXCEPTION 'PH12_INVALIDATION_SOURCE_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF actor=original.checked_by OR actor=original.submitted_by OR
    actor=original.draft_author OR actor=original.document_reviewer OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(original.signer_claims) signer
      WHERE signer->>'signerId'=actor::text)
 THEN RAISE EXCEPTION 'PH12_INVALIDATION_INDEPENDENCE_DENIED' USING ERRCODE='42501';END IF;
 SELECT x.* INTO prior FROM tto.ph12_tariff_board_source_invalidations x
 WHERE x.tenant_id=tid AND x.invalidated_by=actor AND x.request_key=p_request_key;
 IF FOUND THEN
  IF prior.check_id<>p_check OR prior.reason<>p_reason OR
     prior.evidence_reference<>p_evidence_reference
  THEN RAISE EXCEPTION 'PH12_INVALIDATION_REPLAY_CONFLICT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT prior.invalidation_id,'SOURCE_INVALIDATED'::text,true;RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM tto.ph12_tariff_board_source_invalidations x
     WHERE x.check_id=p_check)
 THEN RAISE EXCEPTION 'PH12_SOURCE_ALREADY_INVALIDATED' USING ERRCODE='23505';END IF;
 INSERT INTO tto.ph12_tariff_board_source_invalidations AS x
  (tenant_id,case_id,check_id,invalidated_by,reason,evidence_reference,request_key)
 VALUES(tid,original.case_id,p_check,actor,p_reason,p_evidence_reference,p_request_key)
 RETURNING x.invalidation_id INTO inserted;
 RETURN QUERY SELECT inserted.invalidation_id,'SOURCE_INVALIDATED'::text,false;
END $fn$;

-- Derived read-only snapshot: never turns an unverified source into verified.
-- Same-tenant legal reviewer only; no raw table grants or activation side effect.
CREATE FUNCTION tto.ph12_tariff_board_source_recheck(p_case uuid)
RETURNS TABLE(case_id uuid,assessment text,source_checks bigint,
 stale_checks bigint,invalidated_checks bigint,rejected_checks bigint,
 legal_review_recorded boolean,official_source_authenticated boolean,
 legal_authority_verified boolean,tariff_activation_allowed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
 n bigint; stale bigint; invalidated bigint; rejected bigint; reviewed boolean;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_SOURCE_RECHECK_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF p_case IS NULL OR NOT EXISTS(
  SELECT 1 FROM tto.ph12_tariff_board_evidence_cases c
  WHERE c.case_id=p_case AND c.tenant_id=tid)
 THEN RAISE EXCEPTION 'PH12_SOURCE_RECHECK_CASE_NOT_FOUND' USING ERRCODE='42501';END IF;
 SELECT count(*),count(*) FILTER(
   WHERE sc.source_expires_at<=clock_timestamp()
     OR sc.source_observed_at>clock_timestamp()),
   count(*) FILTER(WHERE x.invalidation_id IS NOT NULL),
   count(*) FILTER(WHERE sc.verified_result='SOURCE_REJECTED')
 INTO n,stale,invalidated,rejected
 FROM tto.ph12_tariff_board_legal_source_checks sc
 LEFT JOIN tto.ph12_tariff_board_source_invalidations x
  ON x.check_id=sc.check_id AND x.tenant_id=sc.tenant_id AND x.case_id=sc.case_id
 WHERE sc.tenant_id=tid AND sc.case_id=p_case;
 SELECT EXISTS(SELECT 1 FROM tto.ph12_tariff_board_legal_dispositions d
  WHERE d.tenant_id=tid AND d.case_id=p_case) INTO reviewed;
 RETURN QUERY SELECT p_case,
  CASE WHEN invalidated>0 THEN 'HOLD_SOURCE_INVALIDATED'
       WHEN stale>0 THEN 'HOLD_SOURCE_EXPIRED'
       WHEN rejected>0 THEN 'HOLD_SOURCE_REJECTED'
       WHEN n=0 THEN 'HOLD_SOURCE_MISSING'
       ELSE 'HOLD_OFFICIAL_SOURCE_UNVERIFIED' END,
  n,stale,invalidated,rejected,reviewed,false,false,false;
END $fn$;
REVOKE ALL ON FUNCTION
 tto.ph12_invalidate_tariff_board_source_check(uuid,text,text,uuid),
 tto.ph12_tariff_board_source_recheck(uuid)
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION
 tto.ph12_invalidate_tariff_board_source_check(uuid,text,text,uuid),
 tto.ph12_tariff_board_source_recheck(uuid) TO tto_app;
COMMENT ON TABLE tto.ph12_tariff_board_source_invalidations IS
 'Append-only withdrawal/report of a source check. Reported revocation is NOT authenticated issuer revocation; all legal authority remains unverified.';
COMMIT;
