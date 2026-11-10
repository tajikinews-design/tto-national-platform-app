-- Isolated NAV02: encrypted PII envelopes, never legal Member/Party/Share ledger.
-- Precondition: synthetic disposable preview has zero drafts; do not rewrite user data.
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts) OR
    EXISTS(SELECT 1 FROM tto.commerce_demo_share_capital_drafts) THEN
  RAISE EXCEPTION 'NAV02_NONEMPTY_PII_MIGRATION_REQUIRES_MANUAL_REVIEW';
 END IF;
END $guard$;
ALTER TABLE tto.commerce_demo_shareholder_drafts
 ALTER COLUMN full_name DROP NOT NULL,
 ALTER COLUMN shareholder_group DROP NOT NULL,
 ALTER COLUMN national_identifier DROP NOT NULL;
-- PostgreSQL truncates generated constraint names to NAMEDATALEN-1 (63 bytes).
-- Resolve the expected (order_id,national_identifier) unique constraint from
-- the actual catalog. Fail closed if missing; never drop a different constraint.
DO $unique_migration$
DECLARE v_name text;
BEGIN
 SELECT c.conname INTO v_name
 FROM pg_constraint c
 WHERE c.conrelid='tto.commerce_demo_shareholder_drafts'::regclass
   AND c.contype='u'
   AND pg_get_constraintdef(c.oid)='UNIQUE (order_id, national_identifier)';
 IF v_name IS NULL THEN
  RAISE EXCEPTION 'NAV02_LEGACY_UNIQUE_CONSTRAINT_MISSING';
 END IF;
 EXECUTE format('ALTER TABLE tto.commerce_demo_shareholder_drafts DROP CONSTRAINT %I',v_name);
END $unique_migration$;
ALTER TABLE tto.commerce_demo_shareholder_drafts
 ADD CONSTRAINT nav02_plain_identity_always_empty CHECK(
 full_name IS NULL AND shareholder_group IS NULL AND national_identifier IS NULL
 AND father_name IS NULL AND birth_certificate_number IS NULL AND birth_date IS NULL
 AND birth_place IS NULL AND telephone IS NULL AND mobile IS NULL
 AND postal_code IS NULL AND address IS NULL AND photo_ref IS NULL);

CREATE TABLE tto.commerce_demo_nav02_sensitive_profiles(
 draft_id uuid PRIMARY KEY REFERENCES tto.commerce_demo_shareholder_drafts(draft_id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 national_id_hmac bytea NOT NULL CHECK(octet_length(national_id_hmac)=32),
 cipher_schema text NOT NULL DEFAULT 'AES_256_GCM_V1' CHECK(cipher_schema='AES_256_GCM_V1'),
 aes_gcm_iv bytea NOT NULL CHECK(octet_length(aes_gcm_iv)=12),
 aes_gcm_tag bytea NOT NULL CHECK(octet_length(aes_gcm_tag)=16),
 encrypted_profile bytea NOT NULL CHECK(octet_length(encrypted_profile) BETWEEN 60 AND 5000),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(order_id,national_id_hmac)
);
ALTER TABLE tto.commerce_demo_nav02_sensitive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_nav02_sensitive_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_nav02_sensitive_profiles FROM PUBLIC,tto_app;

ALTER TABLE tto.commerce_demo_share_capital_drafts
 ALTER COLUMN declared_receipt_ref DROP NOT NULL,
 ADD COLUMN encrypted_receipt_ref bytea NOT NULL,
 ADD COLUMN aes_receipt_iv bytea NOT NULL,
 ADD COLUMN aes_receipt_tag bytea NOT NULL;
ALTER TABLE tto.commerce_demo_share_capital_drafts
 ADD CONSTRAINT nav02_receipt_never_plaintext CHECK (
 declared_receipt_ref IS NULL AND octet_length(encrypted_receipt_ref) BETWEEN 3 AND 600
 AND octet_length(aes_receipt_iv)=12 AND octet_length(aes_receipt_tag)=16);

-- The obsolete plaintext functions are still part of historical migration source,
-- but cannot be called by the preview application after this migration.
REVOKE EXECUTE ON FUNCTION tto.commerce_demo_nav02_list(text),
 tto.commerce_demo_nav02_add(text,jsonb),
 tto.commerce_demo_nav02_capital(text,uuid,jsonb) FROM tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_add_secure(
 p_slug text,p_title text,p_hmac bytea,p_iv bytea,p_tag bytea,p_cipher bytea)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_id uuid;
BEGIN
 IF p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' OR
 p_title NOT IN ('آقا','خانم','شرکت','سازمان','اداره') OR
 p_hmac IS NULL OR octet_length(p_hmac)<>32 OR
 p_iv IS NULL OR octet_length(p_iv)<>12 OR p_tag IS NULL OR octet_length(p_tag)<>16 OR
 p_cipher IS NULL OR octet_length(p_cipher) NOT BETWEEN 60 AND 5000
 THEN RAISE EXCEPTION 'INVALID_PROTECTED_PROFILE' USING ERRCODE='22023';END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
 AND o.slug=p_slug AND o.expires_at>clock_timestamp() FOR UPDATE OF w;
 IF v_order IS NULL THEN RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501';END IF;
 INSERT INTO tto.commerce_demo_shareholder_drafts(order_id,title,entered_by)
 VALUES(v_order,p_title,tto.context_actor_id()) RETURNING draft_id INTO v_id;
 INSERT INTO tto.commerce_demo_nav02_sensitive_profiles(
 draft_id,order_id,national_id_hmac,aes_gcm_iv,aes_gcm_tag,encrypted_profile)
 VALUES(v_id,v_order,p_hmac,p_iv,p_tag,p_cipher);
 RETURN jsonb_build_object('id',v_id,'state','DRAFT_UNVERIFIED','legalRightsGranted',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_add_secure(
 text,text,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_add_secure(
 text,text,bytea,bytea,bytea,bytea) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_list_secure(p_slug text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',draft_id,'title',title,'cipher',cipher,'iv',iv,'tag',tag,
  'state',verification_state,'initialShares',initial_purchased_shares,
  'subscribedShares',subscribed_shares,'nominalRial',nominal_value_rial,
  'declaredPaidRial',declared_paid_rial,'paymentDate',declared_payment_date,
  'capitalState',evidence_status) ORDER BY created_at DESC),'[]'::jsonb)
 FROM (
  SELECT d.draft_id,d.title,d.verification_state,d.created_at,
   encode(s.encrypted_profile,'base64') cipher,encode(s.aes_gcm_iv,'base64') iv,
   encode(s.aes_gcm_tag,'base64') tag,
   c.initial_purchased_shares,c.subscribed_shares,c.nominal_value_rial,
   c.declared_paid_rial,c.declared_payment_date,c.evidence_status
  FROM tto.commerce_demo_shareholder_drafts d
  JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
  LEFT JOIN tto.commerce_demo_share_capital_drafts c ON c.shareholder_draft_id=d.draft_id
  JOIN tto.commerce_demo_workspace_owners w ON w.order_id=d.order_id
  JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
  WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
  AND o.slug=p_slug AND o.expires_at>clock_timestamp()
  ORDER BY d.created_at DESC LIMIT 100
 ) sub
$fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_list_secure(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_list_secure(text) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_capital_secure(
 p_slug text,p_id uuid,p_input jsonb,p_receipt_cipher bytea,p_receipt_iv bytea,p_receipt_tag bytea)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_entry uuid;v_initial bigint;v_subscribed bigint;v_nominal bigint;v_paid bigint;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN
 ('initialShares','subscribedShares','nominalRial','paidRial','paymentDate')) OR
 (p_input->>'initialShares') !~ '^[0-9]{1,12}$' OR
 (p_input->>'subscribedShares') !~ '^[0-9]{1,12}$' OR
 (p_input->>'nominalRial') !~ '^[0-9]{1,15}$' OR
 (p_input->>'paidRial') !~ '^[0-9]{1,17}$' OR
 (COALESCE(p_input->>'paymentDate','')<>'' AND (p_input->>'paymentDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR
 p_receipt_cipher IS NULL OR octet_length(p_receipt_cipher) NOT BETWEEN 3 AND 600 OR
 p_receipt_iv IS NULL OR octet_length(p_receipt_iv)<>12 OR p_receipt_tag IS NULL OR
 octet_length(p_receipt_tag)<>16
 THEN RAISE EXCEPTION 'INVALID_SECURE_CAPITAL_FIELDS' USING ERRCODE='22023';END IF;
 v_initial:=(p_input->>'initialShares')::bigint;v_subscribed:=(p_input->>'subscribedShares')::bigint;
 v_nominal:=(p_input->>'nominalRial')::bigint;v_paid:=(p_input->>'paidRial')::bigint;
 IF v_initial+v_subscribed<=0 OR v_nominal<=0 OR
    v_paid>(v_initial+v_subscribed)::numeric*v_nominal THEN
 RAISE EXCEPTION 'INVALID_CAPITAL_TOTALS' USING ERRCODE='22023';END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_shareholder_drafts d ON d.order_id=w.order_id
 JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
 AND o.slug=p_slug AND o.expires_at>clock_timestamp() AND d.draft_id=p_id FOR UPDATE OF w;
 IF v_order IS NULL THEN RAISE EXCEPTION 'SHAREHOLDER_NOT_IN_WORKSPACE' USING ERRCODE='42501';END IF;
 INSERT INTO tto.commerce_demo_share_capital_drafts(shareholder_draft_id,
 initial_purchased_shares,subscribed_shares,nominal_value_rial,declared_paid_rial,
 declared_payment_date,encrypted_receipt_ref,aes_receipt_iv,aes_receipt_tag,entered_by)
 VALUES(p_id,v_initial,v_subscribed,v_nominal,v_paid,
 CASE WHEN COALESCE(p_input->>'paymentDate','')='' THEN NULL ELSE (p_input->>'paymentDate')::date END,
 p_receipt_cipher,p_receipt_iv,p_receipt_tag,tto.context_actor_id()) RETURNING entry_id INTO v_entry;
 RETURN jsonb_build_object('entryId',v_entry,'state','DECLARED_UNVERIFIED',
  'officialLedgerUpdated',false,'transferEnabled',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_capital_secure(
 text,uuid,jsonb,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_capital_secure(
 text,uuid,jsonb,bytea,bytea,bytea) TO tto_app;

COMMENT ON TABLE tto.commerce_demo_nav02_sensitive_profiles IS
 'AES-256-GCM private synthetic preview identity envelope. No plaintext fields; restricted by tenant-owner RPC; real identities need approval.';
