import { describe, expect, it } from "vitest";
import { createReportFile } from "@/lib/report-file";
import type { ReportFormat } from "@/lib/report-formats";
import { alignDocumentToTemplate, defaultReportTemplateProfile, reportDocumentToText } from "@/lib/report-schema";

const input = {
  title: "테스트 조직 주간 AI 보고서",
  subtitle: "2026-08-02 기준",
  report: "# 핵심 요약\n\n- 완료 업무 3건\n- 중요 일정 1건\n\n다음 기간 일정을 확인해 주세요.",
};

describe("AI 보고서 파일 생성", () => {
  it.each([
    ["txt", "text/plain"],
    ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["csv", "text/csv"],
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["pdf", "application/pdf"],
  ] as Array<[ReportFormat, string]>) ("%s 파일을 생성한다", async (format, mimeType) => {
    const file = await createReportFile({ ...input, format });
    expect(file.body.byteLength).toBeGreaterThan(50);
    expect(file.mimeType).toContain(mimeType);
    expect(file.extension).toBe(format);
    if (["docx", "xlsx", "pptx"].includes(format)) {
      expect(String.fromCharCode(...file.body.slice(0, 2))).toBe("PK");
    }
    if (format === "pdf") {
      expect(new TextDecoder().decode(file.body.slice(0, 4))).toBe("%PDF");
    }
  }, 20_000);

  it.each(["docx", "xlsx", "pptx", "pdf"] as ReportFormat[])("%s 파일에 레퍼런스 기반 블록과 표를 렌더링한다", async (format) => {
    const profile = defaultReportTemplateProfile();
    const document = alignDocumentToTemplate(profile, {
      title: "양식 기반 보고서",
      subtitle: "2026-08-02 기준",
      blocks: profile.blocks.map((block) => ({
        key: block.key,
        heading: block.heading,
        layout: block.layout,
        paragraphs: ["일정 데이터로 작성한 내용"],
        bullets: ["확인 항목"],
        columns: block.columns,
        rows: block.columns.length ? [block.columns.map((column) => `${column} 값`)] : [],
      })),
    });
    const file = await createReportFile({
      format,
      title: document.title,
      subtitle: document.subtitle,
      report: reportDocumentToText(document),
      document,
      style: profile.style,
    });

    expect(file.body.byteLength).toBeGreaterThan(100);
  }, 20_000);
});
