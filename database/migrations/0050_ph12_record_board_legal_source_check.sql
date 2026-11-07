-- PH12: gated intake of official-source observations, never legal approval.
BEGIN;
CREATE FUNCTION tto.ph12_record_board_legal_source_check(
 p_case uuid,p_category text,p_reference text,p_version text,
 p_sha256_hex text,p_observed_at timestamptz,p_expires_at timestamptz,
 p_result text,p_request_key uuid)
RETURNS TABLE(check_id uuid,verification_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE
 tid uuid:=tto.context_tenant_id();
 actor uuid:=tto.context_actor_id();
 dossier record;
 prior record;
 inserted record;
 hash_bytes bytea;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_LEGAL_SOURCE_REVIEWER_DENIED' USING ERRCODE='42501'; END IF;
 IF p_case IS NULL OR p_request_key IS NULL OR
   p_category NOT IN ('BOARD_ROSTER','SIGNING_AUTHORITY','BYLAWS','MEETING_QUORUM','RESOLUTION_VALIDITY') OR
   p_reference IS NULL OR length(p_reference) NOT BETWEEN 8 AND 200 OR
   p_version IS NULL OR length(p_version) NOT BETWEEN 1 AND 100 OR
   p_sha256_hex IS NULL OR p_sha256_hex !~ '^[0-9a-fA-F]{64}$' OR
   p_observed_at IS NULL OR p_expires_at IS NULL OR
   p_observed_at>clock_timestamp() OR p_expires_at<=p_observed_at OR
   p_result NOT IN ('PENDING_OFFICIAL_VERIFICATION','SOURCE_REJECTED')
 THEN RAISE EXCEPTION 'PH12_LEGAL_SOURCE_INPUT_INVALID' USING ERRCODE='22023'; END IF;
 hash_bytes:=decode(p_sha256_hex,'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':legal-source:'||p_case::text,0));
 SELECT c.case_id,c.submitted_by,d.created_by AS draft_author
 INTO dossier FROM tto.ph12_tariff_board_evidence_cases c
 JOIN tto.ph12_tariff_drafts d ON d.draft_id=c.draft_id AND d.tenant_id=c.tenant_id
 WHERE c.tenant_id=tid AND c.case_id=p_case;
 IF NOT FOUND THEN RAISE EXCEPTION 'PH12_LEGAL_SOURCE_CASE_NOT_FOUND' USING ERRCODE='42501'; END IF;
 IF actor=dossier.submitted_by OR actor=dossier.draft_author THEN
  RAISE EXCEPTION 'PH12_LEGAL_SOURCE_INDEPENDENCE_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT x.* INTO prior FROM tto.ph12_tariff_board_legal_source_checks x
 WHERE x.tenant_id=tid AND x.checked_by=actor AND x.request_key=p_request_key;
 IF FOUND THEN
  IF prior.case_id<>p_case OR prior.source_category<>p_category OR
   prior.source_reference<>p_reference OR prior.source_version<>p_version OR
   prior.source_sha256<>hash_bytes OR prior.source_observed_at<>p_observed_at OR
   prior.source_expires_at<>p_expires_at OR prior.verified_result<>p_result
  THEN RAISE EXCEPTION 'PH12_LEGAL_SOURCE_REPLAY_CONFLICT' USING ERRCODE='23505'; END IF;
  RETURN QUERY SELECT prior.check_id,prior.verified_result,true;RETURN;
 END IF;
 INSERT INTO tto.ph12_tariff_board_legal_source_checks AS x
 (tenant_id,case_id,source_category,source_reference,source_version,
  source_sha256,checked_by,source_observed_at,source_expires_at,verified_result,request_key)
 VALUES (tid,p_case,p_category,p_reference,p_version,hash_bytes,actor,
  p_observed_at,p_expires_at,p_result,p_request_key)
 RETURNING x.check_id,x.verified_result INTO inserted;
 RETURN QUERY SELECT inserted.check_id,inserted.verified_result,false;
END $fn$;
REVOKE ALL ON FUNCTION tto.ph12_record_board_legal_source_check(
 uuid,text,text,text,text,timestamptz,timestamptz,text,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_record_board_legal_source_check(
 uuid,text,text,text,text,timestamptz,timestamptz,text,uuid) TO tto_app;
COMMIT;
