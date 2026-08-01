CREATE TABLE "report_reference_principles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_reference_principles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_reference_principles_organizationId_createdAt_idx"
ON "report_reference_principles"("organizationId", "createdAt");

ALTER TABLE "report_reference_principles"
ADD CONSTRAINT "report_reference_principles_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
