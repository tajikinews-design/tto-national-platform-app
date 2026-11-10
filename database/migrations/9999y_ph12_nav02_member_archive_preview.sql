-- NAV02 archival for unverified synthetic member applications only.
-- IMPORTANT: apply to a disposable PostgreSQL17 environment first.
-- No legal membership/official shareholder ledger/archive is changed.
BEGIN;
DO $extend_constraints$
DECLARE v_name text;v_count integer;
BEGIN
 SELECT min(conname),count(*) INTO v_name,v_count FROM pg_constraint
 WHERE conrelid='tto.commerce_demo_shareholder_drafts'::regclass
  AND contype='c' AND position('management_state' in pg_get_constraintdef(oid))>0
  AND position('SUSPENDED_DRAFT' in pg_get_constraintdef(oid))>0;
 IF v_count<>1 THEN RAISE EXCEPTION 'NAV02_DRAFT_STATE_CONSTRAINT_NOT_UNIQUE';END IF;
 EXECUTE format('ALTER TABLE tto.commerce_demo_shareholder_drafts DROP CONSTRAINT %I',v_name);
 ALTER TABLE tto.commerce_demo_shareholder_drafts
  ADD CONSTRAINT nav02_management_state_archive_check
   CHECK(management_state IN ('ACTIVE_DRAFT','SUSPENDED_DRAFT','ARCHIVED_DRAFT'));
 SELECT min(conname),count(*) INTO v_name,v_count FROM pg_constraint
 WHERE conrelid='tto.commerce_demo_nav02_management_audit'::regclass
  AND contype='c' AND position('action' in pg_get_constraintdef(oid))>0
  AND position('REACTIVATED' in pg_get_constraintdef(oid))>0;
 IF v_count<>1 THEN RAISE EXCEPTION 'NAV02_AUDIT_ACTION_CONSTRAINT_NOT_UNIQUE';END IF;
 EXECUTE format('ALTER TABLE tto.commerce_demo_nav02_management_audit DROP CONSTRAINT %I',v_name);
 ALTER TABLE tto.commerce_demo_nav02_management_audit
  ADD CONSTRAINT nav02_archive_event_check
   CHECK(action IN('PROFILE_EDITED','CAPITAL_EDITED','SUSPENDED','REACTIVATED',
    'ARCHIVED','RESTORED','DELETED'));
END $extend_constraints$;

-- A tombstoned/archived draft cannot be edited, accept photo evidence or
-- affect the legal shares ledger. State changes require owner, row lock
-- and current optimistic version as in the original W management function.
CREATE OR REPLACE FUNCTION tto.commerce_demo_nav02_change_state(
 p_slug text,p_draft uuid,p_version bigint,p_action text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_order uuid;v_version bigint;v_state text;v_verification text;v_next text;v_event text;
BEGIN
 IF p_action NOT IN('suspend','resume','archive','restore') OR
 p_draft IS NULL OR p_version IS NULL OR p_version<1
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
 ELSIF p_action='archive' AND v_state IN('ACTIVE_DRAFT','SUSPENDED_DRAFT') THEN
  v_next:='ARCHIVED_DRAFT';v_event:='ARCHIVED';
 ELSIF p_action='restore' AND v_state='ARCHIVED_DRAFT' THEN
  v_next:='ACTIVE_DRAFT';v_event:='RESTORED';
 ELSE RAISE EXCEPTION 'INVALID_STATE_TRANSITION' USING ERRCODE='22023';END IF;
 UPDATE tto.commerce_demo_shareholder_drafts
 SET management_state=v_next,record_version=record_version+1 WHERE draft_id=p_draft;
 INSERT INTO tto.commerce_demo_nav02_management_audit(
  order_id,draft_id,actor_id,action,prior_version,new_version)
 VALUES(v_order,p_draft,tto.context_actor_id(),v_event,p_version,p_version+1);
 RETURN jsonb_build_object('id',p_draft,'version',p_version+1,
  'managementState',v_next,'officialMemberStatusChanged',false,
  'officialSharesLocked',false,'officialLedgerUpdated',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_change_state(
 text,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_change_state(
 text,uuid,bigint,text) TO tto_app;
COMMIT;
