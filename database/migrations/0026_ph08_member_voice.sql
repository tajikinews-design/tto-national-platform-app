BEGIN;
CREATE TABLE tto.ph08_polls(
poll_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
title text NOT NULL,deadline timestamptz NOT NULL,
status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')),
min_aggregate_size integer NOT NULL DEFAULT 5 CHECK(min_aggregate_size>=2),
legal_vote boolean NOT NULL DEFAULT false CHECK(legal_vote=false));
CREATE TABLE tto.ph08_poll_audience(
poll_id uuid NOT NULL REFERENCES tto.ph08_polls(poll_id),
user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
PRIMARY KEY(poll_id,user_id));
CREATE TABLE tto.ph08_poll_answers(
answer_id uuid PRIMARY KEY,poll_id uuid NOT NULL REFERENCES tto.ph08_polls(poll_id),
user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
answer_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
UNIQUE(poll_id,user_id));
CREATE FUNCTION tto.ph08_submit_poll(p_id uuid,p_answer text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE p tto.ph08_polls%ROWTYPE;uid uuid:=tto.context_actor_id();
BEGIN
SELECT * INTO p FROM tto.ph08_polls WHERE poll_id=p_id FOR UPDATE;
IF NOT FOUND OR p.status<>'OPEN' OR p.deadline<=clock_timestamp()
OR p.tenant_id IS DISTINCT FROM tto.context_tenant_id()
OR uid IS NULL OR length(trim(coalesce(p_answer,'')))<1
OR NOT EXISTS(SELECT 1 FROM tto.ph08_poll_audience a WHERE a.poll_id=p_id AND a.user_id=uid)
THEN RETURN false; END IF;
INSERT INTO tto.ph08_poll_answers(answer_id,poll_id,user_id,answer_key)
VALUES(gen_random_uuid(),p_id,uid,p_answer)
ON CONFLICT(poll_id,user_id) DO NOTHING;
RETURN FOUND;
END $f$;
CREATE FUNCTION tto.ph08_poll_public_count(p_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT CASE WHEN p.tenant_id IS DISTINCT FROM tto.context_tenant_id() THEN NULL
WHEN (SELECT count(*) FROM tto.ph08_poll_answers a WHERE a.poll_id=p.poll_id)<p.min_aggregate_size
THEN NULL ELSE (SELECT count(*)::integer FROM tto.ph08_poll_answers a WHERE a.poll_id=p.poll_id) END
FROM tto.ph08_polls p WHERE p.poll_id=p_id;
$f$;
CREATE TABLE tto.ph08_proposals(
proposal_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
title text NOT NULL,status text NOT NULL DEFAULT 'SUBMITTED'
CHECK(status IN('SUBMITTED','ACCEPTED','REJECTED')),
legal_resolution boolean NOT NULL DEFAULT false CHECK(legal_resolution=false));
CREATE TABLE tto.ph08_proposal_handoffs(
handoff_id uuid PRIMARY KEY,proposal_id uuid NOT NULL UNIQUE REFERENCES tto.ph08_proposals(proposal_id),
target_domain text NOT NULL CHECK(target_domain IN('PROJECTS','GRC','ACTION')),
approved_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER ph08_answer_immutable BEFORE UPDATE OR DELETE ON tto.ph08_poll_answers
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE tb text;BEGIN
FOREACH tb IN ARRAY ARRAY['ph08_polls','ph08_poll_audience','ph08_poll_answers','ph08_proposals','ph08_proposal_handoffs']
LOOP
EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tb);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tb);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tb);
END LOOP;END $p$;
REVOKE ALL ON FUNCTION tto.ph08_submit_poll(uuid,text),tto.ph08_poll_public_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph08_submit_poll(uuid,text),tto.ph08_poll_public_count(uuid) TO tto_app;
COMMIT;