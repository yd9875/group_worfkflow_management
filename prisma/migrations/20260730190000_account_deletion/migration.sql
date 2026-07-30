ALTER TABLE "memberships"
  DROP CONSTRAINT "memberships_userId_fkey",
  ADD CONSTRAINT "memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "join_requests"
  DROP CONSTRAINT "join_requests_userId_fkey",
  ADD CONSTRAINT "join_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedules"
  DROP CONSTRAINT "schedules_createdByUserId_fkey",
  DROP CONSTRAINT "schedules_updatedByUserId_fkey",
  DROP CONSTRAINT "schedules_targetUserId_fkey",
  ALTER COLUMN "createdByUserId" DROP NOT NULL,
  ALTER COLUMN "updatedByUserId" DROP NOT NULL,
  ADD CONSTRAINT "schedules_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "schedules_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "schedules_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  DROP CONSTRAINT "notifications_userId_fkey",
  ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
