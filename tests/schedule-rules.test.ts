import { describe, expect, it } from "vitest";
import { overlaps, scheduleInputSchema } from "@/features/schedule-rules";

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
  it("배타적 종료값으로 기간 겹침을 계산한다", () => {
    expect(overlaps(new Date("2026-07-30"), new Date("2026-07-31"), new Date("2026-07-31"), new Date("2026-08-01"))).toBe(false);
  });
});
