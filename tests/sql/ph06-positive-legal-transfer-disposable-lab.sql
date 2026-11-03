-- PH06 test-only positive transfer on disposable PostgreSQL17.
-- NEVER deploy. BEGIN ... ROLLBACK restores schema and all synthetic shares.
-- The production CHECK(state <> 'TRANSFERRED') remains intact.
-- All referenced board, valuation, bank and register records are synthetic.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA ph06_lab;
DO $lab$
DECLARE constraint_name text;
BEGIN
 SELECT conname INTO constraint_name FROM pg_constraint
 WHERE conrelid='tto.ph06_transfer_cases'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%state <>%' AND pg_get_constraintdef(oid) LIKE '%TRANSFERRED%'
 LIMIT 1;
 IF constraint_name IS NULL THEN RAISE EXCEPTION 'PH06_LAB_CANNOT_LOCATE_PRODUCTION_TRANSFER_BLOCKER';END IF;
 EXECUTE format('ALTER TABLE tto.ph06_transfer_cases DROP CONSTRAINT %I',constraint_name);
END $lab$;
CREATE TABLE ph06_lab.board_approvals(
 case_id uuid PRIMARY KEY REFERENCES tto.ph06_transfer_cases(case_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 decision text NOT NULL CHECK(decision IN('APPROVED','REJECTED')),
 meeting_reference text NOT NULL CHECK(length(meeting_reference)>8),
 resolution_reference text NOT NULL CHECK(length(resolution_reference)>8),
 legal_basis_reference text NOT NULL CHECK(length(legal_basis_reference)>8),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 entered_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 verified_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 verified_at timestamptz NOT NULL,
 CHECK(entered_by<>verified_by)
);
CREATE TABLE ph06_lab.valuation_sources(
 case_id uuid PRIMARY KEY REFERENCES tto.ph06_transfer_cases(case_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 report_ref text NOT NULL CHECK(length(report_ref)>8),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 status text NOT NULL CHECK(status IN('VALID','EXPIRED','SUSPENDED','SUPERSEDED')),
 valid_until timestamptz NOT NULL,
 verified_by uuid NOT NULL REFERENCES tto.user_accounts(user_id)
);
CREATE TABLE ph06_lab.transfer_gates(
 case_id uuid PRIMARY KEY REFERENCES tto.ph06_transfer_cases(case_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 legal_rule_version_id uuid NOT NULL REFERENCES tto.ph05_rule_versions(version_id),
 valuation_ref uuid NOT NULL REFERENCES ph06_lab.valuation_sources(case_id),
 board_ref uuid NOT NULL REFERENCES ph06_lab.board_approvals(case_id),
 buyer_eligibility_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 buyer_eligible boolean NOT NULL DEFAULT false,
 seller_confirmation_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 seller_payment_confirmed boolean NOT NULL DEFAULT false,
 mandatory_fee_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 mandatory_fees_resolved boolean NOT NULL DEFAULT false,
 register_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 register_reference text NOT NULL,
 register_recorded boolean NOT NULL DEFAULT false,
 registrar_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 open_disputes integer NOT NULL DEFAULT 0 CHECK(open_disputes>=0),
 issued_shares bigint NOT NULL CHECK(issued_shares>0),
 member_cap_basis_points integer NOT NULL CHECK(member_cap_basis_points BETWEEN 0 AND 10000),
 cap_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ph06_lab.transfer_completions(
 case_id uuid PRIMARY KEY REFERENCES tto.ph06_transfer_cases(case_id),
 ledger_out uuid NOT NULL UNIQUE REFERENCES tto.ph06_ownership_ledger(ledger_id),
 ledger_in uuid NOT NULL UNIQUE REFERENCES tto.ph06_ownership_ledger(ledger_id),
 register_reference text NOT NULL,
 finalized_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION ph06_lab.finalize_synthetic_transfer(
 p_case uuid,p_actor uuid,p_fault_after_seller_debit boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,tto,ph06_lab AS $f$
DECLARE c tto.ph06_transfer_cases%ROWTYPE; g ph06_lab.transfer_gates%ROWTYPE;
 v ph06_lab.valuation_sources%ROWTYPE;b ph06_lab.board_approvals%ROWTYPE;
 rv tto.ph05_rule_versions%ROWTYPE;locked bigint;held bigint;existing bigint;new_total numeric;
 out_id uuid;in_id uuid;
BEGIN
 IF p_case IS NULL OR p_actor IS NULL THEN RETURN 'BLOCKED';END IF;
 SELECT * INTO c FROM tto.ph06_transfer_cases WHERE case_id=p_case FOR UPDATE;
 IF NOT FOUND THEN RETURN 'BLOCKED';END IF;
 IF c.state='TRANSFERRED' THEN
   IF EXISTS(SELECT 1 FROM ph06_lab.transfer_completions WHERE case_id=p_case)
    THEN RETURN 'ALREADY_COMPLETED';END IF;
   RETURN 'BLOCKED';
 END IF;
 IF c.state<>'PAYMENT_VERIFIED' OR
  NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=c.tenant_id AND status='ACTIVE')
 THEN RETURN 'BLOCKED';END IF;
 SELECT * INTO g FROM ph06_lab.transfer_gates WHERE case_id=p_case FOR UPDATE;
 SELECT * INTO b FROM ph06_lab.board_approvals WHERE case_id=p_case;
 SELECT * INTO v FROM ph06_lab.valuation_sources WHERE case_id=p_case;
 IF NOT FOUND OR g.case_id IS NULL OR b.case_id IS NULL OR v.case_id IS NULL
  OR g.tenant_id<>c.tenant_id OR b.tenant_id<>c.tenant_id OR v.tenant_id<>c.tenant_id
  OR g.valuation_ref<>p_case OR g.board_ref<>p_case
  OR g.registrar_id<>p_actor
  OR b.decision<>'APPROVED' OR b.verified_by=p_actor
  OR b.entered_by=b.verified_by
  OR v.status<>'VALID' OR v.valid_until<=now()
  OR NOT g.buyer_eligible OR NOT g.seller_payment_confirmed
  OR NOT g.mandatory_fees_resolved OR NOT g.register_recorded
  OR length(trim(g.register_reference))<8 OR g.open_disputes<>0
  OR g.issued_shares<1 OR g.member_cap_basis_points<=0
  OR c.legal_rule_version_id IS DISTINCT FROM g.legal_rule_version_id
  OR c.valuation_source_ref IS DISTINCT FROM v.report_ref
 THEN RETURN 'BLOCKED';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.role_assignments a
 WHERE a.tenant_id=c.tenant_id AND a.user_id=p_actor
 AND a.role_code='COOPERATIVE_MANAGER' AND a.revoked_at IS NULL
 AND (a.expires_at IS NULL OR a.expires_at>now()))
 THEN RETURN 'BLOCKED';END IF;
 SELECT * INTO rv FROM tto.ph05_rule_versions WHERE version_id=g.legal_rule_version_id;
 IF NOT FOUND OR rv.status<>'ACTIVE' OR rv.effective_from>now()
  OR rv.candidate_disposition<>'REVIEW_REQUIRED'
  OR EXISTS(SELECT 1 FROM tto.ph05_legal_gates gg
    WHERE gg.gate_code=rv.rule_code AND gg.gate_status IN ('OPEN','BLOCKED'))
 THEN RETURN 'BLOCKED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.ph05_legal_source_refs s
   JOIN tto.evidence_references e ON e.evidence_id=s.evidence_id
   WHERE s.source_id=rv.source_id AND e.tenant_id=c.tenant_id)
 THEN RETURN 'BLOCKED';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.ph05_webhook_receipts r
 WHERE r.receipt_id=c.source_payment_receipt AND r.tenant_id=c.tenant_id
 AND r.signature_status='VERIFIED' AND octet_length(r.attestation_hash)=32)
 THEN RETURN 'BLOCKED';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=b.evidence_id AND e.tenant_id=c.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=v.evidence_id AND e.tenant_id=c.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=g.buyer_eligibility_evidence AND e.tenant_id=c.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=g.seller_confirmation_evidence AND e.tenant_id=c.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=g.mandatory_fee_evidence AND e.tenant_id=c.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=g.register_evidence AND e.tenant_id=c.tenant_id)
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE
   e.evidence_id=g.cap_evidence AND e.tenant_id=c.tenant_id)
 THEN RETURN 'BLOCKED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.tenant_id::text||':'||c.seller_party_id::text,0));
 SELECT coalesce(sum(delta_shares),0) INTO held FROM tto.ph06_ownership_ledger
 WHERE tenant_id=c.tenant_id AND party_id=c.seller_party_id;
 SELECT coalesce(sum(delta_shares),0) INTO existing FROM tto.ph06_ownership_ledger
 WHERE tenant_id=c.tenant_id AND party_id=c.buyer_party_id;
 SELECT coalesce(sum(quantity),0) INTO locked FROM tto.ph06_share_locks
 WHERE case_id=c.case_id AND tenant_id=c.tenant_id
 AND party_id=c.seller_party_id AND state='ACTIVE';
 IF locked<c.requested_quantity OR held<c.requested_quantity THEN RETURN 'BLOCKED';END IF;
 new_total:=existing::numeric+c.requested_quantity::numeric;
 IF new_total*10000 > g.issued_shares::numeric*g.member_cap_basis_points::numeric
 THEN RETURN 'BLOCKED';END IF;
 out_id:=gen_random_uuid();in_id:=gen_random_uuid();
 INSERT INTO tto.ph06_ownership_ledger(ledger_id,tenant_id,party_id,delta_shares,source_kind,source_reference)
 VALUES(out_id,c.tenant_id,c.seller_party_id,-c.requested_quantity,'LEGAL_TRANSFER',p_case);
 IF p_fault_after_seller_debit THEN RAISE EXCEPTION 'PH06_LAB_INJECTED_ATOMIC_ROLLBACK';END IF;
 INSERT INTO tto.ph06_ownership_ledger(ledger_id,tenant_id,party_id,delta_shares,source_kind,source_reference)
 VALUES(in_id,c.tenant_id,c.buyer_party_id,c.requested_quantity,'LEGAL_TRANSFER',p_case);
 UPDATE tto.ph06_share_locks SET state='RELEASED' WHERE case_id=p_case AND state='ACTIVE';
 UPDATE tto.ph06_transfer_cases SET state='TRANSFERRED' WHERE case_id=p_case;
 INSERT INTO tto.audit_events(audit_id,tenant_id,actor_id,event_name,target_id)
 VALUES(gen_random_uuid(),c.tenant_id,p_actor,'PH06_SYNTHETIC_LEGAL_TRANSFER_COMPLETED',p_case);
 INSERT INTO ph06_lab.transfer_completions(case_id,ledger_out,ledger_in,register_reference,finalized_by)
 VALUES(p_case,out_id,in_id,g.register_reference,p_actor);
 RETURN 'COMPLETED';
END $f$;
REVOKE ALL ON FUNCTION ph06_lab.finalize_synthetic_transfer(uuid,uuid,boolean) FROM PUBLIC,tto_app;
-- Synthetic users, parties and exact evidence/source links.
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('d6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ph06-positive-only','Synthetic Cooperative','ACTIVE');
INSERT INTO tto.user_accounts(user_id) VALUES
 ('d6111111-1111-4111-8111-111111111111'),
 ('d6222222-2222-4222-8222-222222222222'),
 ('d6333333-3333-4333-8333-333333333333');
INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES
 ('d6444444-4444-4444-8444-444444444441','PERSON','Synthetic Owner'),
 ('d6444444-4444-4444-8444-444444444442','PERSON','Synthetic Buyer');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES
 ('d6555555-5555-4555-8555-555555555555',
 'd6111111-1111-4111-8111-111111111111',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','COOPERATIVE_MANAGER');
INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id)
 SELECT ('d6'||lpad(i::text,6,'0')||'-1111-4111-8111-111111111111')::uuid,
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','SYNTHETIC_PH06_LAB',gen_random_uuid()
 FROM generate_series(1,9) i;
INSERT INTO tto.ph05_legal_source_refs(source_id,citation,authority_label,evidence_id,verified_by,verified_at)
 VALUES('d6666666-6666-4666-8666-666666666666',
 'PH06 synthetic legal-rule reference, NOT authentic law','Synthetic approval fixture',
 'd6000001-1111-4111-8111-111111111111',
 'd6333333-3333-4333-8333-333333333333',now());
INSERT INTO tto.ph05_rule_versions(version_id,rule_code,rule_version,source_id,effective_from,
 candidate_disposition,status,created_by,approved_by)
 VALUES('d6777777-7777-4777-8777-777777777777',
 'PH06_LAB_TRANSFER',1,'d6666666-6666-4666-8666-666666666666',
 now()-interval '2 days','REVIEW_REQUIRED','ACTIVE',
 'd6333333-3333-4333-8333-333333333333',
 'd6222222-2222-4222-8222-222222222222');
INSERT INTO tto.ph05_webhook_receipts(receipt_id,tenant_id,integration_code,
 external_event_id,signature_status,attestation_hash)
 VALUES
 ('d6888888-8888-4888-8888-888888888881',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','PH06_SYNTHETIC_BANK','ph06-syn-bank-ok-1',
 'VERIFIED',decode(repeat('aa',32),'hex')),
 ('d6888888-8888-4888-8888-888888888882',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','PH06_SYNTHETIC_BANK','ph06-syn-bank-unverified-2',
 'UNVERIFIED',NULL);
INSERT INTO tto.ph06_ownership_ledger(ledger_id,tenant_id,party_id,delta_shares,source_kind,source_reference)
 VALUES
 ('d6999999-9999-4999-8999-999999999991',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','d6444444-4444-4444-8444-444444444441',
 40,'OPENING_VERIFIED','d6bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
 ('d6999999-9999-4999-8999-999999999992',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','d6444444-4444-4444-8444-444444444442',
 10,'OPENING_VERIFIED','d6bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
INSERT INTO tto.ph06_transfer_cases(case_id,tenant_id,seller_party_id,buyer_party_id,
 requested_quantity,state,valuation_source_ref,legal_rule_version_id,
 privileged_actor_id,legal_approver_id,source_payment_receipt)
 VALUES('d6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'd6444444-4444-4444-8444-444444444441',
 'd6444444-4444-4444-8444-444444444442',
 20,'REQUESTED','PH06-SYNTHETIC-VALUATION-2026',
 'd6777777-7777-4777-8777-777777777777',
 'd6111111-1111-4111-8111-111111111111',
 'd6222222-2222-4222-8222-222222222222',
 'd6888888-8888-4888-8888-888888888881');
DO $ready$
BEGIN
 IF NOT tto.ph06_try_lock_shares(
  'd6cccccc-cccc-4ccc-8ccc-cccccccccccc',
  'd6dddddd-dddd-4ddd-8ddd-dddddddddddd')
 THEN RAISE EXCEPTION 'PH06_LAB_SHARE_LOCK_FAILED';END IF;
END $ready$;
UPDATE tto.ph06_transfer_cases SET state='PAYMENT_VERIFIED'
 WHERE case_id='d6cccccc-cccc-4ccc-8ccc-cccccccccccc';
INSERT INTO ph06_lab.board_approvals(case_id,tenant_id,decision,meeting_reference,
 resolution_reference,legal_basis_reference,evidence_id,entered_by,verified_by,verified_at)
 VALUES('d6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','APPROVED',
 'PH06_SYNTHETIC_BOARD_MEETING','PH06_SYNTHETIC_BOARD_RESOLUTION',
 'PH06_SYNTHETIC_STATUTORY_REF','d6000002-1111-4111-8111-111111111111',
 'd6333333-3333-4333-8333-333333333333',
 'd6222222-2222-4222-8222-222222222222',now());
INSERT INTO ph06_lab.valuation_sources(case_id,tenant_id,report_ref,evidence_id,status,valid_until,verified_by)
 VALUES('d6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'PH06-SYNTHETIC-VALUATION-2026','d6000003-1111-4111-8111-111111111111',
 'VALID',now()+interval '7 days','d6222222-2222-4222-8222-222222222222');
INSERT INTO ph06_lab.transfer_gates(
 case_id,tenant_id,legal_rule_version_id,valuation_ref,board_ref,
 buyer_eligibility_evidence,buyer_eligible,seller_confirmation_evidence,seller_payment_confirmed,
 mandatory_fee_evidence,mandatory_fees_resolved,register_evidence,register_reference,
 register_recorded,registrar_id,open_disputes,issued_shares,member_cap_basis_points,cap_evidence)
 VALUES('d6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'd6777777-7777-4777-8777-777777777777',
 'd6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6000004-1111-4111-8111-111111111111',true,
 'd6000005-1111-4111-8111-111111111111',true,
 'd6000006-1111-4111-8111-111111111111',true,
 'd6000007-1111-4111-8111-111111111111','PH06_SYNTHETIC_SHARE_REGISTER_22',true,
 'd6111111-1111-4111-8111-111111111111',0,10000,100,
 'd6000008-1111-4111-8111-111111111111');
-- Fail-closed subtests, no effects when source evidence is absent.
DO $negative$
DECLARE cid uuid:='d6cccccc-cccc-4ccc-8ccc-cccccccccccc';
 a uuid:='d6111111-1111-4111-8111-111111111111';r text;
BEGIN
 UPDATE ph06_lab.valuation_sources SET valid_until=now()-interval '1 hour' WHERE case_id=cid;
 r:=ph06_lab.finalize_synthetic_transfer(cid,a);
 IF r<>'BLOCKED' THEN RAISE EXCEPTION 'PH06_EXPIRED_VALUATION_ACCEPTED';END IF;
 UPDATE ph06_lab.valuation_sources SET valid_until=now()+interval '7 days' WHERE case_id=cid;
 UPDATE ph06_lab.transfer_gates SET member_cap_basis_points=20 WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_POST_TRANSFER_OWNERSHIP_CAP_EXCEEDED';END IF;
 UPDATE ph06_lab.transfer_gates SET member_cap_basis_points=100 WHERE case_id=cid;
 UPDATE ph06_lab.board_approvals SET decision='REJECTED' WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_REJECTED_BOARD_APPROVAL_ACCEPTED';END IF;
 UPDATE ph06_lab.board_approvals SET decision='APPROVED',verified_by=a WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_SOD_SELF_APPROVAL_ACCEPTED';END IF;
 UPDATE ph06_lab.board_approvals SET verified_by='d6222222-2222-4222-8222-222222222222' WHERE case_id=cid;
 UPDATE tto.ph06_transfer_cases SET source_payment_receipt='d6888888-8888-4888-8888-888888888882'
 WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_UNVERIFIED_BANK_CALLBACK_ACCEPTED';END IF;
 UPDATE tto.ph06_transfer_cases SET source_payment_receipt='d6888888-8888-4888-8888-888888888881'
 WHERE case_id=cid;
 UPDATE ph06_lab.transfer_gates SET mandatory_fees_resolved=false WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_UNRESOLVED_MANDATORY_FEES_ACCEPTED';END IF;
 UPDATE ph06_lab.transfer_gates SET mandatory_fees_resolved=true,register_recorded=false WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_MISSING_REGISTER_ENTRY_ACCEPTED';END IF;
 UPDATE ph06_lab.transfer_gates SET register_recorded=true,open_disputes=1 WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_DISPUTED_TRANSFER_ACCEPTED';END IF;
 UPDATE ph06_lab.transfer_gates SET open_disputes=0,seller_payment_confirmed=false WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,a)<>'BLOCKED' THEN
 RAISE EXCEPTION 'PH06_SELLER_NOT_CONFIRMING_PAYMENT_ACCEPTED';END IF;
 UPDATE ph06_lab.transfer_gates SET seller_payment_confirmed=true WHERE case_id=cid;
 IF ph06_lab.finalize_synthetic_transfer(cid,'d6333333-3333-4333-8333-333333333333')<>'BLOCKED'
 THEN RAISE EXCEPTION 'PH06_NON_PRIVILEGED_REGISTRAR_ACCEPTED';END IF;
 IF EXISTS(SELECT 1 FROM tto.ph06_ownership_ledger WHERE source_kind='LEGAL_TRANSFER')
 OR EXISTS(SELECT 1 FROM ph06_lab.transfer_completions)
 THEN RAISE EXCEPTION 'PH06_DENIED_ATTEMPT_MUTATED_OWNERSHIP';END IF;
END $negative$;
SELECT 'PH06_POSITIVE_LAB_ALL_NEGATIVE_LEGAL_GATES_BLOCKED_PASS' AS signal;
-- Fault injection must roll back debit and leave pending case/locked shares.
DO $fault$
DECLARE err text;
BEGIN
 BEGIN
 PERFORM ph06_lab.finalize_synthetic_transfer(
 'd6cccccc-cccc-4ccc-8ccc-cccccccccccc',
 'd6111111-1111-4111-8111-111111111111',true);
 RAISE EXCEPTION 'PH06_FAULT_INJECTION_DID_NOT_RAISE';
 EXCEPTION WHEN raise_exception THEN
 GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
 IF err<>'PH06_LAB_INJECTED_ATOMIC_ROLLBACK' THEN RAISE;END IF;
 END;
 IF EXISTS(SELECT 1 FROM tto.ph06_ownership_ledger WHERE source_kind='LEGAL_TRANSFER')
 OR EXISTS(SELECT 1 FROM ph06_lab.transfer_completions)
 OR (SELECT count(*) FROM tto.ph06_share_locks WHERE state='ACTIVE')<>1
 THEN RAISE EXCEPTION 'PH06_FAULT_DID_NOT_ROLLBACK_ALL_CHANGES';END IF;
END $fault$;
SELECT 'PH06_POSITIVE_LAB_ATOMIC_FAILURE_ROLLBACK_PASS' AS signal;
-- Positive completion changes only disposable ledger and is idempotent.
DO $success$
DECLARE cid uuid:='d6cccccc-cccc-4ccc-8ccc-cccccccccccc';actor uuid:='d6111111-1111-4111-8111-111111111111';
 seller bigint;buyer bigint;entry_count int;audits int;
BEGIN
 IF ph06_lab.finalize_synthetic_transfer(cid,actor)<>'COMPLETED' THEN
 RAISE EXCEPTION 'PH06_SYNTHETIC_POSITIVE_COMPLETION_BLOCKED';END IF;
 IF ph06_lab.finalize_synthetic_transfer(cid,actor)<>'ALREADY_COMPLETED' THEN
 RAISE EXCEPTION 'PH06_DUPLICATE_FINALIZE_NOT_IDEMPOTENT';END IF;
 SELECT coalesce(sum(delta_shares),0) INTO seller FROM tto.ph06_ownership_ledger
 WHERE tenant_id='d6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND party_id='d6444444-4444-4444-8444-444444444441';
 SELECT coalesce(sum(delta_shares),0) INTO buyer FROM tto.ph06_ownership_ledger
 WHERE tenant_id='d6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND party_id='d6444444-4444-4444-8444-444444444442';
 SELECT count(*) INTO entry_count FROM tto.ph06_ownership_ledger
 WHERE source_kind='LEGAL_TRANSFER' AND source_reference=cid;
 SELECT count(*) INTO audits FROM tto.audit_events
 WHERE event_name='PH06_SYNTHETIC_LEGAL_TRANSFER_COMPLETED' AND target_id=cid;
 IF seller<>20 OR buyer<>30 OR seller+buyer<>50 OR entry_count<>2 OR audits<>1
 OR (SELECT state FROM tto.ph06_transfer_cases WHERE case_id=cid)<>'TRANSFERRED'
 OR (SELECT state FROM tto.ph06_share_locks WHERE case_id=cid)<>'RELEASED'
 OR (SELECT count(*) FROM ph06_lab.transfer_completions WHERE case_id=cid)<>1
 THEN RAISE EXCEPTION 'PH06_POSITIVE_NONATOMIC_OR_DUPLICATE_OR_NONCONSERVING_TRANSFER';END IF;
END $success$;
SELECT 'PH06_POSITIVE_LAB_BOARD_VALUATION_CAP_SOD_PAYMENT_REGISTER_FEES_PASS' AS signal;
SELECT 'PH06_POSITIVE_LAB_ATOMIC_LEDGER_TWO_ENTRIES_AUDIT_LOCK_RELEASE_PASS' AS signal;
SELECT 'PH06_POSITIVE_LAB_IDEMPOTENT_FINALIZATION_PASS' AS signal;
ROLLBACK;
SELECT 'PH06_POSITIVE_LAB_SCHEMA_AND_SHARES_ROLLED_BACK_NO_REAL_TRANSFER' AS signal;
