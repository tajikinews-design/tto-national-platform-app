-- PH10 synthetic PH08 source-bound read-only G2 scope; no activation, award or payment.
BEGIN;
CREATE FUNCTION tto.ph10_manager_branch_authority_state(p_branch uuid)
RETURNS TABLE(outside_county boolean,independent_activity_approved boolean,authority_evidence_present boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT b.county_code<>p.county_code,b.independent_activity_approved,
        b.authority_evidence IS NOT NULL
 FROM tto.ph08_branches b JOIN tto.ph08_projects p ON p.project_id=b.project_id
 WHERE b.branch_id=p_branch AND p.tenant_id=tto.context_tenant_id()
   AND tto.has_tenant_role(p.tenant_id,'COOPERATIVE_MANAGER')
$fn$;
CREATE FUNCTION tto.ph10_manager_proposal_handoff_state(p_proposal uuid)
RETURNS TABLE(proposal_status text,handoff_exists boolean,target_domain text,legal_resolution boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT p.status,h.handoff_id IS NOT NULL,h.target_domain,p.legal_resolution
 FROM tto.ph08_proposals p
 LEFT JOIN tto.ph08_proposal_handoffs h ON h.proposal_id=p.proposal_id
 WHERE p.proposal_id=p_proposal AND p.tenant_id=tto.context_tenant_id()
   AND tto.has_tenant_role(p.tenant_id,'COOPERATIVE_MANAGER')
$fn$;
CREATE FUNCTION tto.ph10_manager_limited_benefit_policy(p_benefit uuid)
RETURNS TABLE(limited boolean,policy_present boolean,may_activate boolean,current_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT b.limited,length(coalesce(b.allocation_policy_ref,''))>8,
        (NOT b.limited OR length(coalesce(b.allocation_policy_ref,''))>8),b.status
 FROM tto.ph08_benefits b
 WHERE b.benefit_id=p_benefit AND b.tenant_id=tto.context_tenant_id()
   AND tto.has_tenant_role(b.tenant_id,'COOPERATIVE_MANAGER')
$fn$;
REVOKE ALL ON FUNCTION tto.ph10_manager_branch_authority_state(uuid),
 tto.ph10_manager_proposal_handoff_state(uuid),tto.ph10_manager_limited_benefit_policy(uuid)
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph10_manager_branch_authority_state(uuid),
 tto.ph10_manager_proposal_handoff_state(uuid),tto.ph10_manager_limited_benefit_policy(uuid)
 TO tto_app;
COMMIT;
