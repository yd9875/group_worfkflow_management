DROP INDEX IF EXISTS "personal_daily_memos_organizationId_userId_date_key";

DROP INDEX IF EXISTS "personal_daily_memos_userId_date_idx";

CREATE INDEX "personal_daily_memos_organizationId_userId_date_createdAt_idx"
ON "personal_daily_memos"("organizationId", "userId", "date", "createdAt");

ALTER TABLE "schedules"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "schedules"
SET
  "showInWeek" = ("showInWeek" OR "showInMonth"),
  "showInMonth" = ("showInWeek" OR "showInMonth")
WHERE "scope" = 'PERSONAL';
