-- PH10: synthetic-only national cooperative intake. Never creates an ACTIVE tenant.
-- This migration is intended for disposable PostgreSQL 17 only.
CREATE TABLE IF NOT EXISTS tto.national_cooperative_intake (
 intake_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 national_id varchar(11) NOT NULL UNIQUE CHECK (national_id ~ '^[0-9]{11}$'),
 registration_number varchar(20) NOT NULL CHECK (registration_number ~ '^[0-9]{1,20}$'),
 legal_name varchar(180) NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 8 AND 180),
 province varchar(120) NOT NULL,
 county varchar(120) NOT NULL,
 legal_address varchar(300) NOT NULL,
 representative varchar(120) NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 state text NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (state = 'PENDING_VERIFICATION')
);
CREATE TABLE IF NOT EXISTS tto.national_cooperative_intake_audit (
 audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 intake_id uuid NOT NULL REFERENCES tto.national_cooperative_intake(intake_id),
 actor_id uuid NOT NULL,
 event_type text NOT NULL CHECK (event_type = 'INTAKE_CREATED'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE tto.national_cooperative_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.national_cooperative_intake FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.national_cooperative_intake_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.national_cooperative_intake_audit FORCE ROW LEVEL SECURITY;
-- No generic SELECT/UPDATE/DELETE policies. Only authenticated national operators
-- can insert through a transactional SQL function with explicit role evidence.
CREATE POLICY national_intake_insert ON tto.national_cooperative_intake FOR INSERT TO tto_app
WITH CHECK (
 created_by = nullif(current_setting('tto.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM tto.list_actor_tenant_options() options
            WHERE options."platformOperator" IS TRUE)
);
CREATE POLICY national_intake_audit_insert ON tto.national_cooperative_intake_audit FOR INSERT TO tto_app
WITH CHECK (
 actor_id = nullif(current_setting('tto.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM tto.list_actor_tenant_options() options
            WHERE options."platformOperator" IS TRUE)
);
-- Audit should not be writable without matching intake in one transaction.
GRANT INSERT ON tto.national_cooperative_intake TO tto_app;
GRANT INSERT ON tto.national_cooperative_intake_audit TO tto_app;
