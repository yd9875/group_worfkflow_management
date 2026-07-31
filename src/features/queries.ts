import type { Prisma } from "@prisma/client";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { decryptJoinCode } from "@/lib/join-code";
import { requireMembership, requireUser } from "@/lib/session";
import { isManager } from "@/features/permissions";

export async function listMyOrganizations() {
  const user = await requireUser();
  return prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: {
      id: true,
      organizationId: true,
      role: true,
      organization: {
        select: { id: true, name: true, description: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
}

export const getOrganizationShellContext = cache(async (organizationId: string) => {
  const membership = await requireMembership(organizationId);
  const unreadCount = await prisma.notification.count({
    where: { userId: membership.userId, organizationId, readAt: null },
  });
  const joinCode = decryptJoinCode(membership.organization.joinCodeCiphertext);
  return { membership, unreadCount, joinCode };
});

export const getScheduleContext = cache(async (organizationId: string) => {
  const membership = await requireMembership(organizationId);
  const [departments, members] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, isSystem: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        departmentId: true,
        profileName: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ department: { sortOrder: "asc" } }, { user: { name: "asc" } }],
      take: 250,
    }),
  ]);
  return { membership, departments, members };
});

export const getMembersData = cache(async (organizationId: string) => {
  await requireMembership(organizationId);
  return prisma.membership.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      profileName: true,
      user: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true, isSystem: true } },
    },
    orderBy: [{ department: { sortOrder: "asc" } }, { user: { name: "asc" } }],
    take: 250,
  });
});

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
    select: {
      id: true,
      title: true,
      description: true,
      itemType: true,
      startsAt: true,
      endsAt: true,
      isAllDay: true,
      scope: true,
      category: true,
      isImportant: true,
      departmentId: true,
      targetUserId: true,
      createdByUserId: true,
      department: { select: { name: true } },
      targetUser: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ startsAt: "asc" }, { isImportant: "desc" }],
    take: 1000,
  });
}

export async function listNotifications(organizationId: string) {
  const membership = await requireMembership(organizationId);
  return prisma.notification.findMany({
    where: { organizationId, userId: membership.userId },
    select: {
      id: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getAdminData(organizationId: string) {
  const currentMembership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const [requests, departments, members, auditLogs] = await Promise.all([
    prisma.joinRequest.findMany({
      where: { organizationId, status: "PENDING" },
      select: {
        id: true,
        requestedAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { requestedAt: "asc" },
      take: 100,
    }),
    prisma.department.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true,
        userId: true,
        departmentId: true,
        role: true,
        status: true,
        profileName: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
      take: 250,
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { currentMembership, requests, departments, members, auditLogs };
}
