-- Synthetic concurrency setup: commits only into throwaway container destroyed after CI.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('b6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ph06-race-tenant','Synthetic race tenant','ACTIVE');
INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES
 ('b6444444-4444-4444-8444-444444444441','PERSON','Synthetic race seller'),
 ('b6444444-4444-4444-8444-444444444442','PERSON','Synthetic race buyer');
INSERT INTO tto.ph06_ownership_ledger(ledger_id,tenant_id,party_id,delta_shares,source_kind,source_reference)
 VALUES('b6999999-9999-4999-8999-999999999999',
 'b6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'b6444444-4444-4444-8444-444444444441',10,
 'OPENING_VERIFIED','b6bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.ph06_transfer_cases
(case_id,tenant_id,seller_party_id,buyer_party_id,requested_quantity)
 VALUES
 ('b6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
 'b6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'b6444444-4444-4444-8444-444444444441',
 'b6444444-4444-4444-8444-444444444442',7),
 ('b6cccccc-cccc-4ccc-8ccc-ccccccccccc2',
 'b6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'b6444444-4444-4444-8444-444444444441',
 'b6444444-4444-4444-8444-444444444442',6);
COMMIT;
