-- NAV02 photo: encrypted temporary quarantine ONLY, isolated preview, no public reads.
-- This migration never treats a quarantine upload as clean, authenticated, or publishable.
CREATE TABLE tto.commerce_demo_nav02_photo_quarantine(
 photo_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 draft_id uuid NOT NULL UNIQUE REFERENCES tto.commerce_demo_shareholder_drafts(draft_id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 entered_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 declared_mime text NOT NULL CHECK (declared_mime IN ('image/jpeg','image/png','image/webp')),
 plaintext_bytes integer NOT NULL CHECK (plaintext_bytes BETWEEN 68 AND 1048576),
 content_sha256 bytea NOT NULL CHECK(octet_length(content_sha256)=32),
 aes_gcm_iv bytea NOT NULL CHECK(octet_length(aes_gcm_iv)=12),
 aes_gcm_tag bytea NOT NULL CHECK(octet_length(aes_gcm_tag)=16),
 encrypted_bytes bytea NOT NULL CHECK(octet_length(encrypted_bytes)=plaintext_bytes),
 scan_status text NOT NULL DEFAULT 'QUARANTINED' CHECK(scan_status='QUARANTINED'),
 disclosure_status text NOT NULL DEFAULT 'BLOCKED' CHECK(disclosure_status='BLOCKED'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '7 days'),
 CHECK(expires_at>created_at)
);
CREATE INDEX nav02_photo_expiry_idx ON tto.commerce_demo_nav02_photo_quarantine(expires_at);
ALTER TABLE tto.commerce_demo_nav02_photo_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_nav02_photo_quarantine FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_nav02_photo_quarantine FROM PUBLIC,tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_quarantine_photo(
 p_slug text,p_draft uuid,p_mime text,p_size integer,p_sha bytea,
 p_iv bytea,p_tag bytea,p_cipher bytea)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_photo uuid;
BEGIN
 IF p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' OR p_draft IS NULL OR
 p_mime NOT IN ('image/jpeg','image/png','image/webp') OR p_size NOT BETWEEN 68 AND 1048576 OR
 p_sha IS NULL OR octet_length(p_sha)<>32 OR p_iv IS NULL OR octet_length(p_iv)<>12 OR
 p_tag IS NULL OR octet_length(p_tag)<>16 OR p_cipher IS NULL OR octet_length(p_cipher)<>p_size
 THEN RAISE EXCEPTION 'INVALID_QUARANTINE_BYTES' USING ERRCODE='22023';END IF;
 SELECT w.order_id INTO v_order
 FROM tto.commerce_demo_workspace_owners w JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_shareholder_drafts d ON d.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
   AND o.slug=p_slug AND o.expires_at>clock_timestamp() AND d.draft_id=p_draft
 FOR UPDATE OF w;
 IF v_order IS NULL THEN RAISE EXCEPTION 'NAV02_OWNER_REQUIRED' USING ERRCODE='42501';END IF;
 INSERT INTO tto.commerce_demo_nav02_photo_quarantine(
  draft_id,order_id,entered_by,declared_mime,plaintext_bytes,content_sha256,
  aes_gcm_iv,aes_gcm_tag,encrypted_bytes)
 VALUES(p_draft,v_order,tto.context_actor_id(),p_mime,p_size,p_sha,p_iv,p_tag,p_cipher)
 RETURNING photo_id INTO v_photo;
 RETURN jsonb_build_object('photoId',v_photo,'status','QUARANTINED',
  'scanCompleted',false,'disclosureAllowed',false,'canDownload',false,
  'officialShareholderUpdated',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_quarantine_photo(
 text,uuid,text,integer,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_quarantine_photo(
 text,uuid,text,integer,bytea,bytea,bytea,bytea) TO tto_app;

-- Restricted purge is invoked only by an explicitly scheduled operator/privileged DB role.
-- No public API or demo login may invoke it, and no automatic retention job is claimed.
CREATE FUNCTION tto.purge_expired_commerce_demo_nav02_photos() RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE count_deleted bigint;
BEGIN
 DELETE FROM tto.commerce_demo_nav02_photo_quarantine WHERE expires_at<=clock_timestamp();
 GET DIAGNOSTICS count_deleted=ROW_COUNT;
 RETURN count_deleted;
END $fn$;
REVOKE ALL ON FUNCTION tto.purge_expired_commerce_demo_nav02_photos() FROM PUBLIC,tto_app;
COMMENT ON TABLE tto.commerce_demo_nav02_photo_quarantine IS
 'Isolated preview AES-256-GCM photo quarantine only. Images are NEVER read or released; needs independent malware scanning, retention scheduler, privacy/legal signoff before real PII.';
