-- PH10.1 — persistent PREVIEW cooperative onboarding dossiers, no legal activation.
-- Recording submitted claims does not verify legal registration, create a tenant,
-- grant COOPERATIVE_MANAGER or associate an unverified phone with a user.
CREATE TABLE tto.cooperative_onboarding_dossiers (
 dossier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_workspace_addresses(workspace_id),
 legal_name text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 8 AND 180),
 national_id text NOT NULL UNIQUE CHECK (national_id ~ '^[0-9]{11}$'),
 registration_number text NOT NULL CHECK (registration_number ~ '^[0-9]{1,20}$'),
 province text NOT NULL CHECK (length(btrim(province)) BETWEEN 2 AND 120),
 county text NOT NULL CHECK (length(btrim(county)) BETWEEN 2 AND 120),
 legal_address text NOT NULL CHECK (length(btrim(legal_address)) BETWEEN 8 AND 300),
 representative_name text NOT NULL CHECK (length(btrim(representative_name)) BETWEEN 3 AND 120),
 candidate_manager_name text NOT NULL CHECK (length(btrim(candidate_manager_name)) BETWEEN 3 AND 120),
 candidate_manager_mobile text NOT NULL CHECK (candidate_manager_mobile ~ '^09[0-9]{9}$'),
 evidence_reference text CHECK (evidence_reference IS NULL OR length(btrim(evidence_reference)) BETWEEN 5 AND 180),
 state text NOT NULL DEFAULT 'PENDING_LEGAL_REVIEW' CHECK (state='PENDING_LEGAL_REVIEW'),
 created_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (candidate_manager_name <> ''),
 CHECK (legal_name <> '')
);
CREATE TABLE tto.cooperative_onboarding_audit (
 audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dossier_id uuid NOT NULL REFERENCES tto.cooperative_onboarding_dossiers(dossier_id),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 action text NOT NULL CHECK (action='DOSSIER_SUBMITTED'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX cooperative_onboarding_dossiers_submitted_idx
 ON tto.cooperative_onboarding_dossiers(submitted_at DESC);
ALTER TABLE tto.cooperative_onboarding_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_dossiers FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_onboarding_dossiers FROM PUBLIC;
REVOKE ALL ON tto.cooperative_onboarding_audit FROM PUBLIC;
-- The app sets actor_id only from an already checked PostgreSQL session.
CREATE POLICY national_dossier_submit ON tto.cooperative_onboarding_dossiers
 FOR INSERT TO tto_app WITH CHECK (
  tto.has_national_root() AND created_by=tto.context_actor_id()
 );
CREATE POLICY national_dossier_review ON tto.cooperative_onboarding_dossiers
 FOR SELECT TO tto_app USING (tto.has_national_root());
CREATE POLICY national_dossier_audit_insert ON tto.cooperative_onboarding_audit
 FOR INSERT TO tto_app WITH CHECK (
   tto.has_national_root() AND actor_id=tto.context_actor_id()
 );
-- Immutable submitted records: no UPDATE/DELETE grants and no UPDATE/DELETE RLS policy.
GRANT SELECT,INSERT ON tto.cooperative_onboarding_dossiers TO tto_app;
GRANT INSERT ON tto.cooperative_onboarding_audit TO tto_app;
COMMENT ON TABLE tto.cooperative_onboarding_dossiers IS
 'Unverified cooperative application. NOT a legal approval, tenant provisioning, manager role, or shareholder onboarding.';
