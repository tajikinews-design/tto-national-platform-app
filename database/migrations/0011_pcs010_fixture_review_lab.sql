-- PCS-010: NON-AUTHORITATIVE fixture review audit for disposable CI databases.
-- No privilege to promote official membership, update the share register, or transfer shares.
BEGIN;
CREATE TABLE tto.pcs010_fixture_reviews(
 review_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 event_kind text NOT NULL CHECK(event_kind='FICTIONAL_REVIEW_APPROVED'),
 fixture_ref text NOT NULL CHECK(fixture_ref LIKE 'PCS010-FAKE-%'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 is_official boolean NOT NULL DEFAULT false CHECK(is_official=false),
 UNIQUE(tenant_id,fixture_ref)
);
ALTER TABLE tto.pcs010_fixture_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.pcs010_fixture_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.pcs010_fixture_reviews FROM PUBLIC,tto_app;
CREATE TRIGGER pcs010_fixture_immutable BEFORE UPDATE OR DELETE ON tto.pcs010_fixture_reviews
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE FUNCTION tto.pcs010_record_fixture_review(p_tenant uuid,p_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
BEGIN
 IF current_setting('tto.pcs010_lab',true) IS DISTINCT FROM '1'
    OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
    OR tto.context_actor_id() IS NULL
    OR NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
    OR p_ref NOT LIKE 'PCS010-FAKE-%' OR length(p_ref)>100 THEN RETURN false; END IF;
 INSERT INTO tto.pcs010_fixture_reviews(review_id,tenant_id,actor_id,event_kind,fixture_ref)
 VALUES(gen_random_uuid(),p_tenant,tto.context_actor_id(),'FICTIONAL_REVIEW_APPROVED',p_ref)
 ON CONFLICT (tenant_id,fixture_ref) DO NOTHING;
 RETURN FOUND;
END $f$;
REVOKE ALL ON FUNCTION tto.pcs010_record_fixture_review(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.pcs010_record_fixture_review(uuid,text) TO tto_app;
CREATE FUNCTION tto.pcs010_fixture_review_count(p_tenant uuid) RETURNS bigint
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT count(*) FROM tto.pcs010_fixture_reviews
 WHERE tenant_id=p_tenant
 AND current_setting('tto.pcs010_lab',true)='1'
 AND p_tenant=tto.context_tenant_id()
 AND tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
 $f$;
REVOKE ALL ON FUNCTION tto.pcs010_fixture_review_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.pcs010_fixture_review_count(uuid) TO tto_app;
CREATE FUNCTION tto.pcs012_fixture_review_history(p_tenant uuid)
RETURNS TABLE(id uuid,fixture_ref text,event_kind text,recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT r.review_id,r.fixture_ref,r.event_kind,r.recorded_at
 FROM tto.pcs010_fixture_reviews r
 WHERE current_setting('tto.pcs010_lab',true)='1'
 AND p_tenant=tto.context_tenant_id()
 AND tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
 AND r.tenant_id=p_tenant
 ORDER BY r.recorded_at DESC,r.review_id DESC LIMIT 30
$f$;
REVOKE ALL ON FUNCTION tto.pcs012_fixture_review_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.pcs012_fixture_review_history(uuid) TO tto_app;
COMMENT ON TABLE tto.pcs010_fixture_reviews IS 'Non-authoritative disposable CI lab evidence. Never membership or share ownership.';
COMMIT;
