-- PH12 database catalog regression: run AFTER migration 0049 on disposable PG17.
-- Fails loudly if someone removes the HOLD-only schema or grants direct app writes.
BEGIN;
DO $$
DECLARE
  expression_text text;
  app_can_insert boolean;
  app_can_update boolean;
  app_can_delete boolean;
  active_count integer;
BEGIN
 IF to_regclass('tto.ph12_tariff_board_legal_source_checks') IS NULL
 THEN RAISE EXCEPTION 'PH12_0049_MISSING'; END IF;
 SELECT has_table_privilege('tto_app','tto.ph12_tariff_board_legal_source_checks','INSERT'),
        has_table_privilege('tto_app','tto.ph12_tariff_board_legal_source_checks','UPDATE'),
        has_table_privilege('tto_app','tto.ph12_tariff_board_legal_source_checks','DELETE')
 INTO app_can_insert,app_can_update,app_can_delete;
 IF app_can_insert OR app_can_update OR app_can_delete
 THEN RAISE EXCEPTION 'PH12_APP_DIRECT_WRITE_EXPOSED'; END IF;
 IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
         WHERE oid='tto.ph12_tariff_board_legal_source_checks'::regclass)
 THEN RAISE EXCEPTION 'PH12_RLS_NOT_FORCED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger
   WHERE tgrelid='tto.ph12_tariff_board_legal_source_checks'::regclass
     AND tgname='ph12_board_legal_checks_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'PH12_IMMUTABLE_TRIGGER_MISSING'; END IF;
 SELECT count(*) INTO active_count
 FROM pg_constraint c
 WHERE c.conrelid='tto.ph12_tariff_board_legal_source_checks'::regclass
 AND c.contype='c'
 AND pg_get_constraintdef(c.oid) LIKE '%PENDING_OFFICIAL_VERIFICATION%'
 AND pg_get_constraintdef(c.oid) LIKE '%SOURCE_REJECTED%';
 IF active_count=0 THEN RAISE EXCEPTION 'PH12_HOLD_CHECK_MISSING'; END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint c
 WHERE c.conrelid='tto.ph12_tariff_drafts'::regclass
 AND c.contype='c' AND pg_get_constraintdef(c.oid) ILIKE '%ACTIVE%')
 THEN RAISE EXCEPTION 'PH12_UNEXPECTED_DRAFT_ACTIVE_CONTRACT'; END IF;
END $$;
ROLLBACK;
