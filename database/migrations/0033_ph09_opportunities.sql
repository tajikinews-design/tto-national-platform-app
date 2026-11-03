BEGIN;
CREATE TABLE tto.ph09_opportunities(
opportunity_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
title text NOT NULL,deadline timestamptz NOT NULL,status text NOT NULL DEFAULT 'OPEN'
CHECK(status IN('OPEN','CLOSED')),handoff_kind text
CHECK(handoff_kind IN('PROCUREMENT','EVENTS','NONE')));
CREATE TABLE tto.ph09_applications(
application_id uuid PRIMARY KEY,opportunity_id uuid NOT NULL REFERENCES tto.ph09_opportunities(opportunity_id),
applicant_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','REVIEW','ACCEPTED','REJECTED')),
ai_score numeric CHECK(ai_score BETWEEN 0 AND 1),
UNIQUE(opportunity_id,applicant_id));
CREATE FUNCTION tto.ph09_apply(p_opportunity uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE o tto.ph09_opportunities%ROWTYPE;actor uuid:=tto.context_actor_id();
BEGIN
SELECT * INTO o FROM tto.ph09_opportunities WHERE opportunity_id=p_opportunity FOR UPDATE;
IF NOT FOUND OR o.tenant_id IS DISTINCT FROM tto.context_tenant_id()
OR o.status<>'OPEN' OR o.deadline<=clock_timestamp() OR actor IS NULL
THEN RETURN false;END IF;
INSERT INTO tto.ph09_applications(application_id,opportunity_id,applicant_id)
VALUES(gen_random_uuid(),p_opportunity,actor)
ON CONFLICT(opportunity_id,applicant_id) DO NOTHING;
RETURN FOUND;
END $f$;
CREATE TABLE tto.ph09_application_history(
history_id uuid PRIMARY KEY,application_id uuid NOT NULL REFERENCES tto.ph09_applications(application_id),
prior_status text,new_status text NOT NULL,changed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tto.ph09_opportunity_handoffs(
handoff_id uuid PRIMARY KEY,opportunity_id uuid NOT NULL REFERENCES tto.ph09_opportunities(opportunity_id),
destination text NOT NULL CHECK(destination IN('PROCUREMENT','EVENTS')),
source_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id));
CREATE TRIGGER ph09_application_history_immutable BEFORE UPDATE OR DELETE ON tto.ph09_application_history
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE tb text;BEGIN
FOREACH tb IN ARRAY ARRAY['ph09_opportunities','ph09_applications','ph09_application_history','ph09_opportunity_handoffs']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tb);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tb);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tb);END LOOP;END $p$;
REVOKE ALL ON FUNCTION tto.ph09_apply(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph09_apply(uuid) TO tto_app;
COMMIT;