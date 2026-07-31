import type { Prisma } from "@prisma/client";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMembership, requireUser } from "@/lib/session";
import { isManager } from "@/features/permissions";

export async function listMyOrganizations() {
  const user = await requireUser();
  return prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { organization: true, department: true },
    orderBy: { joinedAt: "asc" },
  });
}

export async function getOrganizationContext(organizationId: string) {
  const membership = await requireMembership(organizationId);
  const [departments, members, unreadCount] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: { user: true, department: true },
      orderBy: [{ department: { sortOrder: "asc" } }, { user: { name: "asc" } }],
      take: 250,
    }),
    prisma.notification.count({
      where: { userId: membership.userId, organizationId, readAt: null },
    }),
  ]);
  return { membership, departments, members, unreadCount };
}

export async function listSchedules(input: {
  organizationId: string;
  date: Date;
  view: "week" | "month";
}) {
  const membership = await requireMembership(input.organizationId);
  const rangeStart =
    input.view === "week"
      ? startOfWeek(input.date, { weekStartsOn: 1 })
      : startOfWeek(startOfMonth(input.date), { weekStartsOn: 1 });
  const rangeEnd =
    input.view === "week"
      ? endOfWeek(input.date, { weekStartsOn: 1 })
      : endOfWeek(endOfMonth(input.date), { weekStartsOn: 1 });

  const visibility: Prisma.ScheduleWhereInput = isManager(membership.role)
    ? {}
    : {
        OR: [
          { scope: "ORGANIZATION" },
          { scope: "DEPARTMENT", departmentId: membership.departmentId },
          { scope: "PERSONAL", targetUserId: membership.userId },
        ],
      };

  return prisma.schedule.findMany({
    where: {
      organizationId: input.organizationId,
      deletedAt: null,
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart },
      ...visibility,
    },
    include: {
      department: true,
      targetUser: true,
      createdBy: true,
    },
    orderBy: [{ startsAt: "asc" }, { isImportant: "desc" }],
    take: 1000,
  });
}

export async function listNotifications(organizationId: string) {
  const membership = await requireMembership(organizationId);
  return prisma.notification.findMany({
    where: { organizationId, userId: membership.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getAdminData(organizationId: string) {
  const currentMembership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const [requests, departments, members, auditLogs] = await Promise.all([
    prisma.joinRequest.findMany({
      where: { organizationId, status: "PENDING" },
      include: { user: true },
      orderBy: { requestedAt: "asc" },
      take: 100,
    }),
    prisma.department.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: true, department: true },
      orderBy: { joinedAt: "asc" },
      take: 250,
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { currentMembership, requests, departments, members, auditLogs };
}
