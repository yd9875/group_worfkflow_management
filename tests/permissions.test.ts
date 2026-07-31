import { describe, expect, it } from "vitest";
import {
  canCreateSchedule,
  canEditSchedule,
  canViewSchedule,
  roleCanManageRole,
} from "@/features/permissions";

const member = {
  userId: "u1",
  organizationId: "o1",
  departmentId: "d1",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};
const baseSchedule = {
  organizationId: "o1",
  createdByUserId: "u1",
  targetUserId: null,
  departmentId: null,
  scope: "ORGANIZATION" as const,
  category: "GENERAL" as const,
  deletedAt: null,
};

describe("일정 권한", () => {
  it("일반 구성원은 조직 일정을 볼 수 있지만 만들 수 없다", () => {
    expect(canViewSchedule(member, baseSchedule)).toBe(true);
    expect(canCreateSchedule(member, "ORGANIZATION")).toBe(false);
  });
  it("다른 부서 일정은 응답에서 제외한다", () => {
    expect(canViewSchedule(member, { ...baseSchedule, scope: "DEPARTMENT", departmentId: "d2" })).toBe(false);
  });
  it("본인이 만든 소속 부서 일정은 수정할 수 있다", () => {
    expect(canEditSchedule(member, { ...baseSchedule, scope: "DEPARTMENT", departmentId: "d1" })).toBe(true);
  });
  it("본인이 등록한 외근·출장·휴가는 구성원도 삭제할 수 있다", () => {
    expect(canEditSchedule(member, { ...baseSchedule, category: "OUTING" })).toBe(true);
    expect(canEditSchedule(member, { ...baseSchedule, category: "BUSINESS_TRIP" })).toBe(true);
  });
  it("소유자만 구성원의 역할과 소유권을 변경한다", () => {
    expect(roleCanManageRole("ADMIN", "MEMBER", "ADMIN")).toBe(false);
    expect(roleCanManageRole("OWNER", "MEMBER", "ADMIN")).toBe(true);
    expect(roleCanManageRole("OWNER", "OWNER", "ADMIN")).toBe(true);
    expect(roleCanManageRole("OWNER", "ADMIN", "OWNER")).toBe(true);
  });
});
