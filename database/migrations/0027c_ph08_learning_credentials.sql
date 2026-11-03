BEGIN;
CREATE TABLE tto.ph08_learning_completions(
record_id uuid PRIMARY KEY,course_id uuid NOT NULL REFERENCES tto.ph08_courses(course_id),
learner_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
assessment_source uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
UNIQUE(course_id,learner_id));
CREATE TABLE tto.ph08_course_certifications(
cert_id uuid PRIMARY KEY,completion_ref uuid NOT NULL UNIQUE REFERENCES tto.ph08_learning_completions(record_id),
qualification_claim boolean NOT NULL DEFAULT false CHECK(qualification_claim=false));
CREATE TABLE tto.ph08_event_refunds(
refund_id uuid PRIMARY KEY,registration_ref uuid NOT NULL REFERENCES tto.ph08_event_registrations(registration_id),
applied_policy_version text NOT NULL,status text NOT NULL DEFAULT 'REQUESTED'
CHECK(status IN('REQUESTED','APPROVED','REJECTED')));
COMMIT;