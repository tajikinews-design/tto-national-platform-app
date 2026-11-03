BEGIN;
CREATE TABLE tto.ph08_event_registrations(registration_id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES tto.ph08_training_events(event_id),registered_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),state text NOT NULL CHECK(state IN('CONFIRMED','WAITLIST','CANCELLED')),UNIQUE(event_id,registered_by));
COMMIT;