-- CHILD06 manager-only catalog to select archived notices for source-declared
-- corrections/revocations. Historical evidence remains immutable and unverified.
BEGIN;
CREATE FUNCTION tto.cooperative_notice_transition_catalog()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 n_count integer;t_count integer;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_CATALOG_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 SELECT count(*) INTO n_count FROM tto.cooperative_legal_notice_archive WHERE tenant_id=tid;
 SELECT count(*) INTO t_count FROM tto.cooperative_notice_transitions WHERE tenant_id=tid;
 IF n_count>200 OR t_count>500
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_CATALOG_LIMIT' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('tenantId',tid,'sourceAuthenticated',false,
  'legalSigningPowerGranted',false,'tariffActivated',false,
  'notices',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'noticeId',n.notice_id,'sourceType',n.source_type,'noticeKind',n.notice_kind,
    'sourceNoticeNumber',n.source_notice_number,'resolutionOn',n.resolution_on_jalali,
    'publishedOn',n.published_on_jalali,'provenance',n.provenance_status)
     ORDER BY n.resolution_on_jalali,n.submitted_at,n.notice_id)
     FROM tto.cooperative_legal_notice_archive n WHERE n.tenant_id=tid),'[]'::jsonb),
  'transitions',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'transitionId',t.transition_id,'targetNoticeId',t.target_notice_id,
    'replacementNoticeId',t.replacement_notice_id,'action',t.action,
    'effectiveOn',t.claimed_effective_on,'publishedOn',t.published_on,
    'sourceReference',t.source_reference,'sourceStatus',t.source_status)
     ORDER BY t.recorded_at,t.transition_id)
     FROM tto.cooperative_notice_transitions t WHERE t.tenant_id=tid),'[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_notice_transition_catalog()
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_notice_transition_catalog() TO tto_app;
COMMIT;
