-- PH05 CF04: source-attributed immutable legal-rule candidates and fail-closed
-- as-of decision. No automatic legal interpretation or transaction approval.
-- Migration owner only; no tto_app grant for legal rule CRUD/evaluation.
BEGIN;
CREATE TABLE tto.ph05_legal_source_refs (
 source_id uuid PRIMARY KEY,
 citation text NOT NULL CHECK (length(trim(citation))>=12),
 authority_label text NOT NULL CHECK (length(trim(authority_label))>=3),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 verified_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.ph05_rule_versions (
 version_id uuid PRIMARY KEY,
 rule_code text NOT NULL CHECK (rule_code ~ '^[A-Z][A-Z0-9_]{3,79}$'),
 rule_version integer NOT NULL CHECK (rule_version>0),
 source_id uuid NOT NULL REFERENCES tto.ph05_legal_source_refs(source_id),
 effective_from timestamptz NOT NULL,
 -- The restricted core never determines an ALLOW / legal entitlement.
 candidate_disposition text NOT NULL CHECK (candidate_disposition IN ('BLOCK','REVIEW_REQUIRED')),
 status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE')),
 created_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_by uuid REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status<>'ACTIVE' OR (approved_by IS NOT NULL AND approved_by<>created_by)),
 UNIQUE (rule_code,rule_version),
 UNIQUE (rule_code,effective_from)
);
CREATE TABLE tto.ph05_legal_gates (
 gate_code text PRIMARY KEY CHECK (gate_code ~ '^[A-Z][A-Z0-9_]{3,79}$'),
 gate_status text NOT NULL CHECK (gate_status IN ('OPEN','RESOLVED','BLOCKED')),
 evidence_id uuid REFERENCES tto.evidence_references(evidence_id),
 CHECK (gate_status <> 'RESOLVED' OR evidence_id IS NOT NULL)
);
CREATE TABLE tto.ph05_rule_snapshots (
 snapshot_id uuid PRIMARY KEY,
 source_version_id uuid NOT NULL REFERENCES tto.ph05_rule_versions(version_id),
 evaluated_as_of timestamptz NOT NULL,
 recorded_disposition text NOT NULL CHECK (recorded_disposition IN ('BLOCKED','REVIEW_ONLY')),
 created_at timestamptz NOT NULL DEFAULT now(),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id)
);
DO $t$
 DECLARE t text;
 BEGIN
 FOREACH t IN ARRAY ARRAY['ph05_legal_source_refs','ph05_rule_versions','ph05_legal_gates','ph05_rule_snapshots']
 LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);
 END LOOP;
 END $t$;
CREATE TRIGGER ph05_rule_versions_immutable BEFORE UPDATE OR DELETE
 ON tto.ph05_rule_versions FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph05_rule_sources_immutable BEFORE UPDATE OR DELETE
 ON tto.ph05_legal_source_refs FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph05_rule_snapshots_immutable BEFORE UPDATE OR DELETE
 ON tto.ph05_rule_snapshots FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();

CREATE FUNCTION tto.ph05_rule_candidate_asof(p_rule_code text,p_as_of timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
DECLARE r record;
BEGIN
 IF p_rule_code IS NULL OR p_as_of IS NULL OR
   EXISTS (SELECT 1 FROM tto.ph05_legal_gates g
    WHERE g.gate_code=p_rule_code AND g.gate_status IN('OPEN','BLOCKED'))
 THEN RETURN 'BLOCKED';END IF;
 SELECT v.status,v.candidate_disposition,s.source_id INTO r
  FROM tto.ph05_rule_versions v
  JOIN tto.ph05_legal_source_refs s ON s.source_id=v.source_id
  WHERE v.rule_code=p_rule_code AND v.effective_from<=p_as_of
  ORDER BY v.effective_from DESC,v.rule_version DESC LIMIT 1;
 IF NOT FOUND THEN RETURN 'BLOCKED';END IF;
 IF r.status<>'ACTIVE' OR r.source_id IS NULL
 THEN RETURN 'BLOCKED';END IF;
 IF r.candidate_disposition='BLOCK' THEN RETURN 'BLOCKED';END IF;
 -- Even an active, source-linked rule only reaches human/legal review.
 RETURN 'REVIEW_ONLY';
END $f$;
REVOKE ALL ON FUNCTION tto.ph05_rule_candidate_asof(text,timestamptz)
 FROM PUBLIC,tto_app;
COMMIT;
