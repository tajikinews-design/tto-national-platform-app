-- PH12 read-only authority source reconciliation: NO source promotion, no transfer.
-- Additive isolated migration candidate; all reads private to trusted migration/audit owner.
BEGIN;
CREATE FUNCTION tto.ph12_child06_reconcile_sources(p_tenant uuid,p_party uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $fn$
DECLARE canonical record; legacy record; projection record; imported record;
BEGIN
 IF p_tenant IS NULL OR p_party IS NULL THEN RETURN 'INVALID_SCOPE';END IF;
 SELECT status,source_event_id,source_version INTO canonical
 FROM tto.child06_cooperative_relationships
 WHERE tenant_id=p_tenant AND party_id=p_party
 ORDER BY source_version DESC LIMIT 1;
 IF NOT FOUND THEN RETURN 'CHILD06_CANONICAL_UNAVAILABLE';END IF;
 SELECT current_status AS status,event_id AS source_event_id,source_version INTO legacy
 FROM tto.ph06_membership_current WHERE tenant_id=p_tenant AND party_id=p_party;
 IF NOT FOUND THEN RETURN 'LEGACY_MASTER_UNMAPPED';END IF;
 IF legacy.source_version IS DISTINCT FROM canonical.source_version
 THEN RETURN 'LEGACY_VERSION_CONFLICT';END IF;
 IF legacy.status IS DISTINCT FROM canonical.status
 THEN RETURN 'LEGACY_STATUS_CONFLICT';END IF;
 IF legacy.source_event_id IS DISTINCT FROM canonical.source_event_id
 THEN RETURN 'LEGACY_EVENT_CONFLICT';END IF;
 SELECT membership_status AS status,source_event_id,source_version INTO projection
 FROM tto.relationship_projections WHERE tenant_id=p_tenant AND party_id=p_party;
 IF NOT FOUND THEN RETURN 'CF02_PROJECTION_UNAVAILABLE';END IF;
 IF projection.source_version IS DISTINCT FROM canonical.source_version
 THEN RETURN 'CF02_VERSION_CONFLICT';END IF;
 IF projection.status IS DISTINCT FROM canonical.status
 THEN RETURN 'CF02_STATUS_CONFLICT';END IF;
 IF projection.source_event_id IS DISTINCT FROM canonical.source_event_id
 THEN RETURN 'CF02_EVENT_CONFLICT';END IF;
 SELECT membership_status AS status,source_event_id,source_version,source_ref INTO imported
 FROM tto.member_source_snapshots WHERE tenant_id=p_tenant AND party_id=p_party;
 IF NOT FOUND THEN RETURN 'MEMBER_SOURCE_SNAPSHOT_UNAVAILABLE';END IF;
 IF imported.source_version IS DISTINCT FROM canonical.source_version
 THEN RETURN 'IMPORTED_VERSION_CONFLICT';END IF;
 IF imported.status IS DISTINCT FROM canonical.status
 THEN RETURN 'IMPORTED_STATUS_CONFLICT';END IF;
 IF imported.source_event_id IS DISTINCT FROM canonical.source_event_id
 THEN RETURN 'IMPORTED_EVENT_CONFLICT';END IF;
 IF NOT tto.valid_read_source(p_tenant,'CHILD06_MEMBERSHIP',imported.source_ref)
 THEN RETURN 'MEMBER_SOURCE_APPROVAL_MISSING';END IF;
 RETURN 'ALIGNED_CANDIDATE_NOT_FORMAL_ACCEPTANCE';
END $fn$;

CREATE FUNCTION tto.ph12_child07_reconcile_opening(p_tenant uuid,p_account uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $fn$
DECLARE account record; imported_account record; snap record;
 opening_total numeric; opening_count bigint;
BEGIN
 IF p_tenant IS NULL OR p_account IS NULL THEN RETURN 'INVALID_SCOPE';END IF;
 SELECT party_id,status,shareholder_type,classification_evidence_id,
  classification_rule_version_id INTO account
 FROM tto.ph06_shareholder_accounts
 WHERE tenant_id=p_tenant AND account_id=p_account;
 IF NOT FOUND THEN RETURN 'CHILD06_ACCOUNT_UNAVAILABLE';END IF;
 IF account.status<>'ACTIVE' OR account.shareholder_type IS NULL OR
  account.classification_evidence_id IS NULL OR account.classification_rule_version_id IS NULL
 THEN RETURN 'ACCOUNT_CLASSIFICATION_UNAPPROVED';END IF;
 -- Existing source importer requires membership and cannot legally model an
 -- independent non-member shareholder. Never treat unavailable as 0 shares.
 IF account.shareholder_type='NON_MEMBER'
 THEN RETURN 'NON_MEMBER_SOURCE_ADAPTER_NOT_APPROVED';END IF;
 IF tto.ph12_child06_reconcile_sources(p_tenant,account.party_id)
    <>'ALIGNED_CANDIDATE_NOT_FORMAL_ACCEPTANCE'
 THEN RETURN 'MEMBERSHIP_SOURCE_NOT_RECONCILED';END IF;
 SELECT count(*),sum(share_qty)::numeric INTO opening_count,opening_total
 FROM tto.child07_ownership_ledger_entries
 WHERE tenant_id=p_tenant AND shareholder_account_id=p_account
  AND source_kind='OPENING_VERIFIED' AND direction='CREDIT';
 IF opening_count=0 THEN RETURN 'OFFICIAL_OPENING_LEDGER_UNAVAILABLE';END IF;
 SELECT source_ref,source_version,account_status INTO imported_account
 FROM tto.shareholder_source_accounts
 WHERE tenant_id=p_tenant AND shareholder_account_id=p_account
  AND party_id=account.party_id;
 IF NOT FOUND OR imported_account.account_status<>'ACTIVE'
 THEN RETURN 'CHILD06_SHAREHOLDER_SOURCE_ACCOUNT_UNMAPPED';END IF;
 SELECT share_quantity,ledger_version,ledger_as_of,source_ref INTO snap
 FROM tto.shareholding_source_snapshots
 WHERE tenant_id=p_tenant AND shareholder_account_id=p_account
 ORDER BY ledger_version DESC LIMIT 1;
 IF NOT FOUND THEN RETURN 'CHILD07_IMPORTED_HOLDING_UNAVAILABLE';END IF;
 IF snap.ledger_as_of>now() THEN RETURN 'CHILD07_IMPORTED_HOLDING_FUTURE';END IF;
 IF opening_total<>snap.share_quantity::numeric
 THEN RETURN 'OPENING_QUANTITY_MISMATCH';END IF;
 IF NOT tto.valid_read_source(p_tenant,'CHILD07_HOLDINGS',snap.source_ref)
 THEN RETURN 'CHILD07_SOURCE_APPROVAL_MISSING';END IF;
 RETURN 'OPENING_ALIGNED_CANDIDATE_NOT_FORMAL_ACCEPTANCE';
END $fn$;

REVOKE ALL ON FUNCTION tto.ph12_child06_reconcile_sources(uuid,uuid),
 tto.ph12_child07_reconcile_opening(uuid,uuid) FROM PUBLIC,tto_app;
COMMENT ON FUNCTION tto.ph12_child07_reconcile_opening(uuid,uuid) IS
 'Read-only synthetic candidate comparison. Never source promotion, payment authority, real ownership, or final transfer.';
COMMIT;
