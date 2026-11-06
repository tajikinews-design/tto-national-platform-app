-- PH12 CHILD06+07 canonical forward-schema / source boundary acceptance (synthetic only).
-- Fails closed on legal transfer, cross tenant references and anonymous app privileges.
\set ON_ERROR_STOP on
BEGIN;
DO $scenario$
DECLARE
 t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid();
 p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid();
 a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid(); a3 uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid();
 e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); e3 uuid:=gen_random_uuid();
 d1 uuid:=gen_random_uuid(); src uuid:=gen_random_uuid(); ruleid uuid:=gen_random_uuid();
 rv uuid:=gen_random_uuid(); val uuid:=gen_random_uuid(); ord uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid(); cs uuid:=gen_random_uuid(); ld uuid:=gen_random_uuid();
 rel uuid:=gen_random_uuid(); changed bigint;
BEGIN
 INSERT INTO tto.user_accounts(user_id) VALUES(actor);
 INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
 (t1,'ph12-child0607-one-'||substr(t1::text,1,8),'PH12 Synthetic A','ACTIVE'),
 (t2,'ph12-child0607-two-'||substr(t2::text,1,8),'PH12 Synthetic B','ACTIVE');
 INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES
 (p1,'PERSON','PH12 seller'),(p2,'PERSON','PH12 non-member shareholder'),
 (p3,'PERSON','PH12 foreign tenant');
 INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id) VALUES
 (e1,t1,'PH12_DISPOSABLE',gen_random_uuid()),
 (e2,t1,'PH12_DISPOSABLE',gen_random_uuid()),
 (e3,t2,'PH12_DISPOSABLE',gen_random_uuid());
 INSERT INTO tto.ph05_legal_source_refs(source_id,citation,authority_label,evidence_id,verified_by,verified_at)
 VALUES(src,'PH12 test-only source not legal permission','PH12 Test',e1,actor,now());
 INSERT INTO tto.ph05_rule_versions(version_id,rule_code,rule_version,source_id,effective_from,candidate_disposition,status,created_by)
 VALUES(ruleid,'PH12_SHARE_CLASS',1,src,now(),'REVIEW_REQUIRED','DRAFT',actor);
 INSERT INTO tto.ph06_shareholder_accounts(account_id,tenant_id,party_id,status,shareholder_type,
  classification_evidence_id,classification_rule_version_id,classification_source_ref)
 VALUES
 (a1,t1,p1,'ACTIVE','MEMBER',e1,ruleid,'PH12_MEMBER_TEST'),
 (a2,t1,p2,'ACTIVE','NON_MEMBER',e2,ruleid,'PH12_NONMEMBER_TEST'),
 (a3,t2,p3,'ACTIVE',NULL,NULL,NULL,NULL);
 IF EXISTS(SELECT 1 FROM tto.child06_cooperative_relationships WHERE tenant_id=t1 AND party_id=p2)
 OR EXISTS(SELECT 1 FROM tto.role_assignments WHERE tenant_id=t1)
 THEN RAISE EXCEPTION 'PH12_NONMEMBER_IMPLICIT_MEMBERSHIP_OR_ROLE';END IF;

 -- Authoritative relationship is separate from account and CF02 projection.
 INSERT INTO tto.child06_cooperative_relationships(relationship_id,tenant_id,party_id,
  relationship_type,status,valid_from,basis_ref,source_event_id,source_version)
 VALUES(rel,t1,p1,'MEMBER','ACTIVE',now()-interval '2 days',e1,gen_random_uuid(),1);
 BEGIN
  INSERT INTO tto.child06_cooperative_relationships(relationship_id,tenant_id,party_id,
   relationship_type,status,valid_from,basis_ref,source_event_id,source_version)
  VALUES(gen_random_uuid(),t1,p1,'MEMBER','SUSPENDED',now(),e1,gen_random_uuid(),3);
  RAISE EXCEPTION 'PH12_CHILD06_VERSION_GAP_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CHILD06_STALE_OR_GAPPED_SOURCE_VERSION' THEN RAISE;END IF;
 END;
 INSERT INTO tto.child06_cooperative_relationships(relationship_id,tenant_id,party_id,
  relationship_type,status,valid_from,basis_ref,source_event_id,source_version)
 VALUES(gen_random_uuid(),t1,p1,'MEMBER','SUSPENDED',now(),e1,gen_random_uuid(),2);
 SELECT count(*) INTO changed FROM tto.child06_cooperative_relationships WHERE party_id=p1;
 IF changed<>2 THEN RAISE EXCEPTION 'PH12_CHILD06_RELATION_HISTORY_INCOMPLETE';END IF;

 -- Member profile source reference, no raw PII and no cross-tenant evidence.
 INSERT INTO tto.child06_member_profiles(tenant_id,party_id,member_no,classification,source_evidence_id)
 VALUES(t1,p1,'PH12-SYNTH-1','MEMBER',e1);
 BEGIN
  INSERT INTO tto.child06_member_profiles(tenant_id,party_id,member_no,classification,source_evidence_id)
  VALUES(t2,p3,'PH12-SYNTH-2','MEMBER',e2);
  RAISE EXCEPTION 'PH12_CROSS_TENANT_EVIDENCE_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;

 INSERT INTO tto.documents(document_id,tenant_id,title,classification)
 VALUES(d1,t1,'PH12 synthetic valuation','RESTRICTED');
 INSERT INTO tto.child07_valuation_reports(valuation_id,tenant_id,document_ref,expert_ref,
  value_amount,valid_from,valid_to,status,evidence_id)
 VALUES(val,t1,d1,'PH12_NOT_A_REAL_EXPERT',1000,now()-interval '1 day',
  now()+interval '1 day','DRAFT',e1);
 INSERT INTO tto.child07_sell_orders(sell_order_id,tenant_id,seller_account_id,qty,valuation_id)
 VALUES(ord,t1,a1,5,val);
 INSERT INTO tto.child07_buy_requests(buy_request_id,tenant_id,buyer_account_id,sell_order_id,qty)
 VALUES(req,t1,a2,ord,3);
 INSERT INTO tto.child07_transfer_cases(case_id,tenant_id,seller_account_id,buyer_account_id,
 qty,sell_order_id,buy_request_id,valuation_id,status)
 VALUES(cs,t1,a1,a2,3,ord,req,val,'REQUESTED');
 INSERT INTO tto.child07_share_locks(lock_id,tenant_id,owner_account_id,qty,source_case_ref)
 VALUES(gen_random_uuid(),t1,a1,3,cs);
 IF (SELECT status FROM tto.child07_share_locks WHERE source_case_ref=cs)<>'STAGED'
 THEN RAISE EXCEPTION 'PH12_LOCK_INCORRECTLY_ACTIVATED';END IF;

 -- Seller from another tenant cannot be wired into a local contract.
 BEGIN
  INSERT INTO tto.child07_sell_orders(sell_order_id,tenant_id,seller_account_id,qty,valuation_id)
  VALUES(gen_random_uuid(),t1,a3,2,val);
  RAISE EXCEPTION 'PH12_CROSS_TENANT_SHARE_SELL_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO tto.child07_transfer_cases(case_id,tenant_id,seller_account_id,buyer_account_id,qty)
  VALUES(gen_random_uuid(),t1,a3,a2,1);
  RAISE EXCEPTION 'PH12_CROSS_TENANT_TRANSFER_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;

 -- Reject missing independent classification provenance.
 BEGIN
  INSERT INTO tto.ph06_shareholder_accounts(account_id,tenant_id,party_id,
   shareholder_type,classification_evidence_id,classification_rule_version_id)
  VALUES(gen_random_uuid(),t1,p3,'NON_MEMBER',e1,ruleid);
  RAISE EXCEPTION 'PH12_UNSOURCED_CLASSIFICATION_ACCEPTED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;

 -- A sourced, classified NON_MEMBER may have synthetic *opening* shares,
 -- but there is no automatic membership/role/voting right.
 INSERT INTO tto.child07_ownership_ledger_entries(entry_id,tenant_id,
  shareholder_account_id,share_qty,direction,source_kind,source_reference,effective_at,evidence_id)
 VALUES(ld,t1,a2,12,'CREDIT','OPENING_VERIFIED',gen_random_uuid(),now(),e2);
 IF EXISTS(SELECT 1 FROM tto.child06_cooperative_relationships WHERE party_id=p2)
 OR EXISTS(SELECT 1 FROM tto.role_assignments WHERE tenant_id=t1)
 THEN RAISE EXCEPTION 'PH12_SHARE_ENTITLEMENT_LEAK';END IF;
 -- Unclassified account must never acquire a canonical ledger entry.
 BEGIN
  INSERT INTO tto.child07_ownership_ledger_entries(entry_id,tenant_id,
   shareholder_account_id,share_qty,direction,source_kind,source_reference,effective_at,evidence_id)
  VALUES(gen_random_uuid(),t2,a3,1,'CREDIT','OPENING_VERIFIED',gen_random_uuid(),now(),e3);
  RAISE EXCEPTION 'PH12_UNCLASSIFIED_LEDGER_ACCEPTED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'CHILD07_UNCLASSIFIED_OR_INACTIVE_ACCOUNT' THEN RAISE;END IF;
 END;
 -- The independent official ledger refuses LEGAL_TRANSFER even with case evidence.
 BEGIN
  INSERT INTO tto.child07_ownership_ledger_entries(entry_id,tenant_id,
   shareholder_account_id,share_qty,direction,source_kind,source_reference,
   source_case_ref,effective_at,evidence_id)
  VALUES(gen_random_uuid(),t1,a1,2,'DEBIT','LEGAL_TRANSFER',gen_random_uuid(),cs,now(),e1);
  RAISE EXCEPTION 'PH12_REAL_TRANSFER_LEDGER_ENABLED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE tto.child07_ownership_ledger_entries SET share_qty=999 WHERE entry_id=ld;
  RAISE EXCEPTION 'PH12_LEDGER_MUTABLE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE;END IF;
 END;
 BEGIN
  UPDATE tto.child06_cooperative_relationships SET status='ENDED' WHERE relationship_id=rel;
  RAISE EXCEPTION 'PH12_MEMBERSHIP_HISTORY_MUTABLE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE;END IF;
 END;
 IF tto.ph06_try_finalize_transfer(cs,actor) THEN
  RAISE EXCEPTION 'PH12_LEGACY_TRANSFER_FINALIZE_UNBLOCKED';END IF;
 -- No app CRUD privileges on any new canonical entity or classification write.
 IF has_table_privilege('tto_app','tto.child07_ownership_ledger_entries','INSERT')
 OR has_table_privilege('tto_app','tto.child07_ownership_ledger_entries','SELECT')
 OR has_table_privilege('tto_app','tto.child06_cooperative_relationships','UPDATE')
 OR has_table_privilege('tto_app','tto.ph06_shareholder_accounts','UPDATE')
 THEN RAISE EXCEPTION 'PH12_RUNTIME_PRIVILEGE_LEAK';END IF;
 IF EXISTS(SELECT 1 FROM tto.child07_transfer_cases WHERE status='TRANSFERRED')
 THEN RAISE EXCEPTION 'PH12_TRANSFERRED_STATE_EXISTS';END IF;
END $scenario$;
SELECT 'PH12_CHILD06_07_ACCOUNT_LEDGER_NONMEMBER_TENANT_ISOLATION_BLOCKED_TRANSFER_PASS';
ROLLBACK;
SELECT 'PH12_CHILD06_07_ALL_SYNTHETIC_ROWS_ROLLED_BACK_NO_REAL_SHARES';
