import { describe, expect, it } from "vitest";
import { createJoinCode, hashJoinCode, normalizeJoinCode } from "@/lib/join-code";

describe("가입 코드", () => {
  it("공백과 하이픈을 제거하고 대문자로 정규화한다", () => {
    expect(normalizeJoinCode(" team-2026 ")).toBe("TEAM2026");
  });
  it("같은 정규화 코드는 같은 해시를 만든다", () => {
    expect(hashJoinCode("team-2026")).toBe(hashJoinCode("TEAM2026"));
  });
  it("혼동 문자를 제외한 10자리 코드를 만든다", () => {
    expect(createJoinCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  });
});
