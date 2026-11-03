-- PH07 CHILD08 governance/assemblies. Synthetic CI only; no legal e-voting.
BEGIN;
CREATE TABLE tto.ph07_assemblies (
 assembly_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 title text NOT NULL,
 eligible_member_count integer NOT NULL CHECK (eligible_member_count>=0),
 official_voting_system_ref text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assembly_id,tenant_id)
);
CREATE FUNCTION tto.ph07_assembly_mode(p_members integer) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,tto
AS $f$ SELECT CASE WHEN p_members IS NULL OR p_members<0 THEN 'BLOCKED'
 WHEN p_members>500 THEN 'TWO_STAGE' ELSE 'ONE_STAGE' END $f$;
CREATE TABLE tto.ph07_proxy_grants (
 grant_id uuid PRIMARY KEY,assembly_id uuid NOT NULL REFERENCES tto.ph07_assemblies(assembly_id),
 representative_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 represented_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(representative_party_id<>represented_party_id),
 UNIQUE(assembly_id,represented_party_id)
);
CREATE FUNCTION tto.ph07_proxy_limit_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
DECLARE active_count integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(
 NEW.assembly_id::text||':'||NEW.representative_party_id::text,0));
 SELECT count(*) INTO active_count FROM tto.ph07_proxy_grants g
 WHERE g.assembly_id=NEW.assembly_id AND g.representative_party_id=NEW.representative_party_id;
 IF active_count>=3 THEN RAISE EXCEPTION 'PH07_MAX_THREE_PROXY_REACHED'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER ph07_proxy_insert_guard BEFORE INSERT ON tto.ph07_proxy_grants
FOR EACH ROW EXECUTE FUNCTION tto.ph07_proxy_limit_guard();
CREATE TABLE tto.ph07_chamber_letters (
 letter_id uuid PRIMARY KEY,assembly_id uuid NOT NULL REFERENCES tto.ph07_assemblies(assembly_id),
 official_reference text NOT NULL CHECK(length(trim(official_reference))>8),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 source_verified boolean NOT NULL DEFAULT false,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assembly_id,official_reference)
);
CREATE TABLE tto.ph07_chamber_candidate_list (
 letter_id uuid NOT NULL REFERENCES tto.ph07_chamber_letters(letter_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 PRIMARY KEY(letter_id,party_id)
);
CREATE TABLE tto.ph07_candidacies (
 candidacy_id uuid PRIMARY KEY,assembly_id uuid NOT NULL REFERENCES tto.ph07_assemblies(assembly_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 UNIQUE(assembly_id,party_id)
);
CREATE FUNCTION tto.ph07_candidate_status(p_candidacy uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM tto.ph07_candidacies c
 JOIN tto.ph07_chamber_candidate_list lc ON lc.party_id=c.party_id
 JOIN tto.ph07_chamber_letters l ON l.letter_id=lc.letter_id
 AND l.assembly_id=c.assembly_id AND l.source_verified=true
 WHERE c.candidacy_id=p_candidacy) THEN 'APPROVED'
 ELSE 'PENDING_EXTERNAL_REVIEW' END
$f$;
-- Hosting legal votes is explicitly forbidden; handoff only.
CREATE FUNCTION tto.ph07_legal_online_vote_route(p_assembly uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT CASE WHEN EXISTS (SELECT 1 FROM tto.ph07_assemblies a
  WHERE a.assembly_id=p_assembly AND nullif(trim(a.official_voting_system_ref),'') IS NOT NULL)
 THEN 'OFFICIAL_SYSTEM_HANDOFF' ELSE 'OFFICIAL_SYSTEM_REQUIRED' END
$f$;
CREATE TRIGGER ph07_chamber_candidate_immutable BEFORE UPDATE OR DELETE
 ON tto.ph07_chamber_candidate_list FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['ph07_assemblies','ph07_proxy_grants',
 'ph07_chamber_letters','ph07_chamber_candidate_list','ph07_candidacies']
 LOOP
 EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);
 END LOOP;
END $p$;
REVOKE ALL ON FUNCTION tto.ph07_legal_online_vote_route(uuid),
 tto.ph07_candidate_status(uuid),tto.ph07_assembly_mode(integer) FROM PUBLIC,tto_app;
COMMIT;
