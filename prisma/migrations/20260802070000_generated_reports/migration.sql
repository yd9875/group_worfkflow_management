CREATE TABLE "generated_reports" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "view" TEXT NOT NULL,
  "referenceDate" DATE NOT NULL,
  "format" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "objectKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generated_reports_objectKey_key" ON "generated_reports"("objectKey");
CREATE INDEX "generated_reports_organizationId_createdAt_idx" ON "generated_reports"("organizationId", "createdAt" DESC);

ALTER TABLE "generated_reports"
ADD CONSTRAINT "generated_reports_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "generated_reports"
ADD CONSTRAINT "generated_reports_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
