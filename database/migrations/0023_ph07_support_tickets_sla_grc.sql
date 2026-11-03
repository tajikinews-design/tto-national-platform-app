-- PH07 CHILD10: tickets, restricted internal notes, SLA, GRC handoff.
BEGIN;
CREATE TABLE tto.ph07_support_tickets(
 ticket_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 requester_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 issue_key text NOT NULL CHECK(length(trim(issue_key))>3),
 linked_source_ref text,
 status text NOT NULL DEFAULT 'OPEN'
 CHECK(status IN('OPEN','WAITING','RESOLVED','CLOSED')),
 material boolean NOT NULL DEFAULT false,
 resolution_evidence uuid REFERENCES tto.evidence_references(evidence_id),
 resolved_by uuid REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 UNIQUE(ticket_id,tenant_id),
 CHECK(status NOT IN('RESOLVED','CLOSED') OR
 (resolution_evidence IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE TABLE tto.ph07_support_notes(
 note_id uuid PRIMARY KEY,
 ticket_id uuid NOT NULL REFERENCES tto.ph07_support_tickets(ticket_id),
 author_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 visibility text NOT NULL CHECK(visibility IN('REQUESTER','INTERNAL')),
 body text NOT NULL,
 written_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.ph07_support_sla_pauses(
 pause_id uuid PRIMARY KEY,
 ticket_id uuid NOT NULL REFERENCES tto.ph07_support_tickets(ticket_id),
 start_at timestamptz NOT NULL,
 end_at timestamptz,
 CHECK(end_at IS NULL OR end_at>=start_at)
);
CREATE TABLE tto.ph07_support_grc_handoffs (
 handoff_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 issue_key text NOT NULL,
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 status text NOT NULL DEFAULT 'GRC_REVIEW_REQUIRED',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,issue_key)
);
-- SLA computation excludes all actually bounded pause periods.
CREATE FUNCTION tto.ph07_sla_minutes(p_ticket uuid,p_as_of timestamptz) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT CASE WHEN p_as_of IS NULL THEN NULL
 ELSE greatest(0, floor(EXTRACT(EPOCH FROM (p_as_of - t.created_at))/60)::bigint
 - coalesce((SELECT sum(floor(EXTRACT(EPOCH FROM
 (least(coalesce(s.end_at,p_as_of),p_as_of)-greatest(s.start_at,t.created_at)))/60)::bigint)
 FROM tto.ph07_support_sla_pauses s
 WHERE s.ticket_id=t.ticket_id AND s.start_at<p_as_of
 AND coalesce(s.end_at,p_as_of)>t.created_at),0)) END
 FROM tto.ph07_support_tickets t WHERE t.ticket_id=p_ticket;
$f$;
CREATE FUNCTION tto.ph07_can_view_sensitive_source(p_ticket uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT EXISTS(SELECT 1 FROM tto.ph07_support_tickets t
 WHERE t.ticket_id=p_ticket AND t.tenant_id=tto.context_tenant_id()
 AND tto.has_tenant_role(t.tenant_id,'COOPERATIVE_MANAGER')
 AND tto.has_jit_access(t.tenant_id));
$f$;
CREATE FUNCTION tto.ph07_my_support_tickets()
RETURNS TABLE(ticket_id uuid,status text,issue_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT t.ticket_id,t.status,t.issue_key FROM tto.ph07_support_tickets t
 WHERE t.tenant_id=tto.context_tenant_id()
 AND t.requester_id=tto.context_actor_id()
 AND EXISTS(SELECT 1 FROM tto.tenants a WHERE a.tenant_id=t.tenant_id AND a.status='ACTIVE')
 ORDER BY t.created_at DESC;
$f$;
CREATE FUNCTION tto.ph07_my_ticket_notes(p_ticket uuid)
RETURNS TABLE(note_id uuid,body text) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
 SELECT n.note_id,n.body FROM tto.ph07_support_notes n
 JOIN tto.ph07_support_tickets t ON t.ticket_id=n.ticket_id
 WHERE t.ticket_id=p_ticket AND t.tenant_id=tto.context_tenant_id()
 AND t.requester_id=tto.context_actor_id() AND n.visibility='REQUESTER'
 ORDER BY n.written_at;
$f$;
CREATE FUNCTION tto.ph07_resolve_ticket(p_ticket uuid,p_evidence uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
DECLARE t tto.ph07_support_tickets%ROWTYPE;
BEGIN
 SELECT * INTO t FROM tto.ph07_support_tickets WHERE ticket_id=p_ticket FOR UPDATE;
 IF NOT FOUND OR t.status NOT IN('OPEN','WAITING') OR
 t.tenant_id IS DISTINCT FROM tto.context_tenant_id() OR
 NOT tto.has_tenant_role(t.tenant_id,'COOPERATIVE_MANAGER') OR
 NOT EXISTS(SELECT 1 FROM tto.evidence_references e
 WHERE e.evidence_id=p_evidence AND e.tenant_id=t.tenant_id)
 THEN RETURN false; END IF;
 UPDATE tto.ph07_support_tickets SET status='RESOLVED',
 resolution_evidence=p_evidence,resolved_by=tto.context_actor_id(),
 resolved_at=now() WHERE ticket_id=p_ticket;
 PERFORM tto.append_actor_audit(t.tenant_id,'SUPPORT_TICKET_RESOLVED',p_ticket);
 RETURN true;
END $f$;
CREATE FUNCTION tto.ph07_escalate_repeated_material(
 p_tenant uuid,p_issue text,p_evidence uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
BEGIN
 IF p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e
 WHERE e.evidence_id=p_evidence AND e.tenant_id=p_tenant)
 OR (SELECT count(*) FROM tto.ph07_support_tickets t
 WHERE t.tenant_id=p_tenant AND t.issue_key=p_issue AND t.material)<2
 THEN RETURN false;END IF;
 INSERT INTO tto.ph07_support_grc_handoffs(handoff_id,tenant_id,issue_key,evidence_id)
 VALUES(gen_random_uuid(),p_tenant,p_issue,p_evidence)
 ON CONFLICT(tenant_id,issue_key) DO NOTHING;
 RETURN true;
END $f$;
CREATE TRIGGER ph07_notes_immutable BEFORE UPDATE OR DELETE
ON tto.ph07_support_notes FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph07_grc_handoff_immutable BEFORE UPDATE OR DELETE
ON tto.ph07_support_grc_handoffs FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['ph07_support_tickets','ph07_support_notes',
 'ph07_support_sla_pauses','ph07_support_grc_handoffs']
 LOOP
 EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);
 END LOOP;END $p$;
REVOKE ALL ON FUNCTION tto.ph07_sla_minutes(uuid,timestamptz),
 tto.ph07_can_view_sensitive_source(uuid),
 tto.ph07_my_support_tickets(),tto.ph07_my_ticket_notes(uuid),
 tto.ph07_resolve_ticket(uuid,uuid),
 tto.ph07_escalate_repeated_material(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph07_can_view_sensitive_source(uuid),
 tto.ph07_my_support_tickets(),tto.ph07_my_ticket_notes(uuid),
 tto.ph07_resolve_ticket(uuid,uuid),
 tto.ph07_escalate_repeated_material(uuid,text,uuid) TO tto_app;
COMMIT;
