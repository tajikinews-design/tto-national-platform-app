-- Manual, one-time repair ONLY in the user's connected tto-national-preview-db.
-- Explicit user request: remove the old workspace slug from the ONE existing
-- Torghabeh member number. The current revision already specifies blank
-- prefix/suffix. Preserve historic registry numbers; do not reissue/alter
-- any other cooperative, draft, or serial. This is NOT an automatic migration.
DO $repair$
DECLARE v_order uuid; v_draft uuid; v_revision uuid; v_number text;
        v_serial bigint; v_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('NAV02_PREVIEW_TORGHABEH_NUMBER_REPAIR', 0));
  SELECT order_id INTO STRICT v_order FROM tto.commerce_demo_orders WHERE slug='torghabeh';
  SELECT count(*) INTO v_count FROM tto.nav02_member_number_current WHERE order_id=v_order;
  IF v_count<>1 THEN RAISE EXCEPTION 'EXPECTED_ONE_CURRENT_NUMBER_ONLY'; END IF;
  SELECT draft_id,revision_id,member_number,serial
    INTO STRICT v_draft,v_revision,v_number,v_serial
  FROM tto.nav02_member_number_current WHERE order_id=v_order FOR UPDATE;
  IF v_number='001003' AND v_serial=1003 THEN RETURN; END IF;
  IF v_number<>'torghabeh-001003' OR v_serial<>1003 OR
     NOT EXISTS(SELECT 1 FROM tto.nav02_member_number_policy
                WHERE order_id=v_order AND prefix='' AND suffix='' AND next_serial=1004) OR
     NOT EXISTS(SELECT 1 FROM tto.nav02_member_number_revisions
                WHERE revision_id=v_revision AND order_id=v_order AND
                      prefix='' AND suffix='' AND starting_serial=1003) OR
     EXISTS(SELECT 1 FROM tto.nav02_member_number_history
                WHERE order_id=v_order AND member_number=v_number) OR
     EXISTS(SELECT 1 FROM tto.nav02_member_number_current
                WHERE order_id=v_order AND member_number='001003') OR
     EXISTS(SELECT 1 FROM tto.nav02_member_number_registry
                WHERE order_id=v_order AND member_number='001003')
  THEN RAISE EXCEPTION 'PREVIEW_MEMBER_NUMBER_UNEXPECTED_STATE'; END IF;
  INSERT INTO tto.nav02_member_number_history(order_id,draft_id,revision_id,member_number)
  VALUES(v_order,v_draft,v_revision,v_number);
  UPDATE tto.nav02_member_number_current
   SET member_number='001003',assigned_at=clock_timestamp()
   WHERE order_id=v_order AND draft_id=v_draft AND member_number=v_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'PREVIEW_MEMBER_NUMBER_REPAIR_FAILED'; END IF;
END $repair$;
