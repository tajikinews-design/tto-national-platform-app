-- CHILD07 first practical read-only history slice. Safe for disposable PostgreSQL17 ONLY.
-- This exposes SOURCE SNAPSHOT VERSIONS, not the canonical ownership transfer ledger.
-- No write, transfer, source ingestion or automatic activation.
BEGIN;
CREATE FUNCTION tto.my_shareholding_history_from_source(p_tenant uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 WITH gate AS MATERIALIZED (
  SELECT tto.my_shareholding_from_source(p_tenant) AS record
 ),
 current_authorized AS MATERIALIZED (
  SELECT DISTINCT a.tenant_id,a.shareholder_account_id,latest.source_ref,latest.ledger_version
  FROM gate g
  JOIN tto.shareholder_source_accounts a ON a.tenant_id=p_tenant AND a.account_status='ACTIVE'
  JOIN tto.user_party_links l ON l.party_id=a.party_id AND l.user_id=tto.context_actor_id()
  JOIN tto.shareholding_source_snapshots latest
    ON latest.tenant_id=a.tenant_id AND latest.shareholder_account_id=a.shareholder_account_id
  WHERE g.record IS NOT NULL
    AND p_tenant=tto.context_tenant_id()
    AND tto.context_actor_id() IS NOT NULL
    AND l.verified_at IS NOT NULL
    AND latest.ledger_version=(SELECT max(newest.ledger_version)
      FROM tto.shareholding_source_snapshots newest
      WHERE newest.tenant_id=a.tenant_id AND newest.shareholder_account_id=a.shareholder_account_id)
    AND latest.ledger_version::text=g.record->>'ledgerVersion'
    AND latest.share_quantity::text=g.record->>'shareQuantity'
    AND tto.valid_read_source(p_tenant,'CHILD07_HOLDINGS',latest.source_ref)
 ),
 sampled AS (
  SELECT s.share_quantity,s.ledger_version,s.ledger_as_of
  FROM current_authorized a
  JOIN tto.shareholding_source_snapshots s
    ON s.tenant_id=a.tenant_id AND s.shareholder_account_id=a.shareholder_account_id
   AND s.source_ref=a.source_ref AND s.ledger_version<=a.ledger_version
  WHERE s.ledger_as_of<=now()
  ORDER BY s.ledger_version DESC
  LIMIT 20
 )
 SELECT CASE WHEN count(*)>0 THEN jsonb_agg(jsonb_build_object(
  'shareQuantity',share_quantity::text,'ledgerVersion',ledger_version,
  'ledgerAsOf',ledger_as_of) ORDER BY ledger_version DESC) ELSE NULL END
 FROM sampled $f$;
REVOKE ALL ON FUNCTION tto.my_shareholding_history_from_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.my_shareholding_history_from_source(uuid) TO tto_app;
COMMENT ON FUNCTION tto.my_shareholding_history_from_source(uuid) IS
 'Read-only same-source approved holding snapshot versions (max 20), not canonical transfer/ownership ledger. Relies on current owner-only source approval.';
COMMIT;
