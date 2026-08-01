import type {
  Membership,
  OrganizationRole,
  Schedule,
  ScheduleScope,
} from "@prisma/client";

type MembershipIdentity = Pick<
  Membership,
  "userId" | "organizationId" | "departmentId" | "role" | "status"
>;

type ScheduleIdentity = Pick<
  Schedule,
  | "organizationId"
  | "createdByUserId"
  | "targetUserId"
  | "departmentId"
  | "scope"
  | "deletedAt"
> & { category?: Schedule["category"] };

export function isManager(role: OrganizationRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canViewSchedule(
  member: MembershipIdentity,
  schedule: ScheduleIdentity,
) {
  if (
    member.status !== "ACTIVE" ||
    member.organizationId !== schedule.organizationId ||
    schedule.deletedAt
  ) {
    return false;
  }
  if (isManager(member.role)) {
    return schedule.scope !== "PERSONAL" || schedule.targetUserId === member.userId;
  }
  if (schedule.scope === "ORGANIZATION") return true;
  if (schedule.scope === "DEPARTMENT") {
    return schedule.departmentId === member.departmentId;
  }
  return schedule.targetUserId === member.userId;
}

export function canCreateSchedule(
  member: MembershipIdentity,
  scope: ScheduleScope,
  target?: { departmentId?: string | null; targetUserId?: string | null },
) {
  if (member.status !== "ACTIVE") return false;
  if (isManager(member.role)) return true;
  if (scope === "ORGANIZATION") return false;
  if (scope === "DEPARTMENT") {
    return target?.departmentId === member.departmentId;
  }
  return target?.targetUserId === member.userId;
}

export function canEditSchedule(
  member: MembershipIdentity,
  schedule: ScheduleIdentity,
) {
  if (!canViewSchedule(member, schedule)) return false;
  if (isManager(member.role)) return true;
  if (
    (schedule.category === "OUTING" ||
      schedule.category === "LEAVE" ||
      schedule.category === "BUSINESS_TRIP") &&
    schedule.createdByUserId === member.userId
  ) {
    return true;
  }
  if (schedule.scope === "PERSONAL") {
    return schedule.targetUserId === member.userId;
  }
  return (
    schedule.scope === "DEPARTMENT" &&
    schedule.departmentId === member.departmentId &&
    schedule.createdByUserId === member.userId
  );
}

export function roleCanManageRole(
  actor: OrganizationRole,
  current: OrganizationRole,
  next: OrganizationRole,
) {
  if (actor !== "OWNER") return false;
  return current !== next;
}
