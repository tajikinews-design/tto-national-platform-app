-- NAV-02 operational management of SYNTHETIC UNVERIFIED commercial-preview drafts.
-- This is NOT a legal shareholder register; no entitlement, official ledger, vote,
-- share transfer, real payment, approved photograph or production permissions.
BEGIN;
ALTER TABLE tto.commerce_demo_shareholder_drafts
 ADD COLUMN management_state text NOT NULL DEFAULT 'ACTIVE_DRAFT'
  CHECK (management_state IN ('ACTIVE_DRAFT','SUSPENDED_DRAFT')),
 ADD COLUMN record_version bigint NOT NULL DEFAULT 1 CHECK (record_version>0);

CREATE TABLE tto.commerce_demo_nav02_management_audit(
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL,
 draft_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('PROFILE_EDITED','CAPITAL_EDITED','SUSPENDED','REACTIVATED','DELETED')),
 prior_version bigint NOT NULL CHECK(prior_version>0),
 new_version bigint,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((action='DELETED' AND new_version IS NULL) OR
        (action<>'DELETED' AND new_version=prior_version+1))
);
CREATE INDEX nav02_audit_owner_draft ON tto.commerce_demo_nav02_management_audit(order_id,draft_id,recorded_at DESC);
ALTER TABLE tto.commerce_demo_nav02_management_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_nav02_management_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_nav02_management_audit FROM PUBLIC,tto_app;
COMMENT ON TABLE tto.commerce_demo_nav02_management_audit IS
 'Non-PII synthetic preview management operations; deleted draft IDs retained for accountability, no restored profile or official shares.';

-- Use security-definer transaction-level owner checks rather than session/client
-- identity assertions. Lock the workspace and row for all management writes.
CREATE FUNCTION tto.nav02_require_editable_draft(p_slug text,p_draft uuid,p_version bigint)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_state text;v_version bigint;v_verification text;
BEGIN
 IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
 OR p_draft IS NULL OR p_version IS NULL OR p_version<1
 THEN RAISE EXCEPTION 'INVALID_NAV02_MANAGEMENT' USING ERRCODE='22023'; END IF;
 SELECT w.order_id,d.management_state,d.record_version,d.verification_state
 INTO v_order,v_state,v_version,v_verification
 FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_shareholder_drafts d ON d.order_id=w.order_id
 JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
   AND o.slug=p_slug AND o.expires_at>clock_timestamp() AND d.draft_id=p_draft
 FOR UPDATE OF w,d;
 IF v_order IS NULL THEN
  RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF v_verification<>'DRAFT_UNVERIFIED' THEN
  RAISE EXCEPTION 'LEGAL_RECORD_PROTECTED' USING ERRCODE='42501'; END IF;
 IF v_version<>p_version THEN
  RAISE EXCEPTION 'STALE_NAV02_DRAFT' USING ERRCODE='40001'; END IF;
 IF v_state<>'ACTIVE_DRAFT' THEN
  RAISE EXCEPTION 'SUSPENDED_NAV02_DRAFT' USING ERRCODE='42501'; END IF;
 RETURN v_order;
END $fn$;
REVOKE ALL ON FUNCTION tto.nav02_require_editable_draft(text,uuid,bigint) FROM PUBLIC,tto_app;

-- Explicit row ownership and status are checked BEFORE encrypted content is ever
-- returned to the trusted API. No plaintext, photo bytes or full identity in response.
CREATE FUNCTION tto.commerce_demo_nav02_profile_for_edit(p_slug text,p_draft uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT jsonb_build_object('version',d.record_version,
  'title',d.title,'state',d.management_state,
  'cipher',encode(s.encrypted_profile,'base64'),
  'iv',encode(s.aes_gcm_iv,'base64'),'tag',encode(s.aes_gcm_tag,'base64'))
 FROM tto.commerce_demo_shareholder_drafts d
 JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
 JOIN tto.commerce_demo_workspace_owners w ON w.order_id=d.order_id
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE d.draft_id=p_draft AND w.user_id=tto.context_actor_id()
  AND w.state='ACTIVE' AND o.slug=p_slug AND o.expires_at>clock_timestamp()
$fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_profile_for_edit(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_profile_for_edit(text,uuid) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_edit_profile_secure(
 p_slug text,p_draft uuid,p_version bigint,p_title text,p_iv bytea,p_tag bytea,p_cipher bytea)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_old_title text;
BEGIN
 IF p_title NOT IN ('آقا','خانم','شرکت','سازمان','اداره')
  OR p_iv IS NULL OR octet_length(p_iv)<>12 OR
  p_tag IS NULL OR octet_length(p_tag)<>16 OR
  p_cipher IS NULL OR octet_length(p_cipher) NOT BETWEEN 60 AND 5000
 THEN RAISE EXCEPTION 'INVALID_EDIT_PROFILE' USING ERRCODE='22023'; END IF;
 v_order:=tto.nav02_require_editable_draft(p_slug,p_draft,p_version);
 SELECT title INTO v_old_title FROM tto.commerce_demo_shareholder_drafts WHERE draft_id=p_draft;
 -- Changing natural-person to legal-entity type would invalidate the masked
 -- immutable 10/11-digit synthetic identifier. Require a new draft instead.
 IF (v_old_title IN ('آقا','خانم')) IS DISTINCT FROM (p_title IN ('آقا','خانم'))
 THEN RAISE EXCEPTION 'IDENTITY_KIND_IMMUTABLE' USING ERRCODE='22023'; END IF;
 UPDATE tto.commerce_demo_shareholder_drafts
 SET title=p_title,record_version=record_version+1 WHERE draft_id=p_draft;
 UPDATE tto.commerce_demo_nav02_sensitive_profiles
 SET encrypted_profile=p_cipher,aes_gcm_iv=p_iv,aes_gcm_tag=p_tag,recorded_at=clock_timestamp()
 WHERE draft_id=p_draft AND order_id=v_order;
 INSERT INTO tto.commerce_demo_nav02_management_audit(order_id,draft_id,actor_id,action,prior_version,new_version)
 VALUES(v_order,p_draft,tto.context_actor_id(),'PROFILE_EDITED',p_version,p_version+1);
 RETURN jsonb_build_object('id',p_draft,'version',p_version+1,'updated',true,
   'officialLedgerUpdated',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_edit_profile_secure(
 text,uuid,bigint,text,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_edit_profile_secure(
 text,uuid,bigint,text,bytea,bytea,bytea) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_edit_capital_secure(
 p_slug text,p_draft uuid,p_version bigint,p_fields jsonb,
 p_cipher bytea,p_iv bytea,p_tag bytea)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_initial bigint;v_subscribed bigint;v_nominal bigint;v_paid bigint;v_changed int;
BEGIN
 IF p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE k NOT IN
 ('initialShares','subscribedShares','nominalRial','paidRial','paymentDate')) OR
 (p_fields->>'initialShares') !~ '^[0-9]{1,12}$' OR
 (p_fields->>'subscribedShares') !~ '^[0-9]{1,12}$' OR
 (p_fields->>'nominalRial') !~ '^[0-9]{1,15}$' OR
 (p_fields->>'paidRial') !~ '^[0-9]{1,17}$' OR
 (COALESCE(p_fields->>'paymentDate','')<>'' AND
  (p_fields->>'paymentDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR
 p_cipher IS NULL OR octet_length(p_cipher) NOT BETWEEN 3 AND 600 OR
 p_iv IS NULL OR octet_length(p_iv)<>12 OR p_tag IS NULL OR octet_length(p_tag)<>16
 THEN RAISE EXCEPTION 'INVALID_EDIT_CAPITAL' USING ERRCODE='22023'; END IF;
 v_initial:=(p_fields->>'initialShares')::bigint;
 v_subscribed:=(p_fields->>'subscribedShares')::bigint;
 v_nominal:=(p_fields->>'nominalRial')::bigint;
 v_paid:=(p_fields->>'paidRial')::bigint;
 IF v_initial+v_subscribed<=0 OR v_nominal<=0 OR
 v_paid>(v_initial+v_subscribed)::numeric*v_nominal
 THEN RAISE EXCEPTION 'INVALID_EDIT_CAPITAL_TOTALS' USING ERRCODE='22023'; END IF;
 v_order:=tto.nav02_require_editable_draft(p_slug,p_draft,p_version);
 UPDATE tto.commerce_demo_share_capital_drafts
 SET initial_purchased_shares=v_initial,subscribed_shares=v_subscribed,
 nominal_value_rial=v_nominal,declared_paid_rial=v_paid,
 declared_payment_date=CASE WHEN COALESCE(p_fields->>'paymentDate','')=''
   THEN NULL ELSE (p_fields->>'paymentDate')::date END,
 encrypted_receipt_ref=p_cipher,aes_receipt_iv=p_iv,aes_receipt_tag=p_tag
 WHERE shareholder_draft_id=p_draft;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN
  RAISE EXCEPTION 'CAPITAL_NOT_YET_DECLARED' USING ERRCODE='22023'; END IF;
 UPDATE tto.commerce_demo_shareholder_drafts
 SET record_version=record_version+1 WHERE draft_id=p_draft;
 INSERT INTO tto.commerce_demo_nav02_management_audit(order_id,draft_id,actor_id,action,prior_version,new_version)
 VALUES(v_order,p_draft,tto.context_actor_id(),'CAPITAL_EDITED',p_version,p_version+1);
 RETURN jsonb_build_object('id',p_draft,'version',p_version+1,'updated',true,
   'paymentVerified',false,'officialLedgerUpdated',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_edit_capital_secure(
 text,uuid,bigint,jsonb,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_edit_capital_secure(
 text,uuid,bigint,jsonb,bytea,bytea,bytea) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_change_state(
 p_slug text,p_draft uuid,p_version bigint,p_action text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_version bigint;v_state text;v_verification text;v_next text;v_event text;
BEGIN
 IF p_action NOT IN ('suspend','resume') OR p_draft IS NULL OR p_version IS NULL OR p_version<1
 THEN RAISE EXCEPTION 'INVALID_STATE_ACTION' USING ERRCODE='22023';END IF;
 SELECT w.order_id,d.record_version,d.management_state,d.verification_state
 INTO v_order,v_version,v_state,v_verification
 FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_shareholder_drafts d ON d.order_id=w.order_id
 JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
 AND o.slug=p_slug AND o.expires_at>clock_timestamp() AND d.draft_id=p_draft
 FOR UPDATE OF w,d;
 IF v_order IS NULL OR v_verification<>'DRAFT_UNVERIFIED'
 THEN RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501';END IF;
 IF v_version<>p_version THEN RAISE EXCEPTION 'STALE_NAV02_DRAFT' USING ERRCODE='40001';END IF;
 IF p_action='suspend' AND v_state='ACTIVE_DRAFT' THEN
  v_next:='SUSPENDED_DRAFT';v_event:='SUSPENDED';
 ELSIF p_action='resume' AND v_state='SUSPENDED_DRAFT' THEN
  v_next:='ACTIVE_DRAFT';v_event:='REACTIVATED';
 ELSE RAISE EXCEPTION 'INVALID_STATE_TRANSITION' USING ERRCODE='22023'; END IF;
 UPDATE tto.commerce_demo_shareholder_drafts
 SET management_state=v_next,record_version=record_version+1 WHERE draft_id=p_draft;
 INSERT INTO tto.commerce_demo_nav02_management_audit(order_id,draft_id,actor_id,action,prior_version,new_version)
 VALUES(v_order,p_draft,tto.context_actor_id(),v_event,p_version,p_version+1);
 RETURN jsonb_build_object('id',p_draft,'version',p_version+1,'managementState',v_next,
  'officialMemberStatusChanged',false,'officialSharesLocked',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_change_state(text,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_change_state(text,uuid,bigint,text) TO tto_app;

-- Even legacy capital/photo intake RPCs must not mutate a suspended draft.
CREATE FUNCTION tto.nav02_reject_suspended_mutation() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
   WHERE d.draft_id=NEW.shareholder_draft_id AND d.management_state='ACTIVE_DRAFT')
 THEN RAISE EXCEPTION 'SUSPENDED_NAV02_DRAFT' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER nav02_guard_capital_insert BEFORE INSERT ON tto.commerce_demo_share_capital_drafts
 FOR EACH ROW EXECUTE FUNCTION tto.nav02_reject_suspended_mutation();
-- Photo quarantine has draft_id rather than shareholder_draft_id.
CREATE FUNCTION tto.nav02_reject_suspended_photo() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts d
   WHERE d.draft_id=NEW.draft_id AND d.management_state='ACTIVE_DRAFT')
 THEN RAISE EXCEPTION 'SUSPENDED_NAV02_DRAFT' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER nav02_guard_photo_insert BEFORE INSERT ON tto.commerce_demo_nav02_photo_quarantine
 FOR EACH ROW EXECUTE FUNCTION tto.nav02_reject_suspended_photo();
REVOKE ALL ON FUNCTION tto.nav02_reject_suspended_mutation() FROM PUBLIC,tto_app;
REVOKE ALL ON FUNCTION tto.nav02_reject_suspended_photo() FROM PUBLIC,tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_delete_unverified(
 p_slug text,p_draft uuid,p_version bigint,p_confirm text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_version bigint;v_state text;v_has_capital boolean;v_has_photo boolean;
BEGIN
 IF p_confirm IS DISTINCT FROM 'DELETE_SYNTHETIC_DRAFT' OR
 p_draft IS NULL OR p_version IS NULL OR p_version<1
 THEN RAISE EXCEPTION 'DELETE_CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
 SELECT w.order_id,d.record_version,d.verification_state
 INTO v_order,v_version,v_state
 FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_shareholder_drafts d ON d.order_id=w.order_id
 JOIN tto.commerce_demo_nav02_sensitive_profiles s ON s.draft_id=d.draft_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
 AND o.slug=p_slug AND o.expires_at>clock_timestamp() AND d.draft_id=p_draft
 FOR UPDATE OF w,d;
 IF v_order IS NULL OR v_state<>'DRAFT_UNVERIFIED'
 THEN RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501';END IF;
 IF v_version<>p_version THEN RAISE EXCEPTION 'STALE_NAV02_DRAFT' USING ERRCODE='40001';END IF;
 SELECT EXISTS(SELECT 1 FROM tto.commerce_demo_share_capital_drafts WHERE shareholder_draft_id=p_draft)
 INTO v_has_capital;
 SELECT EXISTS(SELECT 1 FROM tto.commerce_demo_nav02_photo_quarantine WHERE draft_id=p_draft)
 INTO v_has_photo;
 INSERT INTO tto.commerce_demo_nav02_management_audit(order_id,draft_id,actor_id,action,prior_version,new_version)
 VALUES(v_order,p_draft,tto.context_actor_id(),'DELETED',p_version,NULL);
 DELETE FROM tto.commerce_demo_share_capital_drafts WHERE shareholder_draft_id=p_draft;
 -- Encrypted profile and quarantine photo have FK ON DELETE CASCADE.
 DELETE FROM tto.commerce_demo_shareholder_drafts WHERE draft_id=p_draft AND order_id=v_order;
 RETURN jsonb_build_object('deleted',true,'id',p_draft,'capitalErased',v_has_capital,
  'photoErased',v_has_photo,'officialLedgerUpdated',false,'restorable',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_delete_unverified(
 text,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_delete_unverified(
 text,uuid,bigint,text) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_audit(p_slug text,p_draft uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'action',a.action,'version',a.prior_version,'at',a.recorded_at)
  ORDER BY a.recorded_at DESC),'[]'::jsonb)
 FROM (SELECT h.action,h.prior_version,h.recorded_at
  FROM tto.commerce_demo_nav02_management_audit h
  JOIN tto.commerce_demo_workspace_owners w ON w.order_id=h.order_id
  JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
  JOIN tto.commerce_demo_shareholder_drafts d ON d.draft_id=h.draft_id AND d.order_id=w.order_id
  WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
  AND o.slug=p_slug AND o.expires_at>clock_timestamp()
  AND h.draft_id=p_draft ORDER BY h.recorded_at DESC LIMIT 40) a
$fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_audit(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_audit(text,uuid) TO tto_app;

CREATE OR REPLACE FUNCTION tto.commerce_demo_nav02_list_secure(p_slug text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',draft_id,'title',title,'cipher',cipher,'iv',iv,'tag',tag,
  'state',verification_state,'managementState',management_state,'version',record_version,
  'photoState',photo_state,'initialShares',initial_purchased_shares,
  'subscribedShares',subscribed_shares,'nominalRial',nominal_value_rial,
  'declaredPaidRial',declared_paid_rial,'paymentDate',declared_payment_date,
  'capitalState',evidence_status) ORDER BY created_at DESC),'[]'::jsonb)
 FROM (
  SELECT d.draft_id,d.title,d.verification_state,d.management_state,
   d.record_version,d.created_at,
   encode(s.encrypted_profile,'base64') cipher,encode(s.aes_gcm_iv,'base64') iv,
   encode(s.aes_gcm_tag,'base64') tag,
   CASE WHEN EXISTS(SELECT 1 FROM tto.commerce_demo_nav02_photo_quarantine p
                     WHERE p.draft_id=d.draft_id) THEN 'QUARANTINED' ELSE 'NONE' END photo_state,
   c.initial_purchased_shares::text AS initial_purchased_shares,
   c.subscribed_shares::text AS subscribed_shares,
   c.nominal_value_rial::text AS nominal_value_rial,
   c.declared_paid_rial::text AS declared_paid_rial,
   c.declared_payment_date,c.evidence_status
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
COMMIT;
