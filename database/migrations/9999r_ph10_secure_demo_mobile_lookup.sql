-- PH12 isolated preview-only session proof: no direct identity SELECT privileges.
CREATE OR REPLACE FUNCTION tto.commerce_demo_verified_mobile_from_session(
 p_session_hash bytea
) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
 SELECT i.mobile
 FROM tto.resolve_session(p_session_hash) AS s
 JOIN tto.verified_mobile_identifiers AS i ON i.user_id=s.user_id
 JOIN tto.user_accounts AS a ON a.user_id=s.user_id
 WHERE p_session_hash IS NOT NULL
   AND octet_length(p_session_hash)=32
   AND i.revoked_at IS NULL
   AND a.status='ACTIVE'
 ORDER BY i.verified_at DESC
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_verified_mobile_from_session(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_verified_mobile_from_session(bytea) TO tto_app;
COMMENT ON FUNCTION tto.commerce_demo_verified_mobile_from_session(bytea) IS
 'Preview commerce only: read own verified mobile via a valid revocable session digest.';
