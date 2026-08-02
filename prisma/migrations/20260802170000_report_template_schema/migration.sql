ALTER TABLE "organizations"
ADD COLUMN "reportTemplateSchema" JSONB,
ADD COLUMN "reportTemplateFingerprint" TEXT,
ADD COLUMN "reportTemplateUpdatedAt" TIMESTAMP(3);
