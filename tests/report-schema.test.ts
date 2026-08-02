import { describe, expect, it } from "vitest";
import {
  alignDocumentToTemplate,
  defaultReportTemplateProfile,
  normalizeTemplateProfile,
  reportDocumentSchema,
  reportDocumentToText,
  reportTemplateProfileSchema,
} from "@/lib/report-schema";

describe("AI 보고서 양식 스키마", () => {
  it("레퍼런스 양식의 블록 순서와 표 열을 최종 문서에 강제한다", () => {
    const profile = defaultReportTemplateProfile();
    const reversed = [...profile.blocks].reverse().map((block) => ({
      key: block.key,
      heading: `변경된 ${block.heading}`,
      layout: "PARAGRAPH" as const,
      paragraphs: [`${block.key} 내용`],
      bullets: [],
      columns: ["임의 열"],
      rows: [["값"]],
    }));
    const document = reportDocumentSchema.parse({ title: "보고서", subtitle: "기준", blocks: reversed });
    const aligned = alignDocumentToTemplate(profile, document);

    expect(aligned.blocks.map((block) => block.key)).toEqual(profile.blocks.map((block) => block.key));
    expect(aligned.blocks.map((block) => block.heading)).toEqual(profile.blocks.map((block) => block.heading));
    expect(aligned.blocks[1].layout).toBe("TABLE");
    expect(aligned.blocks[1].columns).toEqual(profile.blocks[1].columns);
  });

  it("중복 키와 잘못된 색상을 저장 전에 정규화한다", () => {
    const profile = defaultReportTemplateProfile();
    profile.style.primaryColor = "not-a-color";
    profile.blocks[1].key = profile.blocks[0].key;
    const normalized = normalizeTemplateProfile(reportTemplateProfileSchema.parse(profile));

    expect(normalized.style.primaryColor).toBe("0F766E");
    expect(new Set(normalized.blocks.map((block) => block.key)).size).toBe(normalized.blocks.length);
  });

  it("구조화 문서를 텍스트 형식으로도 손실 없이 변환한다", () => {
    const profile = defaultReportTemplateProfile();
    const document = alignDocumentToTemplate(profile, {
      title: "주간 보고서",
      subtitle: "2026-08-02 기준",
      blocks: profile.blocks.map((block) => ({
        key: block.key,
        heading: block.heading,
        layout: block.layout,
        paragraphs: ["요약 문장"],
        bullets: ["확인 항목"],
        columns: block.columns,
        rows: block.columns.length ? [block.columns.map((column) => `${column} 값`)] : [],
      })),
    });
    const text = reportDocumentToText(document);

    expect(text).toContain("# 핵심 요약");
    expect(text).toContain("- 확인 항목");
    expect(text).toContain("구분 | 내용 | 담당 | 상태");
  });
});
