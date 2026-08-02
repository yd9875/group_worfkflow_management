"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  createJoinCode,
  encryptJoinCode,
  hashJoinCode,
  normalizeJoinCode,
} from "@/lib/join-code";
import { requireMembership, requireUser } from "@/lib/session";
import {
  canCreateSchedule,
  canEditSchedule,
  isManager,
  roleCanManageRole,
} from "@/features/permissions";
import { adjacentSortUpdates, scheduleInputSchema } from "@/features/schedule-rules";
import { deleteR2Object, deleteR2Objects, putR2Object } from "@/lib/r2";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
});

const MAX_REPORT_REFERENCE_FILE_SIZE = 20 * 1024 * 1024;
const REPORT_REFERENCE_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isSpecialScheduleCategory(category: string) {
  return (
    category === "OUTING" ||
    category === "LEAVE" ||
    category === "BUSINESS_TRIP"
  );
}

export async function createOrganizationAction(formData: FormData) {
  const user = await requireUser();
  const input = organizationSchema.parse({
    name: text(formData, "name"),
    description: text(formData, "description") || undefined,
  });
  const joinCode = createJoinCode();

  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        ...input,
        joinCodeHash: hashJoinCode(joinCode),
        joinCodeCiphertext: encryptJoinCode(joinCode),
      },
    });
    const department = await tx.department.create({
      data: {
        organizationId: created.id,
        name: "미지정",
        description: "아직 부서가 지정되지 않은 구성원",
        isSystem: true,
        sortOrder: 9999,
      },
    });
    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: created.id,
        departmentId: department.id,
        role: "OWNER",
      },
    });
    await tx.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, lastOrganizationId: created.id },
      update: { lastOrganizationId: created.id },
    });
    await tx.auditLog.create({
      data: {
        organizationId: created.id,
        actorUserId: user.id,
        action: "ORGANIZATION_CREATED",
        entityType: "ORGANIZATION",
        entityId: created.id,
        metadataJson: { name: created.name },
      },
    });
    return created;
  });

  redirect(`/org/${organization.id}/schedule/week`);
}

export async function requestJoinAction(formData: FormData) {
  const user = await requireUser();
  const code = normalizeJoinCode(text(formData, "code"));
  if (code.length < 8 || code.length > 12) {
    throw new AppError("VALIDATION_ERROR", "입장 코드를 확인해 주세요.");
  }
  const organization = await prisma.organization.findUnique({
    where: { joinCodeHash: hashJoinCode(code) },
  });
  if (!organization) {
    throw new AppError("NOT_FOUND", "유효한 입장 코드를 찾지 못했습니다.", 404);
  }

  const existingMember = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
  });
  if (existingMember?.status === "ACTIVE") {
    throw new AppError("CONFLICT", "이미 참여 중인 조직입니다.", 409);
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.joinRequest.create({
      data: { organizationId: organization.id, userId: user.id },
    });
    const managers = await tx.membership.findMany({
      where: {
        organizationId: organization.id,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { userId: true },
    });
    await tx.notification.createMany({
      data: managers.map(({ userId }) => ({
        userId,
        organizationId: organization.id,
        type: "JOIN_REQUESTED",
        title: "새 입장 신청",
        body: `${user.name} 님이 조직 입장을 신청했습니다.`,
        resourceType: "JOIN_REQUEST",
        resourceId: request.id,
      })),
    });
  });
  revalidatePath("/organizations");
}

async function scheduleRecipients(input: {
  organizationId: string;
  scope: "ORGANIZATION" | "DEPARTMENT" | "PERSONAL";
  departmentId?: string | null;
  targetUserId?: string | null;
}) {
  if (input.scope === "PERSONAL") return input.targetUserId ? [input.targetUserId] : [];
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      ...(input.scope === "DEPARTMENT"
        ? { departmentId: input.departmentId ?? undefined }
        : {}),
    },
    select: { userId: true },
  });
  return memberships.map((member) => member.userId);
}

export async function createScheduleAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const category = text(formData, "category");
  const specialCategory = isSpecialScheduleCategory(category);
  const scope = specialCategory ? "ORGANIZATION" : text(formData, "scope");
  const parsed = scheduleInputSchema.parse({
    organizationId,
    title: text(formData, "title"),
    description: text(formData, "description") || undefined,
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    isAllDay: formData.get("isAllDay") === "on",
    scope,
    category,
    isImportant: formData.get("isImportant") === "on",
    departmentId: specialCategory ? null : text(formData, "departmentId") || null,
    targetUserId: null,
  });
  if (!specialCategory && !canCreateSchedule(membership, parsed.scope, parsed)) {
    throw new AppError("FORBIDDEN", "이 범위의 일정을 등록할 권한이 없습니다.", 403);
  }

  const shouldNotify = parsed.isImportant || parsed.scope !== "PERSONAL";
  const [department, recipients] = await Promise.all([
    parsed.departmentId ? prisma.department.findFirst({
      where: { id: parsed.departmentId, organizationId, isActive: true },
    }) : Promise.resolve(null),
    shouldNotify ? scheduleRecipients(parsed) : Promise.resolve([]),
  ]);
  if (parsed.departmentId && !department) {
    throw new AppError("VALIDATION_ERROR", "대상 부서가 올바르지 않습니다.");
  }
  if (parsed.targetUserId) {
    const target = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: parsed.targetUserId,
          organizationId,
        },
      },
    });
    if (!target || target.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "대상 구성원이 올바르지 않습니다.");
    }
  }

  const scheduleId = randomUUID();
  const notifications = recipients
    .filter((userId) => userId !== membership.userId)
    .map((userId) => ({
      userId,
      organizationId,
      type: "SCHEDULE_CREATED",
      title: parsed.isImportant ? "중요 일정이 등록되었습니다" : "새 일정이 등록되었습니다",
      body: parsed.title,
      resourceType: "SCHEDULE",
      resourceId: scheduleId,
    }));
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.schedule.create({
      data: {
        id: scheduleId,
        ...parsed,
        itemType: "SCHEDULE",
        description: parsed.description || null,
        departmentId: parsed.scope === "DEPARTMENT" ? parsed.departmentId : null,
        targetUserId: parsed.scope === "PERSONAL" ? parsed.targetUserId : null,
        createdByUserId: membership.userId,
        updatedByUserId: membership.userId,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "SCHEDULE_CREATED",
        entityType: "SCHEDULE",
        entityId: scheduleId,
        metadataJson: { scope: parsed.scope, category: parsed.category },
      },
    }),
  ];
  if (notifications.length) {
    writes.push(prisma.notification.createMany({ data: notifications }));
  }
  await prisma.$transaction(writes);
  revalidatePath(`/org/${organizationId}/schedule/week`);
  revalidatePath(`/org/${organizationId}/schedule/month`);
  revalidatePath(`/org/${organizationId}/schedule/day`);
}

export async function createTaskAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const input = z
    .object({
      title: z.string().trim().min(1).max(100),
      description: z.string().trim().max(2000).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      scope: z.enum(["ORGANIZATION", "DEPARTMENT"]),
      departmentId: z.string().uuid().nullable(),
      isImportant: z.boolean(),
    })
    .parse({
      title: text(formData, "title"),
      description: text(formData, "description") || undefined,
      date: text(formData, "date"),
      scope: text(formData, "scope"),
      departmentId: text(formData, "departmentId") || null,
      isImportant: formData.get("isImportant") === "on",
    });
  if (!canCreateSchedule(membership, input.scope, input)) {
    throw new AppError("FORBIDDEN", "이 위치에 업무를 등록할 권한이 없습니다.", 403);
  }
  if (input.scope === "DEPARTMENT") {
    if (!input.departmentId) {
      throw new AppError("VALIDATION_ERROR", "업무를 표시할 부서를 선택해 주세요.");
    }
    const department = await prisma.department.findFirst({
      where: {
        id: input.departmentId,
        organizationId,
        isActive: true,
        isSystem: false,
      },
    });
    if (!department) {
      throw new AppError("VALIDATION_ERROR", "대상 부서가 올바르지 않습니다.");
    }
  }
  const startsAt = new Date(`${input.date}T00:00:00+09:00`);
  const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);

  const taskId = randomUUID();
  await prisma.$transaction([
    prisma.schedule.create({
      data: {
        id: taskId,
        organizationId,
        createdByUserId: membership.userId,
        updatedByUserId: membership.userId,
        title: input.title,
        description: input.description || null,
        itemType: "TASK",
        startsAt,
        endsAt,
        isAllDay: true,
        scope: input.scope,
        category: "GENERAL",
        isImportant: input.isImportant,
        departmentId: input.scope === "DEPARTMENT" ? input.departmentId : null,
        targetUserId: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "TASK_CREATED",
        entityType: "SCHEDULE",
        entityId: taskId,
        metadataJson: { important: input.isImportant },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/schedule/week`);
  revalidatePath(`/org/${organizationId}/schedule/month`);
  revalidatePath(`/org/${organizationId}/schedule/day`);
}

const personalEntrySchema = z.object({
  itemType: z.enum(["SCHEDULE", "TASK"]),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  memo: z.string().trim().max(4000).optional(),
  departmentId: z.string().uuid().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  category: z.enum([
    "GENERAL",
    "MEETING",
    "TRAINING",
    "LEAVE",
    "BUSINESS_TRIP",
    "OUTING",
    "OTHER",
  ]),
  isAllDay: z.boolean(),
  isImportant: z.boolean(),
  showInSchedule: z.boolean(),
  isCompleted: z.boolean(),
}).refine((value) => value.endsAt > value.startsAt, {
  path: ["endsAt"],
  message: "종료 시각은 시작 시각보다 늦어야 합니다.",
});

function personalEntryInput(formData: FormData) {
  const itemType = text(formData, "itemType");
  const category = text(formData, "category");
  const isLeave = itemType === "SCHEDULE" && category === "LEAVE";
  const returnDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(text(formData, "returnDate"));
  const taskStartsAt = new Date(`${returnDate}T00:00:00+09:00`);
  const taskEndsAt = new Date(taskStartsAt.getTime() + 24 * 60 * 60 * 1000);
  return personalEntrySchema.parse({
    itemType,
    title: text(formData, "title"),
    description: text(formData, "description") || undefined,
    memo: text(formData, "memo") || undefined,
    departmentId: text(formData, "departmentId") || null,
    startsAt: itemType === "TASK" || isLeave ? taskStartsAt : text(formData, "startsAt"),
    endsAt: itemType === "TASK" || isLeave ? taskEndsAt : text(formData, "endsAt"),
    category,
    isAllDay: itemType === "TASK" || isLeave || formData.get("isAllDay") === "on",
    isImportant: !isLeave && formData.get("isImportant") === "on",
    showInSchedule: isLeave || formData.get("showInSchedule") === "on",
    isCompleted: !isLeave && formData.get("isCompleted") === "on",
  });
}

function revalidatePersonalPlanner(organizationId: string) {
  revalidatePath(`/org/${organizationId}/personal`);
}

export async function createPersonalEntryAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const input = personalEntryInput(formData);
  if (input.departmentId && (membership.department.isSystem || input.departmentId !== membership.departmentId)) {
    throw new AppError("VALIDATION_ERROR", "표시 위치는 공통사항 또는 본인이 속한 부서만 선택할 수 있습니다.");
  }
  const { showInSchedule, departmentId, ...entryInput } = input;
  const lastEntry = await prisma.schedule.aggregate({
    where: {
      organizationId,
      targetUserId: membership.userId,
      scope: "PERSONAL",
      itemType: input.itemType,
      deletedAt: null,
    },
    _max: { sortOrder: true },
  });
  const entryId = randomUUID();
  await prisma.$transaction([
    prisma.schedule.create({
      data: {
        id: entryId,
        organizationId,
        createdByUserId: membership.userId,
        updatedByUserId: membership.userId,
        targetUserId: membership.userId,
        departmentId,
        scope: "PERSONAL",
        ...entryInput,
        showInWeek: showInSchedule,
        showInMonth: showInSchedule,
        sortOrder: (lastEntry._max.sortOrder ?? -1) + 1,
        description: input.description || null,
        memo: input.memo || null,
        category: input.itemType === "TASK" ? "GENERAL" : input.category,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "PERSONAL_ENTRY_CREATED",
        entityType: "SCHEDULE",
        entityId: entryId,
        metadataJson: { itemType: input.itemType },
      },
    }),
  ]);
  revalidatePersonalPlanner(organizationId);
  redirect(`/org/${organizationId}/personal?date=${text(formData, "returnDate")}`);
}

export async function updateScheduleAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const scheduleId = z.string().uuid().parse(text(formData, "scheduleId"));
  const membership = await requireMembership(organizationId);
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, organizationId, deletedAt: null },
  });
  if (!schedule) throw new AppError("NOT_FOUND", "일정 또는 업무를 찾지 못했습니다.", 404);
  if (!canEditSchedule(membership, schedule)) {
    throw new AppError("FORBIDDEN", "이 항목을 수정할 권한이 없습니다.", 403);
  }
  const input = personalEntryInput(formData);
  if (input.departmentId && (membership.department.isSystem || input.departmentId !== membership.departmentId)) {
    throw new AppError("VALIDATION_ERROR", "표시 위치는 공통사항 또는 본인이 속한 부서만 선택할 수 있습니다.");
  }
  const { showInSchedule, departmentId, ...entryInput } = input;
  await prisma.$transaction([
    prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        ...entryInput,
        description: input.description || null,
        memo: input.memo || null,
        showInWeek: showInSchedule,
        showInMonth: showInSchedule,
        departmentId: schedule.scope === "PERSONAL" ? departmentId : schedule.departmentId,
        itemType: schedule.scope === "PERSONAL" ? input.itemType : schedule.itemType,
        category:
          schedule.scope === "PERSONAL" && input.itemType === "TASK"
            ? "GENERAL"
            : input.category,
        updatedByUserId: membership.userId,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "SCHEDULE_UPDATED",
        entityType: "SCHEDULE",
        entityId: schedule.id,
        metadataJson: { title: input.title },
      },
    }),
  ]);
  revalidatePersonalPlanner(organizationId);
  redirect(`/org/${organizationId}/personal?date=${text(formData, "returnDate")}`);
}

export async function createPersonalDailyMemoAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(text(formData, "date"));
  const content = z.string().trim().min(1).max(20000).parse(text(formData, "content"));
  const memoDate = new Date(`${date}T00:00:00.000Z`);
  await prisma.personalDailyMemo.create({
    data: { organizationId, userId: membership.userId, date: memoDate, content },
  });
  revalidatePath(`/org/${organizationId}/personal`);
  redirect(`/org/${organizationId}/personal?date=${date}`);
}

export async function updatePersonalDailyMemoAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const memoId = z.string().uuid().parse(text(formData, "memoId"));
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(text(formData, "date"));
  const content = z.string().trim().min(1).max(20000).parse(text(formData, "content"));
  const result = await prisma.personalDailyMemo.updateMany({
    where: { id: memoId, organizationId, userId: membership.userId },
    data: { content },
  });
  if (!result.count) throw new AppError("NOT_FOUND", "메모를 찾을 수 없습니다.", 404);
  revalidatePath(`/org/${organizationId}/personal`);
  redirect(`/org/${organizationId}/personal?date=${date}`);
}

export async function deletePersonalDailyMemoAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const memoId = z.string().uuid().parse(text(formData, "memoId"));
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(text(formData, "date"));
  const result = await prisma.personalDailyMemo.deleteMany({
    where: { id: memoId, organizationId, userId: membership.userId },
  });
  if (!result.count) throw new AppError("NOT_FOUND", "메모를 찾을 수 없습니다.", 404);
  revalidatePath(`/org/${organizationId}/personal`);
  redirect(`/org/${organizationId}/personal?date=${date}`);
}

export async function movePersonalEntryAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const scheduleId = z.string().uuid().parse(text(formData, "scheduleId"));
  const direction = z.enum(["up", "down"]).parse(text(formData, "direction"));
  const returnDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(text(formData, "returnDate"));
  const dayStart = new Date(`${returnDate}T00:00:00+09:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const entries = await prisma.schedule.findMany({
    where: {
      organizationId,
      targetUserId: membership.userId,
      scope: "PERSONAL",
      deletedAt: null,
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    select: { id: true, itemType: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const selected = entries.find((entry) => entry.id === scheduleId);
  if (!selected) throw new AppError("FORBIDDEN", "항목 순서를 변경할 권한이 없습니다.", 403);
  const updates = adjacentSortUpdates(
    entries.filter((entry) => entry.itemType === selected.itemType),
    scheduleId,
    direction,
  );
  if (!updates.length) return;
  await prisma.$transaction(
    updates.map(({ id, sortOrder }) => prisma.schedule.update({ where: { id }, data: { sortOrder } })),
  );
  revalidatePersonalPlanner(organizationId);
}

export async function toggleTaskCompleteAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const scheduleId = z.string().uuid().parse(text(formData, "scheduleId"));
  const membership = await requireMembership(organizationId);
  const nextCompleted = z.enum(["true", "false"]).parse(text(formData, "nextCompleted")) === "true";
  const returnView = z.enum(["personal", "day"]).parse(text(formData, "returnView"));
  const editableScope: Prisma.ScheduleWhereInput = isManager(membership.role)
    ? {
        OR: [
          { scope: { not: "PERSONAL" } },
          { scope: "PERSONAL", targetUserId: membership.userId },
        ],
      }
    : {
        OR: [
          { scope: "PERSONAL", targetUserId: membership.userId },
          {
            scope: "DEPARTMENT",
            departmentId: membership.departmentId,
            createdByUserId: membership.userId,
          },
        ],
      };
  const result = await prisma.schedule.updateMany({
    where: {
      id: scheduleId,
      organizationId,
      itemType: "TASK",
      deletedAt: null,
      AND: [editableScope],
    },
    data: { isCompleted: nextCompleted, updatedByUserId: membership.userId },
  });
  if (!result.count) {
    throw new AppError("FORBIDDEN", "이 업무의 완료 상태를 변경할 수 없습니다.", 403);
  }
  revalidatePath(`/org/${organizationId}/${returnView === "personal" ? "personal" : "schedule/day"}`);
}

export async function deleteScheduleAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const scheduleId = text(formData, "scheduleId");
  const membership = await requireMembership(organizationId);
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, organizationId, deletedAt: null },
  });
  if (!schedule) throw new AppError("NOT_FOUND", "일정을 찾지 못했습니다.", 404);
  if (!canEditSchedule(membership, schedule)) {
    throw new AppError("FORBIDDEN", "이 일정을 삭제할 권한이 없습니다.", 403);
  }
  await prisma.$transaction([
    prisma.schedule.update({
      where: { id: schedule.id },
      data: { deletedAt: new Date(), updatedByUserId: membership.userId },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "SCHEDULE_DELETED",
        entityType: "SCHEDULE",
        entityId: schedule.id,
        metadataJson: { title: schedule.title },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/schedule/week`);
  revalidatePath(`/org/${organizationId}/schedule/month`);
  revalidatePath(`/org/${organizationId}/schedule/day`);
  revalidatePath(`/org/${organizationId}/personal`);
}

export async function createDepartmentAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const input = z
    .object({
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(300).optional(),
    })
    .parse({
      name: text(formData, "name"),
      description: text(formData, "description") || undefined,
    });
  const departmentId = randomUUID();
  await prisma.$transaction([
    prisma.department.create({
      data: { id: departmentId, organizationId, ...input },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "DEPARTMENT_CREATED",
        entityType: "DEPARTMENT",
        entityId: departmentId,
        metadataJson: { name: input.name },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/admin/departments`);
}

export async function updateDepartmentAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const input = z
    .object({
      departmentId: z.string().uuid(),
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(300).optional(),
    })
    .parse({
      departmentId: text(formData, "departmentId"),
      name: text(formData, "name"),
      description: text(formData, "description") || undefined,
    });
  const department = await prisma.department.findFirst({
    where: {
      id: input.departmentId,
      organizationId,
      isActive: true,
      isSystem: false,
    },
  });
  if (!department) {
    throw new AppError("NOT_FOUND", "수정할 부서를 찾지 못했습니다.", 404);
  }
  await prisma.$transaction([
    prisma.department.update({
      where: { id: department.id },
      data: { name: input.name, description: input.description || null },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "DEPARTMENT_UPDATED",
        entityType: "DEPARTMENT",
        entityId: department.id,
        metadataJson: { name: input.name },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/admin/departments`);
  revalidatePath(`/org/${organizationId}/schedule/week`);
}

export async function deleteDepartmentAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const departmentId = z.string().uuid().parse(text(formData, "departmentId"));
  const [department, fallback] = await Promise.all([
    prisma.department.findFirst({
      where: { id: departmentId, organizationId, isActive: true, isSystem: false },
    }),
    prisma.department.findFirst({
      where: { organizationId, isActive: true, isSystem: true },
    }),
  ]);
  if (!department) {
    throw new AppError("NOT_FOUND", "삭제할 부서를 찾지 못했습니다.", 404);
  }
  if (!fallback) {
    throw new AppError("CONFLICT", "구성원을 이동할 기본 부서가 없습니다.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.updateMany({
      where: { organizationId, departmentId },
      data: { departmentId: fallback.id },
    });
    await tx.joinRequest.updateMany({
      where: { organizationId, departmentId },
      data: { departmentId: null },
    });
    await tx.schedule.updateMany({
      where: { organizationId, departmentId, deletedAt: null },
      data: { deletedAt: new Date(), updatedByUserId: membership.userId },
    });
    await tx.department.update({
      where: { id: department.id },
      data: {
        name: `삭제됨-${department.id}`,
        isActive: false,
        description: department.description,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "DEPARTMENT_DELETED",
        entityType: "DEPARTMENT",
        entityId: department.id,
        metadataJson: { name: department.name },
      },
    });
  });
  revalidatePath(`/org/${organizationId}/admin/departments`);
  revalidatePath(`/org/${organizationId}/admin/members`);
  revalidatePath(`/org/${organizationId}/schedule/week`);
  revalidatePath(`/org/${organizationId}/schedule/month`);
}

export async function updateOrganizationProfileAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId);
  const profileName = z
    .string()
    .trim()
    .max(60)
    .parse(text(formData, "profileName"));
  await prisma.membership.update({
    where: { id: membership.id },
    data: { profileName: profileName || null },
  });
  revalidatePath("/account");
  revalidatePath(`/org/${organizationId}`, "layout");
}

export async function deleteOrganizationAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const membership = await requireMembership(organizationId, ["OWNER"]);
  const confirmation = text(formData, "confirmation").trim();
  if (confirmation !== membership.organization.name) {
    throw new AppError("VALIDATION_ERROR", "조직 이름을 정확히 입력해 주세요.");
  }

  const referenceFiles = await prisma.reportReferenceFile.findMany({
    where: { organizationId },
    select: { objectKey: true },
  });
  await deleteR2Objects(referenceFiles.map((file) => file.objectKey));

  await prisma.$transaction(async (tx) => {
    await tx.userPreference.updateMany({
      where: { lastOrganizationId: organizationId },
      data: { lastOrganizationId: null },
    });
    await tx.notification.deleteMany({ where: { organizationId } });
    await tx.auditLog.deleteMany({ where: { organizationId } });
    await tx.schedule.deleteMany({ where: { organizationId } });
    await tx.joinRequest.deleteMany({ where: { organizationId } });
    await tx.membership.deleteMany({ where: { organizationId } });
    await tx.department.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });
  });
  redirect("/organizations");
}

export async function approveJoinRequestAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const requestId = text(formData, "requestId");
  const departmentId = text(formData, "departmentId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  await prisma.$transaction(async (tx) => {
    const request = await tx.joinRequest.findFirst({
      where: { id: requestId, organizationId, status: "PENDING" },
    });
    const department = await tx.department.findFirst({
      where: { id: departmentId, organizationId, isActive: true },
    });
    if (!request || !department) {
      throw new AppError("NOT_FOUND", "입장 신청 또는 부서를 찾지 못했습니다.", 404);
    }
    await tx.membership.upsert({
      where: {
        userId_organizationId: { userId: request.userId, organizationId },
      },
      create: {
        userId: request.userId,
        organizationId,
        departmentId,
        role: "MEMBER",
      },
      update: { status: "ACTIVE", departmentId, role: "MEMBER" },
    });
    await tx.joinRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: actor.userId,
        departmentId,
      },
    });
    await tx.notification.create({
      data: {
        userId: request.userId,
        organizationId,
        type: "JOIN_APPROVED",
        title: "입장이 승인되었습니다",
        body: `${actor.organization.name}에 참여할 수 있습니다.`,
        resourceType: "ORGANIZATION",
        resourceId: organizationId,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "JOIN_REQUEST_APPROVED",
        entityType: "JOIN_REQUEST",
        entityId: request.id,
        metadataJson: { departmentId },
      },
    });
  });
  revalidatePath(`/org/${organizationId}/admin/requests`);
}

export async function rejectJoinRequestAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const requestId = text(formData, "requestId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  await prisma.$transaction(async (tx) => {
    const request = await tx.joinRequest.findFirst({
      where: { id: requestId, organizationId, status: "PENDING" },
    });
    if (!request) throw new AppError("NOT_FOUND", "입장 신청을 찾지 못했습니다.", 404);
    await tx.joinRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        rejectionReason: text(formData, "reason") || null,
        reviewedAt: new Date(),
        reviewedById: actor.userId,
      },
    });
    await tx.notification.create({
      data: {
        userId: request.userId,
        organizationId,
        type: "JOIN_REJECTED",
        title: "입장 신청 결과",
        body: "입장 신청이 승인되지 않았습니다.",
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "JOIN_REQUEST_REJECTED",
        entityType: "JOIN_REQUEST",
        entityId: request.id,
        metadataJson: {},
      },
    });
  });
  revalidatePath(`/org/${organizationId}/admin/requests`);
}

export async function updateMemberAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const membershipId = text(formData, "membershipId");
  const nextDepartmentId = text(formData, "departmentId");
  const [member, department] = await Promise.all([
    prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    }),
    prisma.department.findFirst({
      where: { id: nextDepartmentId, organizationId, isActive: true },
    }),
  ]);
  if (!member) throw new AppError("NOT_FOUND", "구성원을 찾지 못했습니다.", 404);
  const nextRole = z
    .enum(["OWNER", "ADMIN", "MEMBER"])
    .parse(text(formData, "role"));
  if (member.role === "OWNER" && actor.role !== "OWNER") {
    throw new AppError("FORBIDDEN", "소유자의 정보는 소유자만 변경할 수 있습니다.", 403);
  }
  if (nextRole !== member.role && !roleCanManageRole(actor.role, member.role, nextRole)) {
    throw new AppError("FORBIDDEN", "역할을 변경할 권한이 없습니다.", 403);
  }
  if (!department) throw new AppError("VALIDATION_ERROR", "부서를 확인해 주세요.");

  if (member.role === "OWNER" && nextRole !== "OWNER") {
    if (member.id !== actor.id) {
      throw new AppError("FORBIDDEN", "본인의 소유자 역할만 이전할 수 있습니다.", 403);
    }
    const successorMembershipId = text(formData, "successorMembershipId");
    const successor = await prisma.membership.findFirst({
      where: {
        id: successorMembershipId,
        organizationId,
        status: "ACTIVE",
        userId: { not: member.userId },
      },
      select: { id: true, userId: true },
    });
    if (!successor) {
      throw new AppError(
        "VALIDATION_ERROR",
        "소유자 역할을 변경하려면 새 소유자를 선택해 주세요.",
      );
    }
    await prisma.$transaction([
      prisma.membership.update({
        where: { id: member.id },
        data: { role: nextRole, departmentId: nextDepartmentId },
      }),
      prisma.membership.update({
        where: { id: successor.id },
        data: { role: "OWNER" },
      }),
      prisma.notification.create({
        data: {
          userId: successor.userId,
          organizationId,
          type: "OWNERSHIP_TRANSFERRED",
          title: "조직 소유권을 이전받았습니다",
          body: `${actor.organization.name}의 새 소유자가 되었습니다.`,
          resourceType: "ORGANIZATION",
          resourceId: organizationId,
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor.userId,
          action: "OWNERSHIP_TRANSFERRED",
          entityType: "MEMBERSHIP",
          entityId: successor.id,
          metadataJson: {
            previousOwnerRole: nextRole,
            nextOwnerUserId: successor.userId,
          },
        },
      }),
    ]);
    revalidatePath(`/org/${organizationId}/admin/members`);
    revalidatePath("/organizations");
    return;
  }

  if (member.role !== "OWNER" && nextRole === "OWNER") {
    await prisma.$transaction([
      prisma.membership.update({
        where: { id: member.id },
        data: { role: "OWNER", departmentId: nextDepartmentId },
      }),
      prisma.membership.update({
        where: { id: actor.id },
        data: { role: "ADMIN" },
      }),
      prisma.notification.create({
        data: {
          userId: member.userId,
          organizationId,
          type: "OWNERSHIP_TRANSFERRED",
          title: "조직 소유권을 이전받았습니다",
          body: `${actor.organization.name}의 새 소유자가 되었습니다.`,
          resourceType: "ORGANIZATION",
          resourceId: organizationId,
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor.userId,
          action: "OWNERSHIP_TRANSFERRED",
          entityType: "MEMBERSHIP",
          entityId: member.id,
          metadataJson: { nextOwnerUserId: member.userId },
        },
      }),
    ]);
    revalidatePath(`/org/${organizationId}/admin/members`);
    revalidatePath("/organizations");
    return;
  }

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: member.id },
      data: { role: nextRole, departmentId: nextDepartmentId },
    }),
    prisma.notification.create({
      data: {
        userId: member.userId,
        organizationId,
        type: "MEMBERSHIP_UPDATED",
        title: "조직 정보가 변경되었습니다",
        body: "역할 또는 부서 배정을 확인해 주세요.",
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "MEMBERSHIP_UPDATED",
        entityType: "MEMBERSHIP",
        entityId: member.id,
        metadataJson: { role: nextRole, departmentId: nextDepartmentId },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/admin/members`);
}

export async function transferOwnershipAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const actor = await requireMembership(organizationId, ["OWNER"]);
  const membershipId = text(formData, "membershipId");
  const nextOwner = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
      status: "ACTIVE",
      userId: { not: actor.userId },
    },
    include: { user: { select: { name: true } } },
  });
  if (!nextOwner) {
    throw new AppError("NOT_FOUND", "소유권을 이전할 구성원을 찾지 못했습니다.", 404);
  }
  if (nextOwner.role === "OWNER") {
    throw new AppError("CONFLICT", "이미 조직 소유자인 구성원입니다.", 409);
  }

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: nextOwner.id },
      data: { role: "OWNER" },
    }),
    prisma.membership.update({
      where: { id: actor.id },
      data: { role: "ADMIN" },
    }),
    prisma.notification.create({
      data: {
        userId: nextOwner.userId,
        organizationId,
        type: "OWNERSHIP_TRANSFERRED",
        title: "조직 소유권을 이전받았습니다",
        body: `${actor.organization.name}의 새 소유자가 되었습니다.`,
        resourceType: "ORGANIZATION",
        resourceId: organizationId,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "OWNERSHIP_TRANSFERRED",
        entityType: "MEMBERSHIP",
        entityId: nextOwner.id,
        metadataJson: { nextOwnerUserId: nextOwner.userId },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/admin/members`);
  revalidatePath("/organizations");
}

export async function rotateJoinCodeAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const code = createJoinCode();
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        joinCodeHash: hashJoinCode(code),
        joinCodeCiphertext: encryptJoinCode(code),
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "JOIN_CODE_ROTATED",
        entityType: "ORGANIZATION",
        entityId: organizationId,
        metadataJson: {},
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/admin/settings`);
}

export async function createReportReferencePrincipleAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const content = z.string().trim().min(1).max(4000).parse(text(formData, "content"));
  await prisma.$transaction(async (tx) => {
    const principle = await tx.reportReferencePrinciple.create({
      data: { organizationId, content },
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "REPORT_REFERENCE_PRINCIPLE_CREATED",
        entityType: "REPORT_REFERENCE_PRINCIPLE",
        entityId: principle.id,
        metadataJson: {},
      },
    });
  });
  revalidatePath(`/org/${organizationId}/admin/settings`);
  revalidatePath(`/org/${organizationId}/report`);
}

export async function deleteReportReferencePrincipleAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const principleId = text(formData, "principleId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);

  if (principleId === "legacy") {
    await prisma.$transaction([
      prisma.organization.update({ where: { id: organizationId }, data: { reportReference: null } }),
      prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor.userId,
          action: "REPORT_REFERENCE_PRINCIPLE_DELETED",
          entityType: "REPORT_REFERENCE_PRINCIPLE",
          entityId: organizationId,
          metadataJson: { legacy: true },
        },
      }),
    ]);
  } else {
    const id = z.string().uuid().parse(principleId);
    const principle = await prisma.reportReferencePrinciple.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!principle) return;
    await prisma.$transaction([
      prisma.reportReferencePrinciple.delete({ where: { id: principle.id } }),
      prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor.userId,
          action: "REPORT_REFERENCE_PRINCIPLE_DELETED",
          entityType: "REPORT_REFERENCE_PRINCIPLE",
          entityId: principle.id,
          metadataJson: {},
        },
      }),
    ]);
  }
  revalidatePath(`/org/${organizationId}/admin/settings`);
  revalidatePath(`/org/${organizationId}/report`);
}

export async function uploadReportReferenceFileAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const files = formData.getAll("referenceFiles").filter((file): file is File => file instanceof File && file.size > 0);
  if (!files.length) {
    throw new AppError("VALIDATION_ERROR", "첨부할 파일을 선택해 주세요.");
  }
  const preparedFiles = await Promise.all(files.map(async (file) => {
    if (file.size > MAX_REPORT_REFERENCE_FILE_SIZE) {
      throw new AppError("VALIDATION_ERROR", `${file.name}: 레퍼런스 파일은 개별 20MB 이하만 첨부할 수 있습니다.`);
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = REPORT_REFERENCE_MIME_BY_EXTENSION[extension];
    if (!mimeType) throw new AppError("VALIDATION_ERROR", `${file.name}: PDF, TXT, MD, CSV, JSON 파일만 첨부할 수 있습니다.`);
    const objectKey = `report-references/${organizationId}/${randomUUID()}.${extension}`;
    return { file, mimeType, objectKey, data: Buffer.from(await file.arrayBuffer()) };
  }));

  const uploadedKeys: string[] = [];
  try {
    for (const file of preparedFiles) {
      await putR2Object({ key: file.objectKey, body: file.data, contentType: file.mimeType });
      uploadedKeys.push(file.objectKey);
    }
    await prisma.$transaction(async (tx) => {
      for (const { file, mimeType, objectKey } of preparedFiles) {
        const saved = await tx.reportReferenceFile.create({
          data: { organizationId, fileName: file.name, mimeType, size: file.size, objectKey },
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId: actor.userId,
            action: "REPORT_REFERENCE_FILE_UPLOADED",
            entityType: "REPORT_REFERENCE_FILE",
            entityId: saved.id,
            metadataJson: { fileName: file.name, mimeType, size: file.size },
          },
        });
      }
    });
  } catch (error) {
    await deleteR2Objects(uploadedKeys).catch(() => undefined);
    if (error instanceof AppError) throw error;
    throw new AppError("INTERNAL_ERROR", "레퍼런스 파일을 R2 저장소에 첨부하지 못했습니다.", 500);
  }
  revalidatePath(`/org/${organizationId}/admin/settings`);
  revalidatePath(`/org/${organizationId}/report`);
}

export async function deleteReportReferenceFileAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const referenceFileId = z.string().uuid().parse(text(formData, "referenceFileId"));
  const actor = await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const referenceFile = await prisma.reportReferenceFile.findFirst({
    where: { id: referenceFileId, organizationId },
    select: { id: true, fileName: true, objectKey: true },
  });
  if (!referenceFile) return;
  await deleteR2Object(referenceFile.objectKey);
  await prisma.$transaction([
    prisma.reportReferenceFile.delete({ where: { id: referenceFile.id } }),
    prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId,
        action: "REPORT_REFERENCE_FILE_DELETED",
        entityType: "REPORT_REFERENCE_FILE",
        entityId: referenceFile.id,
        metadataJson: { fileName: referenceFile.fileName },
      },
    }),
  ]);
  revalidatePath(`/org/${organizationId}/admin/settings`);
  revalidatePath(`/org/${organizationId}/report`);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const member = await requireMembership(organizationId);
  await prisma.notification.updateMany({
    where: { organizationId, userId: member.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath(`/org/${organizationId}/notifications`);
}
