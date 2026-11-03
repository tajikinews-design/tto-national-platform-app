-- PH07 CHILD09: content/recipient snapshot + distinct delivered/read/ack.
-- Source business record remains in its original domain.
BEGIN;
CREATE TABLE tto.ph07_publications(
 publication_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 kind text NOT NULL CHECK(kind IN('NEWS','LEGAL_NOTICE','MEMBER_NOTICE')),
 title text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 status text NOT NULL CHECK(status IN('DRAFT','PUBLISHED')),
 evidence_id uuid REFERENCES tto.evidence_references(evidence_id),
 created_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(publication_id,tenant_id),
 CHECK(status<>'PUBLISHED' OR evidence_id IS NOT NULL)
);
CREATE TABLE tto.ph07_notice_recipients (
 publication_id uuid NOT NULL REFERENCES tto.ph07_publications(publication_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 snapshot_version integer NOT NULL CHECK(snapshot_version>0),
 PRIMARY KEY(publication_id,user_id),
 FOREIGN KEY(publication_id,tenant_id) REFERENCES tto.ph07_publications(publication_id,tenant_id)
);
CREATE TABLE tto.ph07_notice_delivery (
 publication_id uuid NOT NULL,
 user_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('SMS','EMAIL','OFFICIAL_PUBLICATION','POSTAL')),
 provider_event_ref text NOT NULL,
 delivered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(publication_id,user_id,channel,provider_event_ref),
 FOREIGN KEY(publication_id,user_id)
 REFERENCES tto.ph07_notice_recipients(publication_id,user_id)
);
CREATE TABLE tto.ph07_notice_reads (
 publication_id uuid NOT NULL,user_id uuid NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(publication_id,user_id),
 FOREIGN KEY(publication_id,user_id)
 REFERENCES tto.ph07_notice_recipients(publication_id,user_id)
);
CREATE TABLE tto.ph07_notice_ack (
 publication_id uuid NOT NULL,user_id uuid NOT NULL,
 acknowledgement_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(publication_id,user_id),
 FOREIGN KEY(publication_id,user_id)
 REFERENCES tto.ph07_notice_recipients(publication_id,user_id)
);
CREATE FUNCTION tto.ph07_legal_notice_complete(p_publication uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT EXISTS(
 SELECT 1 FROM tto.ph07_publications p
 WHERE p.publication_id=p_publication AND p.status='PUBLISHED' AND p.kind='LEGAL_NOTICE'
 AND EXISTS(SELECT 1 FROM tto.ph07_notice_delivery d
 JOIN tto.ph07_notice_recipients r
 ON r.publication_id=d.publication_id AND r.user_id=d.user_id
 WHERE r.publication_id=p.publication_id AND r.tenant_id=p.tenant_id
 AND d.channel='OFFICIAL_PUBLICATION')
 AND EXISTS(SELECT 1 FROM tto.ph07_notice_ack a
 JOIN tto.ph07_notice_recipients r
 ON r.publication_id=a.publication_id AND r.user_id=a.user_id
 WHERE r.publication_id=p.publication_id AND r.tenant_id=p.tenant_id)
 );
$f$;
-- Public member feed never exposes another tenant's publications.
CREATE FUNCTION tto.ph07_my_publications()
RETURNS TABLE(publication_id uuid,title text,version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT p.publication_id,p.title,p.version FROM tto.ph07_publications p
 WHERE p.tenant_id=tto.context_tenant_id()
 AND p.status='PUBLISHED'
 AND tto.has_tenant_role(p.tenant_id,'MEMBER')
 ORDER BY p.created_at DESC;
$f$;
CREATE FUNCTION tto.ph07_my_notice_status(p_publication uuid)
RETURNS TABLE(delivered boolean,read boolean,acknowledged boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT EXISTS(SELECT 1 FROM tto.ph07_notice_delivery d
 WHERE d.publication_id=p_publication AND d.user_id=tto.context_actor_id()),
 EXISTS(SELECT 1 FROM tto.ph07_notice_reads r
 WHERE r.publication_id=p_publication AND r.user_id=tto.context_actor_id()),
 EXISTS(SELECT 1 FROM tto.ph07_notice_ack a
 WHERE a.publication_id=p_publication AND a.user_id=tto.context_actor_id())
 WHERE EXISTS (SELECT 1 FROM tto.ph07_notice_recipients r
 WHERE r.publication_id=p_publication AND r.user_id=tto.context_actor_id()
 AND r.tenant_id=tto.context_tenant_id())
 AND tto.has_tenant_role(tto.context_tenant_id(),'MEMBER');
$f$;
CREATE TRIGGER ph07_recipient_snapshot_immutable BEFORE UPDATE OR DELETE
 ON tto.ph07_notice_recipients FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph07_publication_history_immutable BEFORE DELETE
 ON tto.ph07_publications FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph07_delivery_immutable BEFORE UPDATE OR DELETE
 ON tto.ph07_notice_delivery FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph07_ack_immutable BEFORE UPDATE OR DELETE
 ON tto.ph07_notice_ack FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['ph07_publications','ph07_notice_recipients',
 'ph07_notice_delivery','ph07_notice_reads','ph07_notice_ack']
 LOOP
 EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);
 END LOOP;END $p$;
REVOKE ALL ON FUNCTION tto.ph07_my_publications(),
 tto.ph07_my_notice_status(uuid),tto.ph07_legal_notice_complete(uuid)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph07_my_publications(),
 tto.ph07_my_notice_status(uuid) TO tto_app;
REVOKE ALL ON FUNCTION tto.ph07_legal_notice_complete(uuid) FROM tto_app;
COMMIT;
