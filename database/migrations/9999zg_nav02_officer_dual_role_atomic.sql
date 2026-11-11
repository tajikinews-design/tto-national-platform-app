-- NAV02 preview: one member may simultaneously hold a board role AND CEO.
-- Both role records share the SAME member draft ID but maintain independent
-- version, appointment, signing-authority and archive histories.
-- No legal appointment or signing privilege is created.
BEGIN;
CREATE FUNCTION tto.nav02_office_holder_dual_draft_create(
 p_slug text,p_member uuid,p_board_office text,
 p_signing boolean,p_scope text,p_start date,p_end date,
 p_gazette_name text,p_gazette_date date,p_gazette_issue text,p_notice text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_board uuid;v_ceo uuid;
BEGIN
 IF p_member IS NULL OR p_board_office IS NULL OR
    p_board_office NOT IN ('BOARD_CHAIR','BOARD_VICE_CHAIR','BOARD_MEMBER') THEN
  RAISE EXCEPTION 'INVALID_BOARD_CEO_COMBINATION' USING ERRCODE='22023';
 END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_start>p_end THEN
  RAISE EXCEPTION 'INVALID_ROLE_DATES' USING ERRCODE='22023';
 END IF;
 v_order:=tto.nav02_member_owner_order(p_slug);
 -- Avoid two simultaneous dual-role requests for the same scoped identity.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_order::text||':'||p_member::text,0));
 IF EXISTS(SELECT 1 FROM tto.nav02_office_holder_drafts x
   WHERE x.order_id=v_order AND x.member_draft_id=p_member
    AND x.office_code IN (p_board_office,'CEO') AND x.archived_at IS NULL
    AND pg_catalog.daterange(x.start_date,x.end_date,'[]')
       && pg_catalog.daterange(p_start,p_end,'[]')) THEN
  RAISE EXCEPTION 'ROLE_ALREADY_RECORDED_FOR_PERIOD' USING ERRCODE='23505';
 END IF;
 -- Membership/owner fence is rechecked by BOTH existing SECDEF functions.
 SELECT tto.nav02_office_holder_draft_create(p_slug,p_member,NULL,'MEMBER',
  p_board_office,p_signing,p_scope,p_start,p_end,
  p_gazette_name,p_gazette_date,p_gazette_issue,p_notice) INTO v_board;
 -- CEO signing is deliberately FALSE: distinct authority must be recorded
 -- and reviewed independently, never inherited from the board seat.
 SELECT tto.nav02_office_holder_draft_create(p_slug,p_member,NULL,'MEMBER',
  'CEO',false,'',p_start,p_end,p_gazette_name,p_gazette_date,
  p_gazette_issue,p_notice) INTO v_ceo;
 RETURN jsonb_build_object('saved',true,'ids',jsonb_build_array(v_board,v_ceo),
  'officeCodes',jsonb_build_array(p_board_office,'CEO'),'status','DRAFT_ONLY',
  'legalPowerGranted',false);
END $f$;
REVOKE ALL ON FUNCTION tto.nav02_office_holder_dual_draft_create(
 text,uuid,text,boolean,text,date,date,text,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.nav02_office_holder_dual_draft_create(
 text,uuid,text,boolean,text,date,date,text,date,text,text) TO tto_app;
COMMENT ON FUNCTION tto.nav02_office_holder_dual_draft_create(
 text,uuid,text,boolean,text,date,date,text,date,text,text) IS
 'Atomic owner-only dual role draft for one cooperative member, with independent positions and no legal authority.';
COMMIT;
