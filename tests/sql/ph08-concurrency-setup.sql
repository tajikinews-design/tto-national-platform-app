\set ON_ERROR_STOP on
INSERT INTO tto.ph08_courses(course_id,tenant_id,title,status)
VALUES('88b00000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','Concurrency course','ACTIVE');
INSERT INTO tto.ph08_training_events(event_id,course_id,tenant_id,capacity,refund_policy_version)
VALUES('88b10000-0000-4000-8000-000000000001','88b00000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001',1,'LAB_REFUND_V1');
INSERT INTO tto.ph08_projects(project_id,tenant_id,name,county_code,status)
VALUES('88b20000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','Project CAS Race','COUNTY_A','DRAFT');
