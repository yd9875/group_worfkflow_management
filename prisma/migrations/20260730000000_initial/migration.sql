CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ScheduleScope" AS ENUM ('ORGANIZATION', 'DEPARTMENT', 'PERSONAL');
CREATE TYPE "ScheduleCategory" AS ENUM ('GENERAL', 'MEETING', 'TRAINING', 'LEAVE', 'BUSINESS_TRIP', 'OUTING', 'OTHER');
CREATE TYPE "ScheduleView" AS ENUM ('WEEK', 'MONTH');

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false, "image" TEXT,
  "consentedAt" TIMESTAMP(3), "consentVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL, "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE TABLE "accounts" (
  "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3), "scope" TEXT, "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");
CREATE TABLE "verifications" (
  "id" TEXT PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

CREATE TABLE "organizations" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
  "joinCodeHash" TEXT NOT NULL UNIQUE, "joinCodeCiphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "departments" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL, "description" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isSystem" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("organizationId", "name")
);
CREATE INDEX "departments_organizationId_isActive_sortOrder_idx" ON "departments"("organizationId", "isActive", "sortOrder");
CREATE TABLE "memberships" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "departmentId" TEXT NOT NULL REFERENCES "departments"("id") ON DELETE RESTRICT,
  "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER', "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("userId", "organizationId")
);
CREATE INDEX "memberships_organizationId_status_departmentId_idx" ON "memberships"("organizationId", "status", "departmentId");
CREATE TABLE "join_requests" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "departmentId" TEXT REFERENCES "departments"("id") ON DELETE SET NULL, "rejectionReason" TEXT
);
CREATE INDEX "join_requests_organizationId_status_requestedAt_idx" ON "join_requests"("organizationId", "status", "requestedAt");
CREATE INDEX "join_requests_userId_status_idx" ON "join_requests"("userId", "status");
CREATE UNIQUE INDEX "join_requests_one_pending_per_user_org" ON "join_requests"("userId", "organizationId") WHERE "status" = 'PENDING';
CREATE TABLE "schedules" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "createdByUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updatedByUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "title" TEXT NOT NULL, "description" TEXT, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "isAllDay" BOOLEAN NOT NULL DEFAULT false, "scope" "ScheduleScope" NOT NULL,
  "category" "ScheduleCategory" NOT NULL DEFAULT 'GENERAL', "isImportant" BOOLEAN NOT NULL DEFAULT false,
  "departmentId" TEXT REFERENCES "departments"("id") ON DELETE RESTRICT,
  "targetUserId" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
  CONSTRAINT "schedule_time_valid" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "schedule_target_valid" CHECK (
    ("scope" = 'ORGANIZATION' AND "departmentId" IS NULL AND "targetUserId" IS NULL) OR
    ("scope" = 'DEPARTMENT' AND "departmentId" IS NOT NULL AND "targetUserId" IS NULL) OR
    ("scope" = 'PERSONAL' AND "departmentId" IS NULL AND "targetUserId" IS NOT NULL)
  )
);
CREATE INDEX "schedules_organizationId_startsAt_endsAt_idx" ON "schedules"("organizationId", "startsAt", "endsAt");
CREATE INDEX "schedules_organizationId_departmentId_startsAt_idx" ON "schedules"("organizationId", "departmentId", "startsAt");
CREATE INDEX "schedules_organizationId_targetUserId_startsAt_idx" ON "schedules"("organizationId", "targetUserId", "startsAt");
CREATE INDEX "schedules_organizationId_deletedAt_idx" ON "schedules"("organizationId", "deletedAt");
CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "type" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "resourceType" TEXT, "resourceId" TEXT,
  "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt" DESC);
CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "actorUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "metadataJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt" DESC);
CREATE TABLE "user_preferences" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "lastOrganizationId" TEXT REFERENCES "organizations"("id") ON DELETE SET NULL,
  "defaultScheduleView" "ScheduleView" NOT NULL DEFAULT 'WEEK', "updatedAt" TIMESTAMP(3) NOT NULL
);
