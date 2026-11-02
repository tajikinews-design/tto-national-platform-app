-- PH02 ARCHITECTURE DESIGN ONLY — NOT AN ACTIVE MIGRATION.
-- DO NOT APPLY WITHOUT DOMAIN / SECURITY / LEGAL SOURCE SIGNOFF.
-- Future adoption requires a numbered migration, RLS review, integration tests,
-- and explicit event ownership. No real shares/payments/custody.
--
-- Event and audit/outbox must persist in SAME transaction as source aggregate.
-- Tenant scope is server-side, NOT a public payload claim.
CREATE TABLE tto.outbox_events (
  event_id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tto.tenants(tenant_id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version >= 1),
  event_schema_version integer NOT NULL CHECK (event_schema_version >= 1),
  classification text NOT NULL CHECK (classification IN ('PUBLIC','MEMBER','TENANT_INTERNAL','RESTRICTED','HIGHLY_RESTRICTED')),
  payload_ref text NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
);
CREATE INDEX outbox_events_pending ON tto.outbox_events(available_at,created_at)
  WHERE published_at IS NULL;
ALTER TABLE tto.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.outbox_events FORCE ROW LEVEL SECURITY;
-- No blanket app SELECT/UPDATE policy is granted here. Producer functions
-- require reviewed SECURITY DEFINER boundaries; dispatcher uses restricted role.
REVOKE ALL ON tto.outbox_events FROM PUBLIC,tto_app;

CREATE TABLE tto.inbox_receipts (
  consumer_id text NOT NULL,
  event_id uuid NOT NULL REFERENCES tto.outbox_events(event_id),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_id,event_id)
);
REVOKE ALL ON tto.inbox_receipts FROM PUBLIC,tto_app;
-- Future worker: claim with SKIP LOCKED; transact delivery acknowledgement;
-- no third-party delivery inside source-aggregate transaction;
-- exact-once external side effects are NOT promised; consumer idempotency required.
