CREATE TYPE "ScheduleItemType" AS ENUM ('SCHEDULE', 'TASK');

ALTER TABLE "memberships"
ADD COLUMN "profileName" TEXT;

ALTER TABLE "schedules"
ADD COLUMN "itemType" "ScheduleItemType" NOT NULL DEFAULT 'SCHEDULE';
