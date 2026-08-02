import { z } from "zod";

export const scheduleInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isAllDay: z.coerce.boolean().default(false),
    scope: z.enum(["ORGANIZATION", "DEPARTMENT", "PERSONAL"]),
    category: z
      .enum([
        "GENERAL",
        "MEETING",
        "TRAINING",
        "LEAVE",
        "BUSINESS_TRIP",
        "OUTING",
        "OTHER",
      ])
      .default("GENERAL"),
    isImportant: z.coerce.boolean().default(false),
    departmentId: z.string().uuid().nullable().optional(),
    targetUserId: z.string().trim().min(1).max(128).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "종료 시각은 시작 시각보다 늦어야 합니다.",
      });
    }
    if (value.scope === "DEPARTMENT" && !value.departmentId) {
      context.addIssue({
        code: "custom",
        path: ["departmentId"],
        message: "부서 일정을 등록하려면 부서를 선택하세요.",
      });
    }
    if (value.scope === "PERSONAL" && !value.targetUserId) {
      context.addIssue({
        code: "custom",
        path: ["targetUserId"],
        message: "개인 일정의 대상 구성원을 선택하세요.",
      });
    }
    if (value.scope === "ORGANIZATION" && (value.departmentId || value.targetUserId)) {
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message: "조직 일정에는 개별 대상을 지정할 수 없습니다.",
      });
    }
  });

export function overlaps(
  startsAt: Date,
  endsAt: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  return startsAt < rangeEnd && endsAt > rangeStart;
}

export function adjacentSortUpdates(
  entries: Array<{ id: string; sortOrder: number }>,
  currentId: string,
  direction: "up" | "down",
) {
  const currentIndex = entries.findIndex((entry) => entry.id === currentId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= entries.length) return [];

  const current = entries[currentIndex];
  const target = entries[targetIndex];
  if (current.sortOrder === target.sortOrder) {
    const orderedIds = entries.map((entry) => entry.id);
    [orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[currentIndex]];
    return orderedIds.map((id, sortOrder) => ({ id, sortOrder }));
  }

  return [
    { id: current.id, sortOrder: target.sortOrder },
    { id: target.id, sortOrder: current.sortOrder },
  ];
}
