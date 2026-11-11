-- PH12 PREVIEW-ONLY national root recovery receipt journal.
-- NOT applied to Supabase by this PR. Separate DBA approval and backup required.
-- Existing root remains unique; no new privileged principal is created.
CREATE TABLE IF NOT EXISTS tto.national_root_recovery_receipts (
  recovery_nonce uuid PRIMARY KEY,
  challenge_id uuid NOT NULL UNIQUE,
  root_user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  reviewer_user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  from_credentials_version bigint NOT NULL,
  to_credentials_version bigint NOT NULL,
  mandate_ref text NOT NULL CHECK (mandate_ref ~ '^[A-Za-z0-9._:-]{12,128}$'),
  otp_receipt_sha256 bytea NOT NULL CHECK (octet_length(otp_receipt_sha256)=32),
  approval_receipt_sha256 bytea NOT NULL CHECK (octet_length(approval_receipt_sha256)=32),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ph12_recovery_version_moves_forward CHECK (to_credentials_version=from_credentials_version+1),
  CONSTRAINT ph12_recovery_different_reviewer CHECK (reviewer_user_id<>root_user_id)
);
REVOKE ALL ON tto.national_root_recovery_receipts FROM PUBLIC;
REVOKE ALL ON tto.national_root_recovery_receipts FROM tto_app;
-- Prevent accidental edits even if a future application grant is expanded.
CREATE OR REPLACE FUNCTION tto.reject_national_root_recovery_journal_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog,tto AS $fn$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECOVERY_RECEIPT';
END
$fn$;
REVOKE ALL ON FUNCTION tto.reject_national_root_recovery_journal_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS national_root_recovery_append_only ON tto.national_root_recovery_receipts;
CREATE TRIGGER national_root_recovery_append_only
BEFORE UPDATE OR DELETE ON tto.national_root_recovery_receipts
FOR EACH ROW EXECUTE FUNCTION tto.reject_national_root_recovery_journal_change();
