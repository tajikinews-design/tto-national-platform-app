-- NAV02 form R3: editable draft identity, owner-only photo display and replace.
-- Only administrative draft profiles and private images; no CHILD06 admission or CHILD07 ownership writes.
BEGIN;
-- A draft identity can be corrected, including natural/legal classification. This does
-- NOT certify the new identity. The API must mark it unverified before re-attestation.
CREATE FUNCTION tto.nav02_member_edit_all_fields(
 p_slug text,p_draft uuid,p_version bigint,p_title text,p_digest bytea,
 p_iv bytea,p_tag bytea,p_cipher bytea) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 IF p_title NOT IN('آقا','خانم','شرکت') OR
    p_digest IS NULL OR octet_length(p_digest)<>32 OR
    p_iv IS NULL OR octet_length(p_iv)<>12 OR
    p_tag IS NULL OR octet_length(p_tag)<>16 OR
    p_cipher IS NULL OR octet_length(p_cipher) NOT BETWEEN 60 AND 5000
 THEN RAISE EXCEPTION 'INVALID_EDIT_FIELDS' USING ERRCODE='22023'; END IF;
 v_order:=tto.nav02_require_editable_draft(p_slug,p_draft,p_version);
 UPDATE tto.commerce_demo_shareholder_drafts
 SET title=p_title,record_version=record_version+1 WHERE draft_id=p_draft AND order_id=v_order;
 UPDATE tto.commerce_demo_nav02_sensitive_profiles
 SET national_id_hmac=p_digest,encrypted_profile=p_cipher,
     aes_gcm_iv=p_iv,aes_gcm_tag=p_tag,recorded_at=clock_timestamp()
 WHERE draft_id=p_draft AND order_id=v_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE='42501'; END IF;
 INSERT INTO tto.commerce_demo_nav02_management_audit(order_id,draft_id,actor_id,action,prior_version,new_version)
 VALUES(v_order,p_draft,tto.context_actor_id(),'PROFILE_EDITED',p_version,p_version+1);
 RETURN jsonb_build_object('id',p_draft,'version',p_version+1,'updated',true,
   'identityAndShareRightsVerified',false,'officialLedgerUpdated',false);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_edit_all_fields(text,uuid,bigint,text,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_edit_all_fields(text,uuid,bigint,text,bytea,bytea,bytea,bytea) TO tto_app;

-- Distinguish format-checked user photographs from malware-scanned attachments.
ALTER TABLE tto.commerce_demo_nav02_photo_quarantine
 DROP CONSTRAINT nav02_photo_private_disclosure,
 DROP CONSTRAINT nav02_photo_scan_status;
ALTER TABLE tto.commerce_demo_nav02_photo_quarantine
 ADD CONSTRAINT nav02_photo_scan_status CHECK(scan_status IN('QUARANTINED','CLEAN','MALWARE','IMAGE_VALIDATED')),
 ADD CONSTRAINT nav02_photo_private_disclosure CHECK(
   disclosure_status IN('BLOCKED','OWNER_ALLOWED') AND
   (disclosure_status='BLOCKED' OR scan_status IN('CLEAN','IMAGE_VALIDATED')));
-- Existing images passed MIME, size and format signature checks at upload;
-- authorize strictly scoped owner viewing without falsely claiming a malware scan.
UPDATE tto.commerce_demo_nav02_photo_quarantine
 SET scan_status='IMAGE_VALIDATED',disclosure_status='OWNER_ALLOWED',
     expires_at=GREATEST(expires_at,clock_timestamp()+interval '5 years')
 WHERE scan_status='QUARANTINED' AND disclosure_status='BLOCKED'
 AND declared_mime IN('image/png','image/jpeg','image/webp')
 AND plaintext_bytes BETWEEN 68 AND 716800
 AND octet_length(content_sha256)=32 AND octet_length(aes_gcm_iv)=12
 AND octet_length(aes_gcm_tag)=16 AND octet_length(encrypted_bytes)=plaintext_bytes;

CREATE FUNCTION tto.nav02_member_photo_save(
 p_slug text,p_draft uuid,p_mime text,p_size integer,p_sha bytea,
 p_iv bytea,p_tag bytea,p_cipher bytea) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;
BEGIN
 IF p_mime NOT IN('image/jpeg','image/png','image/webp') OR p_size NOT BETWEEN 68 AND 716800 OR
  octet_length(p_sha)<>32 OR octet_length(p_iv)<>12 OR
  octet_length(p_tag)<>16 OR octet_length(p_cipher)<>p_size
 THEN RAISE EXCEPTION 'INVALID_PRIVATE_PHOTO' USING ERRCODE='22023';END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts
  WHERE draft_id=p_draft AND order_id=v_order AND management_state='ACTIVE_DRAFT')
 THEN RAISE EXCEPTION 'OWNER_OR_EDITABLE_DRAFT_REQUIRED' USING ERRCODE='42501';END IF;
 INSERT INTO tto.commerce_demo_nav02_photo_quarantine(
  draft_id,order_id,entered_by,declared_mime,plaintext_bytes,content_sha256,
  aes_gcm_iv,aes_gcm_tag,encrypted_bytes,scan_status,disclosure_status,expires_at)
 VALUES(p_draft,v_order,tto.context_actor_id(),p_mime,p_size,p_sha,
  p_iv,p_tag,p_cipher,'IMAGE_VALIDATED','OWNER_ALLOWED',clock_timestamp()+interval '5 years')
 ON CONFLICT(draft_id) DO UPDATE SET entered_by=EXCLUDED.entered_by,
  declared_mime=EXCLUDED.declared_mime,plaintext_bytes=EXCLUDED.plaintext_bytes,
  content_sha256=EXCLUDED.content_sha256,aes_gcm_iv=EXCLUDED.aes_gcm_iv,
  aes_gcm_tag=EXCLUDED.aes_gcm_tag,encrypted_bytes=EXCLUDED.encrypted_bytes,
  scan_status='IMAGE_VALIDATED',disclosure_status='OWNER_ALLOWED',
  expires_at=EXCLUDED.expires_at
 WHERE tto.commerce_demo_nav02_photo_quarantine.order_id=v_order
 RETURNING photo_id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'PHOTO_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('saved',true,'photoId',v_id,'display','OWNER_PRIVATE','replaceable',true);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_member_photo_save(text,uuid,text,integer,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_member_photo_save(text,uuid,text,integer,bytea,bytea,bytea,bytea) TO tto_app;

CREATE OR REPLACE FUNCTION tto.nav02_photo_ready_for_owner(p_slug text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN (SELECT COALESCE(jsonb_agg(p.draft_id),'[]'::jsonb)
 FROM tto.commerce_demo_nav02_photo_quarantine p
 WHERE p.order_id=v_order AND p.scan_status IN('CLEAN','IMAGE_VALIDATED')
 AND p.disclosure_status='OWNER_ALLOWED' AND p.expires_at>clock_timestamp());
END $f$;

CREATE OR REPLACE FUNCTION tto.nav02_photo_payload_for_owner(p_slug text,p_draft uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;
BEGIN
 v_order:=tto.nav02_member_owner_order(p_slug);
 RETURN (SELECT jsonb_build_object('mime',p.declared_mime,'iv',encode(p.aes_gcm_iv,'base64'),
  'tag',encode(p.aes_gcm_tag,'base64'),'cipher',encode(p.encrypted_bytes,'base64'),
  'sha',encode(p.content_sha256,'hex'),'size',p.plaintext_bytes)
 FROM tto.commerce_demo_nav02_photo_quarantine p
 WHERE p.order_id=v_order AND p.draft_id=p_draft AND
 p.scan_status IN('CLEAN','IMAGE_VALIDATED') AND p.disclosure_status='OWNER_ALLOWED'
 AND p.expires_at>clock_timestamp());
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_photo_ready_for_owner(text),
 tto.nav02_photo_payload_for_owner(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_photo_ready_for_owner(text),
 tto.nav02_photo_payload_for_owner(text,uuid) TO tto_app;
COMMIT;
