-- National cooperative workspace URL reservations (not company registration).
CREATE TABLE IF NOT EXISTS tto.cooperative_workspace_addresses (
 workspace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 state text NOT NULL DEFAULT 'RESERVED',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT valid_workspace_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
 CONSTRAINT workspace_only_reserved CHECK (state = 'RESERVED')
);
ALTER TABLE tto.cooperative_workspace_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_workspace_addresses FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_write ON tto.cooperative_workspace_addresses FOR INSERT TO tto_app
 WITH CHECK (created_by::text = current_setting('tto.actor_id', true));
GRANT INSERT ON tto.cooperative_workspace_addresses TO tto_app;
