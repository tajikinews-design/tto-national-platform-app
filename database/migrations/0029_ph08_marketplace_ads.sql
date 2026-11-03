BEGIN;
CREATE TABLE tto.ph08_supplier_proposals(
proposal_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
proposed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),description text NOT NULL,
status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','REVIEW','REJECTED','ACCEPTED')));
CREATE TABLE tto.ph08_market_offers(
offer_id uuid PRIMARY KEY,seller_tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
title text NOT NULL,price_snapshot numeric NOT NULL CHECK(price_snapshot>=0),
status text NOT NULL CHECK(status IN('DRAFT','PUBLISHED','RETIRED')),
seller_kind text NOT NULL DEFAULT 'COOPERATIVE' CHECK(seller_kind='COOPERATIVE'));
CREATE TABLE tto.ph08_market_orders(
order_id uuid PRIMARY KEY,offer_id uuid NOT NULL REFERENCES tto.ph08_market_offers(offer_id),
buyer_tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
seller_tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
price_snapshot numeric NOT NULL CHECK(price_snapshot>=0),
status text NOT NULL DEFAULT 'CREATED'
CHECK(status IN('CREATED','PAYMENT_REPORTED','VERIFIED','CLOSED','REFUNDED')));
CREATE FUNCTION tto.ph08_market_order_tenant_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
BEGIN
IF NOT EXISTS(SELECT 1 FROM tto.ph08_market_offers o
WHERE o.offer_id=NEW.offer_id AND o.seller_tenant_id=NEW.seller_tenant_id
AND o.status='PUBLISHED' AND o.price_snapshot=NEW.price_snapshot)
THEN RAISE EXCEPTION 'PH08_MARKET_SELLER_SOURCE_DENIED';END IF;
RETURN NEW;
END $f$;
CREATE TRIGGER ph08_market_order_source BEFORE INSERT ON tto.ph08_market_orders
FOR EACH ROW EXECUTE FUNCTION tto.ph08_market_order_tenant_guard();
CREATE TABLE tto.ph08_market_refunds(
refund_id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES tto.ph08_market_orders(order_id),
policy_version text NOT NULL CHECK(length(policy_version)>3));
CREATE TABLE tto.ph08_ad_creatives(
creative_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
caption text NOT NULL,sponsored boolean NOT NULL DEFAULT true CHECK(sponsored=true),
official_notice boolean NOT NULL DEFAULT false CHECK(official_notice=false));
CREATE TABLE tto.ph08_ad_target_filters(
filter_id uuid PRIMARY KEY,creative_id uuid NOT NULL REFERENCES tto.ph08_ad_creatives(creative_id),
filter_code text NOT NULL CHECK(filter_code IN('COUNTY','NON_SENSITIVE_INTEREST','GENERIC_CONTEXT')));
CREATE TRIGGER ph08_order_immutable BEFORE UPDATE OF price_snapshot,seller_tenant_id,offer_id ON tto.ph08_market_orders
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE tb text;BEGIN
FOREACH tb IN ARRAY ARRAY['ph08_supplier_proposals','ph08_market_offers','ph08_market_orders','ph08_market_refunds','ph08_ad_creatives','ph08_ad_target_filters']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tb);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tb);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tb);END LOOP;END $p$;
COMMIT;