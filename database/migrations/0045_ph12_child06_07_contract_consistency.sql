-- PH12 CHILD06/CHILD07 candidate consistency hardening, disposable PG17 only.
-- New order/lock state remains staged; transfer ownership cannot be finalized.
BEGIN;

-- Source version/projection discrepancy detection: no write, no automatic sync.
-- A status of MATCHED_CANDIDATE still is not formal legal/source acceptance.
CREATE FUNCTION tto.ph12_child06_projection_discrepancy(
 p_tenant uuid, p_party uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE latest record; projected record;
BEGIN
 SELECT status,source_version,source_event_id
 INTO latest FROM tto.child06_cooperative_relationships
 WHERE tenant_id=p_tenant AND party_id=p_party
 ORDER BY source_version DESC LIMIT 1;
 IF NOT FOUND THEN RETURN 'NO_CANONICAL_RELATIONSHIP';END IF;

 SELECT membership_status,source_version,source_event_id
 INTO projected FROM tto.relationship_projections
 WHERE tenant_id=p_tenant AND party_id=p_party;
 IF NOT FOUND THEN RETURN 'MISSING_CF02_PROJECTION';END IF;
 IF latest.source_version IS DISTINCT FROM projected.source_version
 THEN RETURN 'SOURCE_VERSION_MISMATCH';END IF;
 IF latest.status IS DISTINCT FROM projected.membership_status
 THEN RETURN 'STATUS_MISMATCH';END IF;
 IF latest.source_event_id IS DISTINCT FROM projected.source_event_id
 THEN RETURN 'SOURCE_EVENT_MISMATCH';END IF;
 RETURN 'MATCHED_CANDIDATE_NOT_LEGALLY_APPROVED';
END $fn$;
REVOKE ALL ON FUNCTION tto.ph12_child06_projection_discrepancy(uuid,uuid)
 FROM PUBLIC,tto_app;

-- Prevent requests with quantities greater than their sell order and self-buy.
CREATE FUNCTION tto.ph12_child07_validate_buy_request()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,tto AS $fn$
DECLARE o record;
BEGIN
 SELECT seller_account_id,qty INTO o
 FROM tto.child07_sell_orders
 WHERE tenant_id=NEW.tenant_id AND sell_order_id=NEW.sell_order_id;
 IF NOT FOUND OR NEW.qty>o.qty OR NEW.buyer_account_id=o.seller_account_id
 THEN RAISE EXCEPTION 'CHILD07_BUY_REQUEST_ORDER_INCONSISTENT';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_child07_validate_buy_request BEFORE INSERT OR UPDATE
 ON tto.child07_buy_requests FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_child07_validate_buy_request();

-- Case must follow the chosen sell order and the exact buy request.
-- Neither a valid case nor payment evidence authorizes ledger transfer.
CREATE FUNCTION tto.ph12_child07_validate_transfer_case()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,tto AS $fn$
DECLARE o record; b record;
BEGIN
 IF NEW.buy_request_id IS NOT NULL AND NEW.sell_order_id IS NULL THEN
  RAISE EXCEPTION 'CHILD07_CASE_REQUIRES_SELL_ORDER';END IF;
 IF NEW.sell_order_id IS NOT NULL THEN
  SELECT seller_account_id,qty,valuation_id INTO o
  FROM tto.child07_sell_orders
  WHERE tenant_id=NEW.tenant_id AND sell_order_id=NEW.sell_order_id;
  IF NOT FOUND OR NEW.seller_account_id<>o.seller_account_id OR NEW.qty>o.qty
   OR NEW.valuation_id IS DISTINCT FROM o.valuation_id
  THEN RAISE EXCEPTION 'CHILD07_CASE_SELL_ORDER_INCONSISTENT';END IF;
 END IF;
 IF NEW.buy_request_id IS NOT NULL THEN
  SELECT buyer_account_id,sell_order_id,qty INTO b
  FROM tto.child07_buy_requests
  WHERE tenant_id=NEW.tenant_id AND buy_request_id=NEW.buy_request_id;
  IF NOT FOUND OR NEW.buyer_account_id<>b.buyer_account_id OR
   NEW.sell_order_id<>b.sell_order_id OR NEW.qty>b.qty
  THEN RAISE EXCEPTION 'CHILD07_CASE_BUY_REQUEST_INCONSISTENT';END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_child07_validate_transfer_case BEFORE INSERT OR UPDATE
 ON tto.child07_transfer_cases FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_child07_validate_transfer_case();

-- Locks must refer to their own seller account and cannot exceed case quantity.
-- No lock activation function or runtime write grant is added.
CREATE FUNCTION tto.ph12_child07_validate_lock()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,tto AS $fn$
DECLARE c record;
BEGIN
 SELECT seller_account_id,qty INTO c
 FROM tto.child07_transfer_cases
 WHERE tenant_id=NEW.tenant_id AND case_id=NEW.source_case_ref;
 IF NOT FOUND OR NEW.owner_account_id<>c.seller_account_id OR NEW.qty>c.qty
 THEN RAISE EXCEPTION 'CHILD07_LOCK_CASE_INCONSISTENT';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_child07_validate_lock BEFORE INSERT OR UPDATE
 ON tto.child07_share_locks FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_child07_validate_lock();

-- Prevent referenced order/request/case parent identifiers or quantities being
-- silently rewritten by a future privileged importer. Keep DRAFT->BLOCKED possible.
CREATE FUNCTION tto.ph12_child07_guard_reference_mutation()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,tto AS $fn$
BEGIN
 IF TG_TABLE_NAME='child07_sell_orders' AND
   (NEW.tenant_id,NEW.seller_account_id,NEW.qty,NEW.valuation_id)
   IS DISTINCT FROM
   (OLD.tenant_id,OLD.seller_account_id,OLD.qty,OLD.valuation_id)
 THEN RAISE EXCEPTION 'CHILD07_ORDER_REFERENCE_IMMUTABLE';END IF;
 IF TG_TABLE_NAME='child07_buy_requests' AND
   (NEW.tenant_id,NEW.buyer_account_id,NEW.sell_order_id,NEW.qty)
   IS DISTINCT FROM
   (OLD.tenant_id,OLD.buyer_account_id,OLD.sell_order_id,OLD.qty)
 THEN RAISE EXCEPTION 'CHILD07_BUY_REFERENCE_IMMUTABLE';END IF;
 IF TG_TABLE_NAME='child07_transfer_cases' AND
   (NEW.tenant_id,NEW.seller_account_id,NEW.buyer_account_id,NEW.qty,
    NEW.sell_order_id,NEW.buy_request_id,NEW.valuation_id)
   IS DISTINCT FROM
   (OLD.tenant_id,OLD.seller_account_id,OLD.buyer_account_id,OLD.qty,
    OLD.sell_order_id,OLD.buy_request_id,OLD.valuation_id)
 THEN RAISE EXCEPTION 'CHILD07_CASE_REFERENCE_IMMUTABLE';END IF;
 IF TG_TABLE_NAME='child07_share_locks' AND
   (NEW.tenant_id,NEW.owner_account_id,NEW.qty,NEW.source_case_ref)
   IS DISTINCT FROM
   (OLD.tenant_id,OLD.owner_account_id,OLD.qty,OLD.source_case_ref)
 THEN RAISE EXCEPTION 'CHILD07_LOCK_REFERENCE_IMMUTABLE';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_child07_sell_order_immutable_refs BEFORE UPDATE
 ON tto.child07_sell_orders FOR EACH ROW EXECUTE FUNCTION tto.ph12_child07_guard_reference_mutation();
CREATE TRIGGER ph12_child07_buy_request_immutable_refs BEFORE UPDATE
 ON tto.child07_buy_requests FOR EACH ROW EXECUTE FUNCTION tto.ph12_child07_guard_reference_mutation();
CREATE TRIGGER ph12_child07_case_immutable_refs BEFORE UPDATE
 ON tto.child07_transfer_cases FOR EACH ROW EXECUTE FUNCTION tto.ph12_child07_guard_reference_mutation();
CREATE TRIGGER ph12_child07_lock_immutable_refs BEFORE UPDATE
 ON tto.child07_share_locks FOR EACH ROW EXECUTE FUNCTION tto.ph12_child07_guard_reference_mutation();

REVOKE ALL ON FUNCTION tto.ph12_child07_validate_buy_request(),
 tto.ph12_child07_validate_transfer_case(),tto.ph12_child07_validate_lock(),
 tto.ph12_child07_guard_reference_mutation() FROM PUBLIC,tto_app;
COMMIT;
