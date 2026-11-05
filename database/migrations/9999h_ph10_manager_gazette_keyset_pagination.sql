-- PH10.9 secure keyset pagination. Revalidates the manager session on every page.
CREATE FUNCTION tto.list_manual_official_governance_claims_page(
 p_tenant uuid,p_session_digest bytea,p_before_created timestamptz DEFAULT NULL,
 p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid;v_session_actor uuid;v_items jsonb;v_more boolean;
 v_count integer;
BEGIN
 v_actor:=tto.context_actor_id();
 IF p_session_digest IS NULL OR octet_length(p_session_digest)<>32 THEN
  RAISE EXCEPTION 'VERIFIED_MANAGER_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT user_id INTO v_session_actor FROM tto.resolve_session(p_session_digest);
 IF v_actor IS NULL OR v_actor IS DISTINCT FROM v_session_actor OR
  p_tenant IS DISTINCT FROM tto.context_tenant_id() OR
  NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER') OR
  NOT tto.has_verified_authority(p_tenant,'ROLE_MANAGEMENT') OR
  NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
 THEN RAISE EXCEPTION 'AUTHORIZED_COOPERATIVE_MANAGER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_limit NOT BETWEEN 1 AND 100 OR
  (p_before_created IS NULL) <> (p_before_id IS NULL) THEN
  RAISE EXCEPTION 'INVALID_GAZETTE_PAGE_CURSOR' USING ERRCODE='22023';
 END IF;
 WITH page AS MATERIALIZED (
  SELECT c.* FROM tto.cooperative_manual_official_governance_claims c
  WHERE c.tenant_id=p_tenant AND
   (p_before_created IS NULL OR (c.created_at,c.claim_id)<(p_before_created,p_before_id))
  ORDER BY c.created_at DESC,c.claim_id DESC LIMIT p_limit+1
 ), numbered AS (
  SELECT *,row_number() OVER (ORDER BY created_at DESC,claim_id DESC) AS position FROM page
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'claimId',claim_id,'personFullName',person_full_name,
  'officeType',office_type,'signingMode',signing_mode,'authorityScope',authority_scope,
  'gazetteIssueNumber',official_issue_number,'gazettePublicationDate',official_publication_date,
  'gazetteAnnouncementNumber',official_announcement_number,
  'effectiveFrom',effective_from,'effectiveUntil',effective_until,
  'officialReferenceUrl',official_reference_url,'supersedesClaimId',supersedes_claim_id,
  'status',verification_status,'createdAt',created_at,
  'hasCorrection',EXISTS(SELECT 1 FROM tto.cooperative_manual_official_governance_claims s
    WHERE s.tenant_id=p_tenant AND s.supersedes_claim_id=numbered.claim_id))
  ORDER BY created_at DESC,claim_id DESC),'[]'::jsonb),count(*)
 INTO v_items,v_count FROM numbered WHERE position<=p_limit;
 SELECT EXISTS (
  SELECT 1 FROM tto.cooperative_manual_official_governance_claims c
   WHERE c.tenant_id=p_tenant AND
    (p_before_created IS NULL OR (c.created_at,c.claim_id)<(p_before_created,p_before_id))
   ORDER BY c.created_at DESC,c.claim_id DESC OFFSET p_limit LIMIT 1
 ) INTO v_more;
 RETURN jsonb_build_object('items',v_items,'hasMore',v_more,
  'selfReportedOnly',true,'officiallyVerified',false,'legalApproval',false,'roleGranted',false);
END $f$;
REVOKE ALL ON FUNCTION tto.list_manual_official_governance_claims_page(uuid,bytea,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.list_manual_official_governance_claims_page(uuid,bytea,timestamptz,uuid,integer) TO tto_app;
CREATE INDEX ph10_9_manual_gazette_keyset_idx ON
 tto.cooperative_manual_official_governance_claims(tenant_id,created_at DESC,claim_id DESC);
