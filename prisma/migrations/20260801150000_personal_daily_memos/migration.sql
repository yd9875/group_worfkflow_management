CREATE TABLE "personal_daily_memos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_daily_memos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_daily_memos_organizationId_userId_date_key"
ON "personal_daily_memos"("organizationId", "userId", "date");

CREATE INDEX "personal_daily_memos_userId_date_idx"
ON "personal_daily_memos"("userId", "date");

ALTER TABLE "personal_daily_memos"
ADD CONSTRAINT "personal_daily_memos_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_daily_memos"
ADD CONSTRAINT "personal_daily_memos_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
