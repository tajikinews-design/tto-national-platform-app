-- PH10.8: manager-only history and single-chain correction of self-reported Official Gazette citations.
-- This never performs legal-source verification, approval, signer activation or public disclosure.
-- Only new records are allowed: past self-reported declarations remain audit evidence.
CREATE UNIQUE INDEX ph10_manual_notice_single_successor
 ON tto.cooperative_manual_official_governance_claims(tenant_id,supersedes_claim_id)
 WHERE supersedes_claim_id IS NOT NULL;

CREATE OR REPLACE FUNCTION tto.deny_manual_official_governance_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,tto AS $f$
BEGIN
 RAISE EXCEPTION 'OFFICIAL_GAZETTE_SELF_REPORT_IMMUTABLE' USING ERRCODE='42501';
END $f$;
DROP TRIGGER IF EXISTS ph10_manual_notice_immutable ON tto.cooperative_manual_official_governance_claims;
CREATE TRIGGER ph10_manual_notice_immutable
 BEFORE UPDATE OR DELETE ON tto.cooperative_manual_official_governance_claims
 FOR EACH ROW EXECUTE FUNCTION tto.deny_manual_official_governance_mutation();

CREATE OR REPLACE FUNCTION tto.list_manual_official_governance_claims(
 p_tenant uuid,p_session_digest bytea
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid;v_session_actor uuid;v_items jsonb;v_has_more boolean;
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
    NOT EXISTS(SELECT 1 FROM tto.tenants
      WHERE tenant_id=p_tenant AND status='ACTIVE') THEN
  RAISE EXCEPTION 'AUTHORIZED_COOPERATIVE_MANAGER_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- Only the currently authorized cooperative manager may read this claim history;
 -- no broader shareholder or public visibility is granted.
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'claimId',q.claim_id,'personFullName',q.person_full_name,
   'officeType',q.office_type,'signingMode',q.signing_mode,
   'authorityScope',q.authority_scope,'gazetteIssueNumber',q.official_issue_number,
   'gazettePublicationDate',q.official_publication_date,
   'gazetteAnnouncementNumber',q.official_announcement_number,
   'effectiveFrom',q.effective_from,'effectiveUntil',q.effective_until,
   'officialReferenceUrl',q.official_reference_url,
   'supersedesClaimId',q.supersedes_claim_id,
   'status',q.verification_status,'createdAt',q.created_at,
   'hasCorrection',EXISTS(SELECT 1 FROM tto.cooperative_manual_official_governance_claims c
     WHERE c.supersedes_claim_id=q.claim_id AND c.tenant_id=p_tenant)
  ) ORDER BY q.created_at DESC,q.claim_id DESC),'[]'::jsonb)
 INTO v_items
 FROM (
  SELECT * FROM tto.cooperative_manual_official_governance_claims
  WHERE tenant_id=p_tenant
  ORDER BY created_at DESC,claim_id DESC LIMIT 100
 ) q;
 SELECT EXISTS(
  SELECT 1 FROM tto.cooperative_manual_official_governance_claims
  WHERE tenant_id=p_tenant
  OFFSET 100 LIMIT 1
 ) INTO v_has_more;
 RETURN jsonb_build_object(
  'items',v_items,'hasMore',v_has_more,'selfReportedOnly',true,
  'officiallyVerified',false,'legalApproval',false,'roleGranted',false
 );
END $f$;
REVOKE ALL ON FUNCTION tto.list_manual_official_governance_claims(uuid,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.list_manual_official_governance_claims(uuid,bytea) TO tto_app;
COMMENT ON FUNCTION tto.list_manual_official_governance_claims(uuid,bytea) IS
 'Manager-only first 100 self-reported official notices; no external authenticity assertion or authority promotion.';
