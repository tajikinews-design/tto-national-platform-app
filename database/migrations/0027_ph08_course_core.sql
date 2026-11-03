BEGIN;
CREATE TABLE tto.ph08_courses(course_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),title text NOT NULL,status text NOT NULL CHECK(status IN('ACTIVE','RETIRED')));
CREATE TABLE tto.ph08_training_events(event_id uuid PRIMARY KEY,course_id uuid NOT NULL REFERENCES tto.ph08_courses(course_id),tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),capacity integer NOT NULL CHECK(capacity>0),refund_policy_version text NOT NULL);
COMMIT;
