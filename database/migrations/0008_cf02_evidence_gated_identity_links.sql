-- CF02 evidence-gated identity-to-Party review; CI PG17 ONLY. No live migrations.
BEGIN;
CREATE TABLE tto.identity_link_policies(
 tenant_id uuid PRIMARY KEY REFERENCES tto.tenants(tenant_id),
 rule_evidence_id uuid NOT NULL, approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 expires_at timestamptz NOT NULL, enabled boolean NOT NULL DEFAULT false);
CREATE TABLE tto.identity_review_authorizations(
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 evidence_id uuid NOT NULL, valid_until timestamptz NOT NULL, revoked_at timestamptz,
 PRIMARY KEY(user_id,tenant_id),CHECK(user_id<>approved_by));
CREATE TABLE tto.identity_link_cases(
 case_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 request_evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 requested_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(),decided_at timestamptz,
 decided_by uuid REFERENCES tto.user_accounts(user_id),
 decision_evidence_id uuid REFERENCES tto.evidence_references(evidence_id),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0));
CREATE UNIQUE INDEX identity_link_single_pending ON tto.identity_link_cases(tenant_id,user_id,party_id) WHERE status='PENDING';
DO $x$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['identity_link_policies','identity_review_authorizations','identity_link_cases'] LOOP
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tbl);
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tbl);
 END LOOP;
END $x$;
CREATE FUNCTION tto.valid_identity_evidence(p_tenant uuid,p_evidence uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
 SELECT EXISTS(SELECT 1 FROM tto.evidence_references ev
 JOIN tto.documents d ON d.document_id=ev.document_id AND d.tenant_id=ev.tenant_id
 WHERE ev.evidence_id=p_evidence AND ev.tenant_id=p_tenant AND d.status='PUBLISHED') $x$;
CREATE FUNCTION tto.request_identity_link(p_tenant uuid,p_party uuid,p_evidence uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
 DECLARE actor uuid:=tto.context_actor_id(); rid uuid:=gen_random_uuid(); BEGIN
 IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM tto.parties WHERE party_id=p_party)
 OR NOT tto.valid_identity_evidence(p_tenant,p_evidence)
 OR (SELECT count(*) FROM tto.identity_link_cases WHERE user_id=actor AND status='PENDING')>=5
 OR EXISTS(SELECT 1 FROM tto.user_party_links WHERE user_id=actor AND party_id=p_party AND verified_at IS NOT NULL)
 THEN RETURN NULL; END IF;
 INSERT INTO tto.identity_link_cases(case_id,tenant_id,user_id,party_id,request_evidence_id,requested_by)
 VALUES(rid,p_tenant,actor,p_party,p_evidence) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM tto.append_actor_audit(p_tenant,'IDENTITY_LINK_REQUESTED',rid);
 RETURN rid;
 END $x$;
CREATE FUNCTION tto.decide_identity_link(p_tenant uuid,p_case uuid,p_evidence uuid,p_approve boolean,p_version bigint)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
 DECLARE actor uuid:=tto.context_actor_id(); rec tto.identity_link_cases%ROWTYPE; BEGIN
 IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR p_approve IS NULL OR p_version IS NULL OR p_version<1 THEN RETURN false; END IF;
 SELECT * INTO rec FROM tto.identity_link_cases WHERE case_id=p_case FOR UPDATE;
 IF NOT FOUND OR rec.tenant_id<>p_tenant OR rec.status<>'PENDING'
 OR rec.version<>p_version OR rec.requested_by=actor OR rec.user_id=actor
 OR p_evidence=rec.request_evidence_id
 OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
 OR NOT tto.valid_identity_evidence(p_tenant,p_evidence)
 OR NOT tto.has_platform_operator()
 OR NOT EXISTS(SELECT 1 FROM tto.identity_review_authorizations a WHERE a.user_id=actor
  AND a.tenant_id=p_tenant AND a.revoked_at IS NULL AND a.valid_until>now() AND a.approved_by<>actor)
 OR NOT EXISTS(SELECT 1 FROM tto.identity_link_policies p WHERE p.tenant_id=p_tenant
  AND p.enabled AND p.expires_at>now())
 THEN RETURN false; END IF;
 IF p_approve THEN
  INSERT INTO tto.user_party_links(user_id,party_id,verified_at) VALUES(rec.user_id,rec.party_id,clock_timestamp())
   ON CONFLICT(user_id,party_id) DO UPDATE SET verified_at=EXCLUDED.verified_at;
 END IF;
 UPDATE tto.identity_link_cases SET status=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
  decided_at=clock_timestamp(),decided_by=actor,decision_evidence_id=p_evidence,version=version+1
  WHERE case_id=p_case;
 PERFORM tto.append_actor_audit(p_tenant,'IDENTITY_LINK_REVIEWED',p_case);
 RETURN true;
 END $x$;
CREATE FUNCTION tto.my_identity_link_case_status(p_tenant uuid,p_case uuid) RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
 SELECT c.status FROM tto.identity_link_cases c
 WHERE c.case_id=p_case AND c.tenant_id=p_tenant
 AND c.user_id=tto.context_actor_id() AND p_tenant=tto.context_tenant_id() $x$;
REVOKE ALL ON FUNCTION tto.valid_identity_evidence(uuid,uuid),tto.request_identity_link(uuid,uuid,uuid),
 tto.decide_identity_link(uuid,uuid,uuid,boolean,bigint),tto.my_identity_link_case_status(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.request_identity_link(uuid,uuid,uuid),
 tto.decide_identity_link(uuid,uuid,uuid,boolean,bigint),tto.my_identity_link_case_status(uuid,uuid) TO tto_app;
COMMIT;
