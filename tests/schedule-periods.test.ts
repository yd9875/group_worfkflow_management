import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { getReferenceRange, getReportRange, getScheduleRange } from "@/features/schedule-periods";

const date = new Date("2026-08-05T12:00:00");
const day = (value: Date) => format(value, "yyyy-MM-dd");

describe("일정 조회 기간", () => {
  it("AI 보고서가 사용하는 일일 기본 범위는 선택한 하루로 제한된다", () => {
    const range = getReportRange(date, "day");
    expect(day(range.start)).toBe("2026-08-05");
    expect(day(range.end)).toBe("2026-08-06");
  });

  it("AI 월간 보고서는 달력의 인접 월을 제외하고 선택한 달만 사용한다", () => {
    const reportRange = getReportRange(date, "month");
    const calendarRange = getScheduleRange(date, "month");
    expect(day(reportRange.start)).toBe("2026-08-01");
    expect(day(reportRange.end)).toBe("2026-09-01");
    expect(day(calendarRange.start)).toBe("2026-07-27");
    expect(day(calendarRange.end)).toBe("2026-09-06");
  });

  it("일일 화면의 참고 범위는 해당 주와 다음 주이다", () => {
    const range = getReferenceRange(date, "day");
    expect(day(range.start)).toBe("2026-08-03");
    expect(day(range.end)).toBe("2026-08-17");
  });

  it("주간 화면의 참고 범위는 다음 주부터 4주간이다", () => {
    const range = getReferenceRange(date, "week");
    expect(day(range.start)).toBe("2026-08-10");
    expect(day(range.end)).toBe("2026-09-07");
  });

  it("월간 화면의 참고 범위는 다음 달 달력 전체이다", () => {
    const range = getReferenceRange(date, "month");
    expect(day(range.start)).toBe("2026-08-31");
    expect(day(range.end)).toBe("2026-10-05");
  });
});
