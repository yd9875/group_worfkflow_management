CREATE TABLE "report_reference_files" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_reference_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_reference_files_organizationId_createdAt_idx"
ON "report_reference_files"("organizationId", "createdAt");

CREATE UNIQUE INDEX "report_reference_files_objectKey_key"
ON "report_reference_files"("objectKey");

ALTER TABLE "report_reference_files"
ADD CONSTRAINT "report_reference_files_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
