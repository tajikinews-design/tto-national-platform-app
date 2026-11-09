-- NAV-02: preview-only intake; absolutely NOT official membership or share ownership.
-- No legal rights, votes, live payments, share locks or title transfer are written.
CREATE TABLE tto.commerce_demo_shareholder_drafts (
 draft_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 title text NOT NULL CHECK(title IN ('آقا','خانم','شرکت','سازمان','اداره')),
 full_name text NOT NULL CHECK(length(btrim(full_name)) BETWEEN 3 AND 180),
 shareholder_group text NOT NULL CHECK(length(btrim(shareholder_group)) BETWEEN 2 AND 90),
 national_identifier text NOT NULL CHECK(national_identifier ~ '^[0-9]{10,11}$'),
 father_name text,
 birth_certificate_number text,
 birth_date date,
 birth_place text,
 telephone text,
 mobile text,
 postal_code text,
 address text,
 photo_ref text, -- deliberately NULL until private malware-scanned storage is certified
 verification_state text NOT NULL DEFAULT 'DRAFT_UNVERIFIED'
  CHECK(verification_state='DRAFT_UNVERIFIED'),
 entered_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(order_id,national_identifier),
 CHECK ((title IN ('آقا','خانم') AND length(national_identifier)=10) OR
        (title IN ('شرکت','سازمان','اداره') AND length(national_identifier)=11)),
 CHECK(photo_ref IS NULL)
);
ALTER TABLE tto.commerce_demo_shareholder_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_shareholder_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_shareholder_drafts FROM PUBLIC,tto_app;

CREATE TABLE tto.commerce_demo_share_capital_drafts (
 entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shareholder_draft_id uuid NOT NULL UNIQUE REFERENCES tto.commerce_demo_shareholder_drafts(draft_id),
 initial_purchased_shares bigint NOT NULL CHECK(initial_purchased_shares>=0),
 subscribed_shares bigint NOT NULL CHECK(subscribed_shares>=0),
 nominal_value_rial bigint NOT NULL CHECK(nominal_value_rial>0),
 declared_paid_rial bigint NOT NULL CHECK(declared_paid_rial>=0),
 declared_payment_date date,
 declared_receipt_ref text NOT NULL CHECK(length(btrim(declared_receipt_ref)) BETWEEN 3 AND 100),
 evidence_status text NOT NULL DEFAULT 'DECLARED_UNVERIFIED'
  CHECK(evidence_status='DECLARED_UNVERIFIED'),
 entered_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(initial_purchased_shares+subscribed_shares>0),
 CHECK(declared_paid_rial<= (initial_purchased_shares+subscribed_shares)::numeric*nominal_value_rial)
);
ALTER TABLE tto.commerce_demo_share_capital_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_share_capital_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_share_capital_drafts FROM PUBLIC,tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_list(p_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',d.draft_id,'name',d.full_name,'title',d.title,'group',d.shareholder_group,
  'identifierMask','***'||right(d.national_identifier,4),
  'state',d.verification_state,'initialShares',c.initial_purchased_shares,
  'subscribedShares',c.subscribed_shares,'nominalRial',c.nominal_value_rial,
  'declaredPaidRial',c.declared_paid_rial,'paymentDate',c.declared_payment_date,
  'receiptRef',c.declared_receipt_ref,
  'capitalState',c.evidence_status) ORDER BY d.created_at DESC),'[]'::jsonb)
 FROM tto.commerce_demo_shareholder_drafts d
 LEFT JOIN tto.commerce_demo_share_capital_drafts c ON c.shareholder_draft_id=d.draft_id
 JOIN tto.commerce_demo_workspace_owners w ON w.order_id=d.order_id
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
 AND o.slug=p_slug AND o.expires_at>clock_timestamp()
$f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_list(text) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_add(p_slug text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_id uuid;v_title text;v_nid text;v_name text;v_group text;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN
  ('title','fullName','group','nationalId','fatherName','birthCertificate','birthDate',
  'birthPlace','telephone','mobile','postalCode','address')) THEN
  RAISE EXCEPTION 'INVALID_FIELDS' USING ERRCODE='22023'; END IF;
 v_title:=p_input->>'title';v_nid:=p_input->>'nationalId';
 v_name:=btrim(p_input->>'fullName');v_group:=btrim(p_input->>'group');
 IF v_title NOT IN ('آقا','خانم','شرکت','سازمان','اداره') OR v_name IS NULL
 OR length(v_name) NOT BETWEEN 3 AND 180 OR v_group IS NULL
 OR length(v_group) NOT BETWEEN 2 AND 90 OR v_nid !~ '^[0-9]{10,11}$'
 OR (v_title IN ('آقا','خانم') AND length(v_nid)<>10)
 OR (v_title IN ('شرکت','سازمان','اداره') AND length(v_nid)<>11)
 OR length(COALESCE(p_input->>'fatherName',''))>120
 OR length(COALESCE(p_input->>'birthCertificate',''))>45
 OR length(COALESCE(p_input->>'birthPlace',''))>120
 OR length(COALESCE(p_input->>'telephone',''))>25
 OR length(COALESCE(p_input->>'mobile',''))>20
 OR length(COALESCE(p_input->>'postalCode',''))>12
 OR length(COALESCE(p_input->>'address',''))>600
 OR (COALESCE(p_input->>'birthDate','')<>'' AND
   (p_input->>'birthDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) THEN
   RAISE EXCEPTION 'INVALID_SHAREHOLDER_DRAFT' USING ERRCODE='22023'; END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE' AND o.slug=p_slug
 AND o.expires_at>clock_timestamp() FOR UPDATE OF w;
 IF v_order IS NULL THEN RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 INSERT INTO tto.commerce_demo_shareholder_drafts(order_id,title,full_name,shareholder_group,
 national_identifier,father_name,birth_certificate_number,birth_date,birth_place,
 telephone,mobile,postal_code,address,entered_by)
 VALUES(v_order,v_title,v_name,v_group,v_nid,NULLIF(p_input->>'fatherName',''),
 NULLIF(p_input->>'birthCertificate',''),
 CASE WHEN COALESCE(p_input->>'birthDate','')='' THEN NULL ELSE (p_input->>'birthDate')::date END,
 NULLIF(p_input->>'birthPlace',''),NULLIF(p_input->>'telephone',''),
 NULLIF(p_input->>'mobile',''),NULLIF(p_input->>'postalCode',''),
 NULLIF(p_input->>'address',''),tto.context_actor_id()) RETURNING draft_id INTO v_id;
 RETURN jsonb_build_object('id',v_id,'state','DRAFT_UNVERIFIED','legalRightsGranted',false);
END $f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_add(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_add(text,jsonb) TO tto_app;

CREATE FUNCTION tto.commerce_demo_nav02_capital(p_slug text,p_id uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid;v_entry uuid;v_initial bigint;v_subscribed bigint;v_nominal bigint;v_paid bigint;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN
 ('initialShares','subscribedShares','nominalRial','paidRial','paymentDate','receiptRef'))
 THEN RAISE EXCEPTION 'INVALID_CAPITAL_FIELDS' USING ERRCODE='22023'; END IF;
 IF (p_input->>'initialShares') !~ '^[0-9]{1,12}$' OR
 (p_input->>'subscribedShares') !~ '^[0-9]{1,12}$' OR
 (p_input->>'nominalRial') !~ '^[0-9]{1,15}$' OR
 (p_input->>'paidRial') !~ '^[0-9]{1,17}$' OR
 length(btrim(COALESCE(p_input->>'receiptRef',''))) NOT BETWEEN 3 AND 100 OR
 (COALESCE(p_input->>'paymentDate','')<>'' AND
 (p_input->>'paymentDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
 THEN RAISE EXCEPTION 'INVALID_CAPITAL_DRAFT' USING ERRCODE='22023'; END IF;
 v_initial:=(p_input->>'initialShares')::bigint;v_subscribed:=(p_input->>'subscribedShares')::bigint;
 v_nominal:=(p_input->>'nominalRial')::bigint;v_paid:=(p_input->>'paidRial')::bigint;
 IF v_initial+v_subscribed<=0 OR v_nominal<=0 OR
 v_paid>(v_initial+v_subscribed)::numeric*v_nominal THEN
 RAISE EXCEPTION 'INVALID_CAPITAL_TOTALS' USING ERRCODE='22023'; END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE' AND o.slug=p_slug
 AND o.expires_at>clock_timestamp() FOR UPDATE OF w;
 IF v_order IS NULL THEN RAISE EXCEPTION 'PREVIEW_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts
  WHERE draft_id=p_id AND order_id=v_order) THEN
 RAISE EXCEPTION 'SHAREHOLDER_NOT_IN_WORKSPACE' USING ERRCODE='42501'; END IF;
 INSERT INTO tto.commerce_demo_share_capital_drafts(
 shareholder_draft_id,initial_purchased_shares,subscribed_shares,nominal_value_rial,
 declared_paid_rial,declared_payment_date,declared_receipt_ref,entered_by)
 VALUES(p_id,v_initial,v_subscribed,v_nominal,v_paid,
 CASE WHEN COALESCE(p_input->>'paymentDate','')='' THEN NULL ELSE (p_input->>'paymentDate')::date END,
 btrim(p_input->>'receiptRef'),tto.context_actor_id()) RETURNING entry_id INTO v_entry;
 RETURN jsonb_build_object('entryId',v_entry,'state','DECLARED_UNVERIFIED',
 'officialLedgerUpdated',false,'transferEnabled',false);
END $f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_nav02_capital(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_nav02_capital(text,uuid,jsonb) TO tto_app;
