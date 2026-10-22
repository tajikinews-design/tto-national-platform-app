-- 0004: supervised Tenant/Party commands; legal-hold release; hard-delete embargo.
-- Mandatory authorization: actor context set by verified session, NOT payload.
BEGIN;
ALTER TABLE tto.legal_holds ADD COLUMN released_by uuid REFERENCES tto.user_accounts(user_id);
ALTER TABLE tto.legal_holds ADD COLUMN release_evidence_id uuid;
CREATE OR REPLACE FUNCTION tto.transition_tenant(p_tenant uuid,p_from text,p_to text,p_version bigint,p_actor uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 BEGIN
 IF p_actor IS DISTINCT FROM tto.context_actor_id()
 OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR NOT tto.has_verified_authority(p_tenant,'TENANT_LIFECYCLE') THEN RETURN false; END IF;
 IF NOT ((p_from='PROVISIONING' AND p_to='SETUP_PENDING') OR
 (p_from='SETUP_PENDING' AND p_to='ACTIVE') OR
 (p_from='ACTIVE' AND p_to='SUSPENDED') OR
 (p_from='SUSPENDED' AND p_to='ACTIVE') OR
 (p_from='ACTIVE' AND p_to='TERMINATING') OR
 (p_from='SUSPENDED' AND p_to='TERMINATING') OR
 (p_from='TERMINATING' AND p_to='TERMINATED')) THEN RETURN false; END IF;
 UPDATE tto.tenants SET status=p_to,version=version+1 WHERE tenant_id=p_tenant
 AND status=p_from AND version=p_version;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO tto.tenant_status_history(history_id,tenant_id,from_status,to_status,actor_id)
 VALUES(gen_random_uuid(),p_tenant,p_from,p_to,p_actor);
 PERFORM tto.append_actor_audit(p_tenant,'TENANT_TRANSITION',p_tenant);
 RETURN true;
 END $f$;
CREATE OR REPLACE FUNCTION tto.merge_party_alias(p_old uuid,p_current uuid,p_tenant uuid,p_actor uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 BEGIN
 IF p_actor IS DISTINCT FROM tto.context_actor_id() OR
 p_tenant IS DISTINCT FROM tto.context_tenant_id() OR p_old=p_current OR
 NOT tto.has_verified_authority(p_tenant,'PARTY_MERGE') THEN RETURN false; END IF;
 PERFORM party_id FROM tto.parties WHERE party_id IN (p_old,p_current) ORDER BY party_id FOR UPDATE;
 IF (SELECT count(*) FROM tto.parties WHERE party_id IN (p_old,p_current))<>2
 OR EXISTS(SELECT 1 FROM tto.party_aliases WHERE old_party_id IN (p_old,p_current)
 OR current_party_id=p_old) THEN RETURN false; END IF;
 INSERT INTO tto.party_aliases(old_party_id,current_party_id) VALUES(p_old,p_current)
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM tto.append_actor_audit(p_tenant,'PARTY_ALIAS_MERGED',p_old);
 RETURN true;
 END $f$;
CREATE FUNCTION tto.release_legal_hold(p_hold uuid,p_evidence uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE h tto.legal_holds%ROWTYPE; BEGIN
 SELECT * INTO h FROM tto.legal_holds WHERE hold_id=p_hold FOR UPDATE;
 IF NOT FOUND OR h.released_at IS NOT NULL OR h.tenant_id<>tto.context_tenant_id()
 OR p_evidence IS NULL OR h.applied_by=tto.context_actor_id()
 OR NOT tto.has_verified_authority(h.tenant_id,'LEGAL_HOLD') THEN RETURN false; END IF;
 UPDATE tto.legal_holds SET released_at=clock_timestamp(),
  released_by=tto.context_actor_id(),release_evidence_id=p_evidence WHERE hold_id=p_hold;
 PERFORM tto.append_actor_audit(h.tenant_id,'LEGAL_HOLD_RELEASED',h.document_id);
 RETURN true;
 END $f$;
-- Disposition/retention policy Child-22 is not yet approved; disable hard deletion even after hold release.
DROP TRIGGER prevent_held_document_delete ON tto.documents;
CREATE FUNCTION tto.deny_document_hard_delete() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
 BEGIN RAISE EXCEPTION 'DOCUMENT_DISPOSITION_REQUIRES_CHILD22_POLICY'; END $f$;
CREATE TRIGGER deny_document_delete BEFORE DELETE ON tto.documents
 FOR EACH ROW EXECUTE FUNCTION tto.deny_document_hard_delete();
CREATE FUNCTION tto.legal_hold_release_guard() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
 BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HOLD_HISTORY_IMMUTABLE'; END IF;
 IF OLD.released_at IS NOT NULL OR NEW.released_at IS NULL
 OR NEW.released_by IS NULL OR NEW.release_evidence_id IS NULL OR
 NEW.hold_id<>OLD.hold_id OR NEW.tenant_id<>OLD.tenant_id OR
 NEW.document_id<>OLD.document_id OR NEW.applied_at<>OLD.applied_at OR
 NEW.applied_by<>OLD.applied_by OR NEW.rule_reference<>OLD.rule_reference OR
 NEW.reason<>OLD.reason THEN RAISE EXCEPTION 'INVALID_HOLD_RELEASE'; END IF;
 RETURN NEW;
 END $f$;
CREATE TRIGGER protected_hold_history BEFORE UPDATE OR DELETE ON tto.legal_holds
 FOR EACH ROW EXECUTE FUNCTION tto.legal_hold_release_guard();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tto FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.context_actor_id(),tto.context_tenant_id(),
 tto.has_tenant_role(uuid,text),tto.resolve_session(bytea),
 tto.consume_challenge(uuid,bytea,bytea),tto.revoke_own_sessions(),
 tto.has_verified_authority(uuid,text),tto.has_platform_operator(),
 tto.request_jit(uuid,text,timestamptz),tto.has_jit_access(uuid),
 tto.decide_jit(uuid,boolean),tto.revoke_role_assignment(uuid,bigint),
 tto.assign_tenant_role(uuid,uuid,text,uuid),
 tto.publish_document(uuid,uuid,integer),
 tto.place_legal_hold(uuid,text,text),tto.release_legal_hold(uuid,uuid),
 tto.transition_tenant(uuid,text,text,bigint,uuid),
 tto.merge_party_alias(uuid,uuid,uuid,uuid),
 tto.append_actor_audit(uuid,text,uuid) TO tto_app;
GRANT EXECUTE ON FUNCTION tto.record_scan_verdict(uuid,text,text,bytea,text) TO tto_scanner;
COMMIT;
