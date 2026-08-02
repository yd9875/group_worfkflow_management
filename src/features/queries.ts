import type { Prisma, ScheduleCategory } from "@prisma/client";
import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { decryptJoinCode } from "@/lib/join-code";
import { requireMembership, requireUser } from "@/lib/session";
import { canEditSchedule, isManager } from "@/features/permissions";

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
  view: "day" | "week" | "month";
  categories?: string[];
  departmentId?: string;
  memberId?: string;
}) {
  const membership = await requireMembership(input.organizationId);
  const rangeStart =
    input.view === "day"
      ? startOfDay(input.date)
      : input.view === "week"
      ? startOfWeek(input.date, { weekStartsOn: 1 })
      : startOfWeek(startOfMonth(input.date), { weekStartsOn: 1 });
  const rangeEnd =
    input.view === "day"
      ? endOfDay(input.date)
      : input.view === "week"
      ? endOfWeek(input.date, { weekStartsOn: 1 })
      : endOfWeek(endOfMonth(input.date), { weekStartsOn: 1 });

  const visibility: Prisma.ScheduleWhereInput = isManager(membership.role)
    ? {
        OR: [
          { scope: "ORGANIZATION" },
          { scope: "DEPARTMENT" },
          { scope: "PERSONAL", targetUserId: membership.userId },
        ],
      }
    : {
        OR: [
          { scope: "ORGANIZATION" },
          { scope: "DEPARTMENT", departmentId: membership.departmentId },
          { scope: "PERSONAL", targetUserId: membership.userId },
        ],
      };

  const scheduleCategories = new Set([
    "GENERAL", "MEETING", "TRAINING", "LEAVE", "BUSINESS_TRIP", "OUTING", "OTHER",
  ]);
  const selectedCategories = (input.categories ?? []).filter((category) => scheduleCategories.has(category));
  const categoryOptions: Prisma.ScheduleWhereInput[] = [];
  if (selectedCategories.length) {
    categoryOptions.push({ itemType: "SCHEDULE", category: { in: selectedCategories as ScheduleCategory[] } });
  }
  if (input.categories?.includes("TASK")) categoryOptions.push({ itemType: "TASK" });
  const categoryFilter: Prisma.ScheduleWhereInput = categoryOptions.length ? { OR: categoryOptions } : {};

  return prisma.schedule.findMany({
    where: {
      organizationId: input.organizationId,
      deletedAt: null,
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart },
      AND: [
        visibility,
        { OR: [{ scope: { not: "PERSONAL" } }, { showInWeek: true }] },
        categoryFilter,
        ...(input.departmentId ? [{ departmentId: input.departmentId }] : []),
        ...(input.memberId
          ? [{ OR: [{ targetUserId: input.memberId }, { createdByUserId: input.memberId }] }]
          : []),
      ],
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
      showInWeek: true,
      showInMonth: true,
      isCompleted: true,
      memo: true,
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

export async function getPlannerData(
  organizationId: string,
  date: Date,
  editId?: string,
) {
  const membership = await requireMembership(organizationId);
  const memoDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const [items, editItem, personalMemos] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        organizationId,
        targetUserId: membership.userId,
        scope: "PERSONAL",
        deletedAt: null,
        startsAt: { lt: endOfDay(date) },
        endsAt: { gt: startOfDay(date) },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    editId
      ? prisma.schedule.findFirst({
          where: { id: editId, organizationId, deletedAt: null },
        })
      : null,
    prisma.personalDailyMemo.findMany({
      where: { organizationId, userId: membership.userId, date: memoDate },
      select: { id: true, content: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    membership,
    items,
    editItem: editItem && canEditSchedule(membership, editItem) ? editItem : null,
    personalMemos,
  };
}

export async function getReportData(
  organizationId: string,
  date: Date,
  view: "day" | "week" | "month",
) {
  const membership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const [schedules, organization] = await Promise.all([
    listSchedules({ organizationId, date, view }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        reportReference: true,
        reportReferencePrinciples: {
          select: { id: true, content: true },
          orderBy: { createdAt: "asc" },
        },
        reportReferenceFiles: {
          select: { fileName: true, mimeType: true, size: true, objectKey: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);
  return { membership, schedules, organization };
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

export type AdminSection = "requests" | "departments" | "members" | "settings" | "audit-logs";

export async function getAdminData(organizationId: string, section: AdminSection) {
  const currentMembership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const [requests, departments, members, auditLogs, reportReferenceFiles, savedReportPrinciples] = await Promise.all([
    section === "requests" ? prisma.joinRequest.findMany({
      where: { organizationId, status: "PENDING" },
      select: {
        id: true,
        requestedAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { requestedAt: "asc" },
      take: 100,
    }) : Promise.resolve([]),
    section === "requests" || section === "departments" || section === "members" ? prisma.department.findMany({
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
    }) : Promise.resolve([]),
    section === "members" ? prisma.membership.findMany({
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
    }) : Promise.resolve([]),
    section === "audit-logs" ? prisma.auditLog.findMany({
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
    }) : Promise.resolve([]),
    section === "settings" ? prisma.reportReferenceFile.findMany({
      where: { organizationId },
      select: { id: true, fileName: true, mimeType: true, size: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    }) : Promise.resolve([]),
    section === "settings" ? prisma.reportReferencePrinciple.findMany({
      where: { organizationId },
      select: { id: true, content: true },
      orderBy: { createdAt: "asc" },
    }) : Promise.resolve([]),
  ]);
  const reportPrinciples = [
    ...(currentMembership.organization.reportReference?.trim()
      ? [{ id: "legacy", content: currentMembership.organization.reportReference.trim() }]
      : []),
    ...savedReportPrinciples,
  ];
  const joinCode = section === "settings"
    ? decryptJoinCode(currentMembership.organization.joinCodeCiphertext)
    : null;
  return { currentMembership, requests, departments, members, auditLogs, reportReferenceFiles, reportPrinciples, joinCode };
}
