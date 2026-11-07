-- PH12: per-cooperative persistent tariff DRAFT intake only.
-- This is NOT the authoritative active fee catalogue, not a board decision,
-- not general accounting, and grants NO payment or share-transfer rights.
BEGIN;
CREATE TABLE tto.ph12_tariff_drafts(
 draft_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 fee_code text NOT NULL CHECK(fee_code ~ '^[A-Z][A-Z0-9_-]{3,63}$'),
 proposed_version integer NOT NULL CHECK(proposed_version BETWEEN 1 AND 1000000),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT_UNVERIFIED'
    CHECK(status='DRAFT_UNVERIFIED'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,fee_code,proposed_version),
 UNIQUE(tenant_id,created_by,request_key)
);
CREATE INDEX ph12_tariff_drafts_tenant_created
 ON tto.ph12_tariff_drafts(tenant_id,created_at DESC);
-- Neither app role nor public gets table access; table is FORCE RLS protected.
ALTER TABLE tto.ph12_tariff_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_tariff_drafts FROM PUBLIC,tto_app;
CREATE POLICY ph12_tariff_draft_manager_scope ON tto.ph12_tariff_drafts
 FOR SELECT TO tto_app USING (
   tto.has_tenant_role(tenant_id,'COOPERATIVE_MANAGER')
   AND tto.has_verified_authority(tenant_id,'ROLE_MANAGEMENT')
 );
CREATE FUNCTION tto.ph12_tariff_draft_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $$
BEGIN
 RAISE EXCEPTION 'PH12_DRAFT_IMMUTABLE_NEW_VERSION_REQUIRED'
 USING ERRCODE='42501';
END $$;
CREATE TRIGGER ph12_tariff_draft_no_mutation
 BEFORE UPDATE OR DELETE ON tto.ph12_tariff_drafts FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_draft_immutable();

CREATE FUNCTION tto.ph12_create_tariff_draft(p_request_key uuid,p_data jsonb)
RETURNS TABLE(draft_id uuid,fee_code text,proposed_version integer,status text,replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
 c text;v integer;b integer;s integer; prior record; created record;
 keys text[]:=ARRAY['feeId','title','version','feeType','calculationMode',
   'fixedAmount','percentBps','payerMode','buyerPercent','sellerPercent',
   'percentageBasis','validFrom','validUntil','legalBasisReference',
   'boardResolutionReference','boardEvidenceReference'];
BEGIN
 IF tid IS NULL OR actor IS NULL OR p_request_key IS NULL OR
    NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
    NOT tto.has_verified_authority(tid,'ROLE_MANAGEMENT')
 THEN RAISE EXCEPTION 'PH12_TARIFF_DRAFT_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR
    length(p_data::text)>4500 OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) as x(k)
      WHERE NOT x.k=ANY(keys)) OR
    EXISTS(SELECT 1 FROM unnest(keys) as k WHERE NOT p_data ? k)
 THEN RAISE EXCEPTION 'PH12_TARIFF_DRAFT_INVALID' USING ERRCODE='22023';END IF;
 c:=p_data->>'feeId';
 IF c !~ '^[A-Z][A-Z0-9_-]{3,63}$' OR
    length(trim(coalesce(p_data->>'title','')))<8 OR
    length(p_data->>'title')>130 OR
    (p_data->>'version') !~ '^[0-9]{1,7}$' OR
    (p_data->>'fixedAmount') !~ '^[0-9]{1,12}$' OR
    (p_data->>'percentBps') !~ '^[0-9]{1,5}$' OR
    (p_data->>'buyerPercent') !~ '^[0-9]{1,3}$' OR
    (p_data->>'sellerPercent') !~ '^[0-9]{1,3}$' OR
    p_data->>'feeType' NOT IN('COOP_APPROVED_FEE','STATUTORY_FEE','PLATFORM_SERVICE_FEE') OR
    p_data->>'calculationMode' NOT IN('FIXED','PERCENTAGE','FIXED_PLUS_PERCENTAGE') OR
    p_data->>'payerMode' NOT IN('BUYER','SELLER','SPLIT') OR
    p_data->>'percentageBasis' NOT IN('TRADE_GROSS_VALUE','SHARE_VALUE','CUSTOM_APPROVED_BASE') OR
    length(trim(coalesce(p_data->>'legalBasisReference','')))<8 OR
    length(trim(coalesce(p_data->>'boardResolutionReference','')))<8 OR
    length(trim(coalesce(p_data->>'boardEvidenceReference','')))<8 OR
    (p_data->>'validFrom') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR
    (p_data->>'validUntil') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 THEN RAISE EXCEPTION 'PH12_TARIFF_DRAFT_INVALID' USING ERRCODE='22023';END IF;
 v:=(p_data->>'version')::integer;
 b:=(p_data->>'buyerPercent')::integer;
 s:=(p_data->>'sellerPercent')::integer;
 IF v<1 OR v>1000000 OR (p_data->>'percentBps')::integer>10000 OR
    b+s<>100 OR
    (p_data->>'payerMode'='BUYER' AND (b<>100 OR s<>0)) OR
    (p_data->>'payerMode'='SELLER' AND (b<>0 OR s<>100)) OR
    (p_data->>'payerMode'='SPLIT' AND (b=0 OR s=0)) OR
    (p_data->>'validUntil')::date<=(p_data->>'validFrom')::date
 THEN RAISE EXCEPTION 'PH12_TARIFF_DRAFT_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
    tid::text||':ph12:tariff:'||c,0));
 SELECT d.draft_id,d.fee_code,d.proposed_version,d.status,d.payload
 INTO prior FROM tto.ph12_tariff_drafts d
 WHERE d.tenant_id=tid AND d.created_by=actor AND d.request_key=p_request_key;
 IF FOUND THEN
  IF prior.payload<>p_data THEN
   RAISE EXCEPTION 'PH12_DRAFT_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT prior.draft_id,prior.fee_code,
    prior.proposed_version,prior.status,true;RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM tto.ph12_tariff_drafts d
  WHERE d.tenant_id=tid AND d.fee_code=c AND d.proposed_version>=v)
 THEN RAISE EXCEPTION 'PH12_DRAFT_VERSION_CONFLICT' USING ERRCODE='23505';END IF;
 INSERT INTO tto.ph12_tariff_drafts(tenant_id,fee_code,proposed_version,
    payload,created_by,request_key)
 VALUES(tid,c,v,p_data,actor,p_request_key)
 RETURNING tto.ph12_tariff_drafts.draft_id,
   tto.ph12_tariff_drafts.fee_code,tto.ph12_tariff_drafts.proposed_version,
   tto.ph12_tariff_drafts.status INTO created;
 RETURN QUERY SELECT created.draft_id,created.fee_code,
   created.proposed_version,created.status,false;
END $$;
CREATE FUNCTION tto.ph12_list_tariff_drafts()
RETURNS TABLE(draft_id uuid,fee_code text,proposed_version integer,
  status text,payload jsonb,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
DECLARE tid uuid:=tto.context_tenant_id();
BEGIN
 IF tid IS NULL OR tto.context_actor_id() IS NULL OR
    NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
    NOT tto.has_verified_authority(tid,'ROLE_MANAGEMENT')
 THEN RAISE EXCEPTION 'PH12_TARIFF_DRAFT_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT d.draft_id,d.fee_code,d.proposed_version,d.status,
   d.payload,d.created_at FROM tto.ph12_tariff_drafts d
 WHERE d.tenant_id=tid ORDER BY d.created_at DESC,d.draft_id DESC LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION tto.ph12_create_tariff_draft(uuid,jsonb),
 tto.ph12_list_tariff_drafts(),tto.ph12_tariff_draft_immutable()
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_create_tariff_draft(uuid,jsonb),
 tto.ph12_list_tariff_drafts() TO tto_app;
COMMENT ON TABLE tto.ph12_tariff_drafts IS
 'Only immutable self-reported tariff DRAFTs; no board approval, active policy, payment or transfer.';
COMMIT;
