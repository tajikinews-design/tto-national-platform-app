-- PH10 synthetic acceptance extension: supplier inquiry never becomes a marketplace offer.
-- Release remains blocked; apply only to disposable PG17 audit CI.
BEGIN;
CREATE FUNCTION tto.ph10_submit_supplier_inquiry(p_description text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();created uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'MEMBER')
 OR length(trim(coalesce(p_description,'')))<10 OR length(trim(p_description))>500 THEN
  RETURN NULL;
 END IF;
 created:=gen_random_uuid();
 INSERT INTO tto.ph08_supplier_proposals(proposal_id,tenant_id,proposed_by,description,status)
 VALUES(created,tid,actor,trim(p_description),'SUBMITTED');
 PERFORM tto.append_actor_audit(tid,'PH08_MEMBER_SUPPLIER_INQUIRY',created);
 RETURN created;
END $f$;
REVOKE ALL ON FUNCTION tto.ph10_submit_supplier_inquiry(text) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph10_submit_supplier_inquiry(text) TO tto_app;
COMMIT;
