BEGIN;
CREATE TABLE tto.ph08_sourcing_tenders(
tender_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
deadline timestamptz NOT NULL,opened_at timestamptz,criteria_version int NOT NULL DEFAULT 1,
source_policy uuid NOT NULL REFERENCES tto.evidence_references(evidence_id));
CREATE TABLE tto.ph08_sourcing_bids(
bid_id uuid PRIMARY KEY,tender_id uuid NOT NULL REFERENCES tto.ph08_sourcing_tenders(tender_id),
supplier_id uuid NOT NULL REFERENCES tto.parties(party_id),
sealed_content text NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),
UNIQUE(tender_id,supplier_id));
CREATE TABLE tto.ph08_evaluator_conflicts(
tender_id uuid NOT NULL REFERENCES tto.ph08_sourcing_tenders(tender_id),
evaluator_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
status text NOT NULL CHECK(status IN('OPEN','RESOLVED')),
PRIMARY KEY(tender_id,evaluator_id));
CREATE TABLE tto.ph08_threshold_versions(
policy_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
policy_code text NOT NULL,version int NOT NULL CHECK(version>0),
source_ref uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
value numeric NOT NULL CHECK(value>=0),UNIQUE(tenant_id,policy_code,version));
COMMIT;