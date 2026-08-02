-- Personal schedules may optionally select a department as their calendar row.
-- targetUserId remains required so the schedule is still private to its owner.
ALTER TABLE "schedules"
DROP CONSTRAINT "schedule_target_valid";

ALTER TABLE "schedules"
ADD CONSTRAINT "schedule_target_valid" CHECK (
  ("scope" = 'ORGANIZATION' AND "departmentId" IS NULL AND "targetUserId" IS NULL) OR
  ("scope" = 'DEPARTMENT' AND "departmentId" IS NOT NULL AND "targetUserId" IS NULL) OR
  ("scope" = 'PERSONAL' AND "targetUserId" IS NOT NULL)
);
