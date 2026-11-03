BEGIN;
CREATE TABLE tto.ph08_benefits(benefit_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),title text NOT NULL,limited boolean NOT NULL DEFAULT false,allocation_policy_ref text,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE')),CHECK(status<>'ACTIVE' OR NOT limited OR length(coalesce(allocation_policy_ref,''))>8));
COMMIT;
