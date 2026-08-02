import { describe, expect, it } from "vitest";
import { adjacentSortUpdates, overlaps, scheduleInputSchema } from "@/features/schedule-rules";

const base = {
  organizationId: "1f31a852-1158-4f98-a5d8-574d07947b89",
  title: "일정",
  startsAt: new Date("2026-07-30T01:00:00Z"),
  endsAt: new Date("2026-07-30T02:00:00Z"),
  isAllDay: false,
  scope: "ORGANIZATION" as const,
  category: "GENERAL" as const,
  isImportant: false,
};

describe("일정 입력 검증", () => {
  it("종료가 시작보다 빨라서는 안 된다", () => {
    expect(scheduleInputSchema.safeParse({ ...base, endsAt: base.startsAt }).success).toBe(false);
  });
  it("부서 일정은 부서가 필요하다", () => {
    expect(scheduleInputSchema.safeParse({ ...base, scope: "DEPARTMENT" }).success).toBe(false);
  });
  it("인증 시스템의 UUID가 아닌 사용자 ID도 개인 일정 대상으로 허용한다", () => {
    expect(
      scheduleInputSchema.safeParse({
        ...base,
        scope: "PERSONAL",
        targetUserId: "better-auth-user-id",
      }).success,
    ).toBe(true);
  });
  it("배타적 종료값으로 기간 겹침을 계산한다", () => {
    expect(overlaps(new Date("2026-07-30"), new Date("2026-07-31"), new Date("2026-07-31"), new Date("2026-08-01"))).toBe(false);
  });
});

describe("개인 일정 순서 이동", () => {
  it("정렬 값이 고유하면 인접한 두 항목만 교환한다", () => {
    expect(adjacentSortUpdates([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ], "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("중복 정렬 값은 한 번 정규화해 순서를 보장한다", () => {
    expect(adjacentSortUpdates([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 0 },
      { id: "c", sortOrder: 0 },
    ], "b", "down")).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("목록 경계를 벗어나면 업데이트하지 않는다", () => {
    expect(adjacentSortUpdates([{ id: "a", sortOrder: 0 }], "a", "up")).toEqual([]);
  });
});
