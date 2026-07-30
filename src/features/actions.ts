"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  createJoinCode,
  decryptJoinCode,
  encryptJoinCode,
  hashJoinCode,
  normalizeJoinCode,
} from "@/lib/join-code";
import { requireMembership, requireUser } from "@/lib/session";
import {
  canCreateSchedule,
  canEditSchedule,
  roleCanManageRole,
} from "@/features/permissions";
import { scheduleInputSchema } from "@/features/schedule-rules";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
    throw new AppError("VALIDATION_ERROR", "가입 코드를 확인해 주세요.");
  }
  const organization = await prisma.organization.findUnique({
    where: { joinCodeHash: hashJoinCode(code) },
  });
  if (!organization) {
    throw new AppError("NOT_FOUND", "유효한 가입 코드를 찾지 못했습니다.", 404);
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
        title: "새 가입 신청",
        body: `${user.name} 님이 조직 가입을 신청했습니다.`,
        resourceType: "JOIN_REQUEST",
        resourceId: request.id,
      })),
    });
  });
  revalidatePath("/organizations");
}

async function scheduleRecipients(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    scope: "ORGANIZATION" | "DEPARTMENT" | "PERSONAL";
    departmentId?: string | null;
    targetUserId?: string | null;
  },
) {
  if (input.scope === "PERSONAL") return input.targetUserId ? [input.targetUserId] : [];
  const memberships = await tx.membership.findMany({
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
  const parsed = scheduleInputSchema.parse({
    organizationId,
    title: text(formData, "title"),
    description: text(formData, "description") || undefined,
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    isAllDay: formData.get("isAllDay") === "on",
    scope: text(formData, "scope"),
    category: text(formData, "category"),
    isImportant: formData.get("isImportant") === "on",
    departmentId: text(formData, "departmentId") || null,
    targetUserId: text(formData, "targetUserId") || null,
  });
  if (!canCreateSchedule(membership, parsed.scope, parsed)) {
    throw new AppError("FORBIDDEN", "이 범위의 일정을 등록할 권한이 없습니다.", 403);
  }

  if (parsed.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: parsed.departmentId, organizationId, isActive: true },
    });
    if (!department) throw new AppError("VALIDATION_ERROR", "대상 부서가 올바르지 않습니다.");
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

  await prisma.$transaction(async (tx) => {
    const schedule = await tx.schedule.create({
      data: {
        ...parsed,
        description: parsed.description || null,
        departmentId: parsed.scope === "DEPARTMENT" ? parsed.departmentId : null,
        targetUserId: parsed.scope === "PERSONAL" ? parsed.targetUserId : null,
        createdByUserId: membership.userId,
        updatedByUserId: membership.userId,
      },
    });
    const recipients = await scheduleRecipients(tx, parsed);
    if (parsed.isImportant || parsed.scope !== "PERSONAL") {
      await tx.notification.createMany({
        data: recipients
          .filter((userId) => userId !== membership.userId)
          .map((userId) => ({
            userId,
            organizationId,
            type: "SCHEDULE_CREATED",
            title: parsed.isImportant ? "중요 일정이 등록되었습니다" : "새 일정이 등록되었습니다",
            body: parsed.title,
            resourceType: "SCHEDULE",
            resourceId: schedule.id,
          })),
      });
    }
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: membership.userId,
        action: "SCHEDULE_CREATED",
        entityType: "SCHEDULE",
        entityId: schedule.id,
        metadataJson: { scope: schedule.scope, category: schedule.category },
      },
    });
  });
  revalidatePath(`/org/${organizationId}/schedule/week`);
  revalidatePath(`/org/${organizationId}/schedule/month`);
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
  const department = await prisma.department.create({
    data: { organizationId, ...input },
  });
  await prisma.auditLog.create({
    data: {
      organizationId,
      actorUserId: membership.userId,
      action: "DEPARTMENT_CREATED",
      entityType: "DEPARTMENT",
      entityId: department.id,
      metadataJson: { name: department.name },
    },
  });
  revalidatePath(`/org/${organizationId}/admin/departments`);
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
      throw new AppError("NOT_FOUND", "가입 신청 또는 부서를 찾지 못했습니다.", 404);
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
        title: "가입이 승인되었습니다",
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
    if (!request) throw new AppError("NOT_FOUND", "가입 신청을 찾지 못했습니다.", 404);
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
        title: "가입 신청 결과",
        body: "가입 신청이 승인되지 않았습니다.",
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
  const member = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
  });
  if (!member) throw new AppError("NOT_FOUND", "구성원을 찾지 못했습니다.", 404);
  const nextRole = text(formData, "role") as "OWNER" | "ADMIN" | "MEMBER";
  const nextDepartmentId = text(formData, "departmentId");
  if (nextRole !== member.role && !roleCanManageRole(actor.role, member.role, nextRole)) {
    throw new AppError("FORBIDDEN", "역할을 변경할 권한이 없습니다.", 403);
  }
  const department = await prisma.department.findFirst({
    where: { id: nextDepartmentId, organizationId, isActive: true },
  });
  if (!department) throw new AppError("VALIDATION_ERROR", "부서를 확인해 주세요.");
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

export async function getJoinCode(organizationId: string) {
  await requireMembership(organizationId, ["OWNER", "ADMIN"]);
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { joinCodeCiphertext: true },
  });
  return decryptJoinCode(organization.joinCodeCiphertext);
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
