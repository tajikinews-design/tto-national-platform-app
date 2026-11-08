-- PH12 / #171: independently attributable legal disposition of a board-resolution
-- evidence dossier. This is an intake/review trail, NOT official verification.
-- Important: no LEGALLY_APPROVED / VERIFIED / ACTIVE states or tariff mutation.
BEGIN;

-- Separate legal-review capability from document-scanner/reviewer capability.
-- Assigning the role is a privileged governance operation; no public or app
-- endpoint to grant it is added by this migration.
ALTER TABLE tto.role_assignments
 DROP CONSTRAINT role_assignments_role_code_check;
ALTER TABLE tto.role_assignments
 ADD CONSTRAINT role_assignments_role_code_check CHECK (
   role_code IN ('MEMBER','COOPERATIVE_MANAGER','DOCUMENT_REVIEWER','LEGAL_REVIEWER'));

CREATE TABLE tto.ph12_tariff_board_legal_dispositions (
 disposition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL UNIQUE REFERENCES tto.ph12_tariff_board_evidence_cases(case_id),
 document_review_id uuid NOT NULL REFERENCES tto.ph12_tariff_board_review_events(review_id),
 source_check_ids uuid[] NOT NULL CHECK (
   cardinality(source_check_ids) BETWEEN 1 AND 20 AND
   array_position(source_check_ids,NULL) IS NULL),
 legal_reviewer_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 decision text NOT NULL CHECK (decision IN ('LEGAL_HOLD_SOURCE_UNVERIFIED','LEGAL_REJECTED')),
 finding_reference text NOT NULL CHECK (length(finding_reference) BETWEEN 8 AND 160),
 request_key uuid NOT NULL,
 decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,legal_reviewer_id,request_key)
);
CREATE INDEX ph12_legal_dispositions_tenant_idx
 ON tto.ph12_tariff_board_legal_dispositions(tenant_id,decided_at DESC);
ALTER TABLE tto.ph12_tariff_board_legal_dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_board_legal_dispositions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_tariff_board_legal_dispositions FROM PUBLIC,tto_app;
CREATE TRIGGER ph12_board_legal_dispositions_immutable
 BEFORE UPDATE OR DELETE ON tto.ph12_tariff_board_legal_dispositions
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.ph12_record_tariff_board_legal_disposition(
 p_case uuid,p_document_review uuid,p_source_checks uuid[],
 p_decision text,p_reference text,p_request_key uuid)
RETURNS TABLE(disposition_id uuid,legal_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE
 tid uuid:=tto.context_tenant_id();
 actor uuid:=tto.context_actor_id();
 c record;
 prior record;
 result_row record;
 expected_checks integer;
 actual_checks integer;
 rejected_checks integer;
BEGIN
 IF tid IS NULL OR actor IS NULL OR
   NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_case IS NULL OR p_document_review IS NULL OR p_request_key IS NULL OR
    p_source_checks IS NULL OR cardinality(p_source_checks) NOT BETWEEN 1 AND 20 OR
    array_position(p_source_checks,NULL) IS NOT NULL OR
    p_decision IS NULL OR p_decision NOT IN
      ('LEGAL_HOLD_SOURCE_UNVERIFIED','LEGAL_REJECTED') OR
    p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9_.:/-]{8,160}$'
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_INPUT_INVALID' USING ERRCODE='22023';END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(
   tid::text||':board-legal-review:'||p_case::text,0));
 SELECT c0.case_id,c0.submitted_by,c0.signer_claims,
        d.created_by AS draft_author,
        r.review_id AS document_review_id,r.reviewed_by AS document_reviewer,
        r.decision AS document_decision
 INTO c
 FROM tto.ph12_tariff_board_evidence_cases c0
 JOIN tto.ph12_tariff_drafts d
   ON d.draft_id=c0.draft_id AND d.tenant_id=c0.tenant_id
 JOIN tto.ph12_tariff_board_review_events r
   ON r.case_id=c0.case_id AND r.tenant_id=c0.tenant_id
 WHERE c0.tenant_id=tid AND c0.case_id=p_case;
 IF NOT FOUND THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_CASE_NOT_FOUND' USING ERRCODE='42501'; END IF;
 IF c.document_review_id<>p_document_review OR
    actor=c.submitted_by OR actor=c.draft_author OR actor=c.document_reviewer OR
    EXISTS (SELECT 1 FROM jsonb_array_elements(c.signer_claims) s
            WHERE s->>'signerId'=actor::text)
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_INDEPENDENCE_DENIED' USING ERRCODE='42501'; END IF;

 -- Exact snapshots of same-tenant, same-case, unexpired source checks.
 -- All checks remain PENDING/REJECTED; they never imply real source authenticity.
 expected_checks:=cardinality(p_source_checks);
 SELECT count(*),count(*) FILTER (WHERE verified_result='SOURCE_REJECTED')
 INTO actual_checks,rejected_checks
 FROM tto.ph12_tariff_board_legal_source_checks sc
 WHERE sc.tenant_id=tid AND sc.case_id=p_case
   AND sc.check_id=ANY(p_source_checks)
   AND sc.source_expires_at>clock_timestamp()
   AND sc.source_observed_at<=clock_timestamp()
   AND sc.checked_by<>actor;
 IF actual_checks<>expected_checks OR
   (SELECT count(DISTINCT id) FROM unnest(p_source_checks) ids(id))<>expected_checks
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_SOURCE_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
 IF c.document_decision='DOCUMENT_REJECTED' AND p_decision<>'LEGAL_REJECTED'
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_DOCUMENT_REJECTED' USING ERRCODE='42501'; END IF;
 IF rejected_checks>0 AND p_decision<>'LEGAL_REJECTED'
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_REJECTED_SOURCE' USING ERRCODE='42501'; END IF;

 SELECT ld.* INTO prior FROM tto.ph12_tariff_board_legal_dispositions ld
 WHERE ld.tenant_id=tid AND ld.legal_reviewer_id=actor AND ld.request_key=p_request_key;
 IF FOUND THEN
   IF prior.case_id<>p_case OR prior.document_review_id<>p_document_review OR
      prior.source_check_ids<>p_source_checks OR prior.decision<>p_decision OR
      prior.finding_reference<>p_reference
   THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_REPLAY_CONFLICT' USING ERRCODE='23505'; END IF;
   RETURN QUERY SELECT prior.disposition_id,prior.decision,true; RETURN;
 END IF;
 IF EXISTS (SELECT 1 FROM tto.ph12_tariff_board_legal_dispositions ld
    WHERE ld.case_id=p_case)
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEW_ALREADY_RECORDED' USING ERRCODE='23505';END IF;

 INSERT INTO tto.ph12_tariff_board_legal_dispositions AS ld
  (tenant_id,case_id,document_review_id,source_check_ids,legal_reviewer_id,
   decision,finding_reference,request_key)
 VALUES (tid,p_case,p_document_review,p_source_checks,actor,p_decision,
         p_reference,p_request_key)
 RETURNING ld.disposition_id,ld.decision INTO result_row;
 RETURN QUERY SELECT result_row.disposition_id,result_row.decision,false;
END $fn$;
REVOKE ALL ON FUNCTION tto.ph12_record_tariff_board_legal_disposition(
 uuid,uuid,uuid[],text,text,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_record_tariff_board_legal_disposition(
 uuid,uuid,uuid[],text,text,uuid) TO tto_app;
COMMENT ON TABLE tto.ph12_tariff_board_legal_dispositions IS
 'Independent legal-review HOLD or REJECT only, anchored to document review and source-check IDs. Cannot authorize tariff activation.';
COMMIT;
