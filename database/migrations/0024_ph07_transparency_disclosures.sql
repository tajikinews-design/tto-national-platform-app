-- PH07 CHILD11: source-backed disclosure, NOT general accounting.
BEGIN;
CREATE TABLE tto.ph07_disclosure_packages (
 package_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 subject_code text NOT NULL CHECK(length(trim(subject_code))>=4),
 classification text NOT NULL CHECK(classification IN('MEMBER','PUBLIC','INTERNAL')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(package_id,tenant_id),
 UNIQUE(tenant_id,subject_code)
);
CREATE TABLE tto.ph07_disclosure_versions (
 version_id uuid PRIMARY KEY,
 package_id uuid NOT NULL REFERENCES tto.ph07_disclosure_packages(package_id),
 version_num integer NOT NULL CHECK(version_num>0),
 period_start date NOT NULL,
 period_end date NOT NULL,
 source_evidence uuid REFERENCES tto.evidence_references(evidence_id),
 report_kind text NOT NULL CHECK(report_kind IN(
 'STATUTORY','FINANCIAL_DISCLOSURE','DIVIDEND_DISCLOSURE')),
 status text NOT NULL CHECK(status IN('DRAFT','PUBLISHED')),
 dividend_state text CHECK(dividend_state IN('PROPOSED','APPROVED','PAID')),
 figure_value numeric,
 created_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_by uuid REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(package_id,version_num),
 CHECK(period_end>=period_start),
 CHECK(status<>'PUBLISHED' OR
   (source_evidence IS NOT NULL AND approved_by IS NOT NULL
   AND approved_by<>created_by)),
 CHECK(report_kind='DIVIDEND_DISCLOSURE' OR dividend_state IS NULL)
);
CREATE FUNCTION tto.ph07_dividend_display(p_version uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT CASE
 WHEN d.report_kind<>'DIVIDEND_DISCLOSURE' THEN 'NOT_APPLICABLE'
 WHEN d.dividend_state='PAID' AND d.status='PUBLISHED'
 THEN 'PAID_WITH_SOURCE'
 WHEN d.dividend_state='APPROVED' AND d.status='PUBLISHED'
 THEN 'APPROVED_NOT_PAID'
 ELSE 'PROPOSED_NOT_PAID'
 END FROM tto.ph07_disclosure_versions d WHERE d.version_id=p_version;
$f$;
-- Member/public projection only, never accounting and never an unrestricted export.
CREATE FUNCTION tto.ph07_my_disclosures()
 RETURNS TABLE(package_id uuid,version_num integer,report_kind text,dividend_state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT p.package_id,v.version_num,v.report_kind,v.dividend_state
 FROM tto.ph07_disclosure_packages p
 JOIN tto.ph07_disclosure_versions v ON v.package_id=p.package_id
 WHERE p.tenant_id=tto.context_tenant_id() AND v.status='PUBLISHED'
 AND (p.classification='PUBLIC' OR
      (p.classification='MEMBER' AND tto.has_tenant_role(p.tenant_id,'MEMBER'))
      OR (p.classification='INTERNAL' AND tto.has_tenant_role(p.tenant_id,'COOPERATIVE_MANAGER')))
 AND EXISTS (SELECT 1 FROM tto.tenants t WHERE t.tenant_id=p.tenant_id AND t.status='ACTIVE');
$f$;
CREATE TRIGGER ph07_disclosure_version_immutable BEFORE UPDATE OR DELETE
 ON tto.ph07_disclosure_versions FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph07_disclosure_package_immutable BEFORE DELETE
 ON tto.ph07_disclosure_packages FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['ph07_disclosure_packages','ph07_disclosure_versions']
 LOOP
 EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);
 END LOOP;END $p$;
REVOKE ALL ON FUNCTION tto.ph07_dividend_display(uuid),tto.ph07_my_disclosures()
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph07_my_disclosures() TO tto_app;
COMMIT;
