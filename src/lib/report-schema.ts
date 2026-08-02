import { z } from "zod";

const layoutSchema = z.enum(["PARAGRAPH", "BULLETS", "TABLE", "MIXED"]);
const alignmentSchema = z.enum(["LEFT", "CENTER"]);
const densitySchema = z.enum(["COMPACT", "NORMAL", "SPACIOUS"]);

const styleSchema = z.object({
  primaryColor: z.string().trim().min(1).max(20),
  accentColor: z.string().trim().min(1).max(20),
  titleAlignment: alignmentSchema,
  density: densitySchema,
  visualRules: z.array(z.string().trim().min(1).max(300)).max(12),
});

export const reportTemplateProfileSchema = z.object({
  version: z.literal("1.0"),
  referenceSummary: z.string().trim().min(1).max(2000),
  titlePattern: z.string().trim().min(1).max(300),
  subtitlePattern: z.string().trim().max(300),
  tone: z.string().trim().min(1).max(500),
  language: z.string().trim().min(1).max(50),
  style: styleSchema,
  blocks: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    heading: z.string().trim().min(1).max(200),
    purpose: z.string().trim().min(1).max(500),
    layout: layoutSchema,
    columns: z.array(z.string().trim().min(1).max(100)).max(12),
    required: z.boolean(),
  })).min(1).max(20),
  fidelityRules: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
});

export const reportDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300),
  blocks: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    heading: z.string().trim().min(1).max(200),
    layout: layoutSchema,
    paragraphs: z.array(z.string().trim().min(1).max(4000)).max(30),
    bullets: z.array(z.string().trim().min(1).max(1000)).max(50),
    columns: z.array(z.string().trim().min(1).max(100)).max(12),
    rows: z.array(z.array(z.string().trim().max(2000)).max(12)).max(100),
  })).min(1).max(20),
});

export type ReportTemplateProfile = z.infer<typeof reportTemplateProfileSchema>;
export type ReportDocument = z.infer<typeof reportDocumentSchema>;

const styleJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primaryColor: { type: "string", description: "Hex color inferred from the template, for example 0F766E." },
    accentColor: { type: "string", description: "Secondary hex color inferred from the template." },
    titleAlignment: { type: "string", enum: ["LEFT", "CENTER"] },
    density: { type: "string", enum: ["COMPACT", "NORMAL", "SPACIOUS"] },
    visualRules: { type: "array", items: { type: "string" } },
  },
  required: ["primaryColor", "accentColor", "titleAlignment", "density", "visualRules"],
} as const;

export const REPORT_TEMPLATE_PROFILE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "string", enum: ["1.0"] },
    referenceSummary: { type: "string", description: "A concrete summary of the analyzed reference/template structure." },
    titlePattern: { type: "string", description: "Reusable title pattern with placeholders rather than copied facts." },
    subtitlePattern: { type: "string", description: "Reusable subtitle/date pattern." },
    tone: { type: "string", description: "Writing tone and sentence style required by the references." },
    language: { type: "string" },
    style: styleJsonSchema,
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", description: "Stable ASCII identifier for the section." },
          heading: { type: "string", description: "Section heading following the reference wording." },
          purpose: { type: "string", description: "What schedule facts must fill this section." },
          layout: { type: "string", enum: ["PARAGRAPH", "BULLETS", "TABLE", "MIXED"] },
          columns: { type: "array", items: { type: "string" } },
          required: { type: "boolean" },
        },
        required: ["key", "heading", "purpose", "layout", "columns", "required"],
      },
    },
    fidelityRules: { type: "array", items: { type: "string" }, description: "Non-negotiable rules from written principles and attached templates." },
  },
  required: ["version", "referenceSummary", "titlePattern", "subtitlePattern", "tone", "language", "style", "blocks", "fidelityRules"],
} as const;

export const REPORT_DOCUMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          heading: { type: "string" },
          layout: { type: "string", enum: ["PARAGRAPH", "BULLETS", "TABLE", "MIXED"] },
          paragraphs: { type: "array", items: { type: "string" } },
          bullets: { type: "array", items: { type: "string" } },
          columns: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
        required: ["key", "heading", "layout", "paragraphs", "bullets", "columns", "rows"],
      },
    },
  },
  required: ["title", "subtitle", "blocks"],
} as const;

const DEFAULT_STYLE: ReportTemplateProfile["style"] = {
  primaryColor: "0F766E",
  accentColor: "64748B",
  titleAlignment: "LEFT",
  density: "NORMAL",
  visualRules: ["제목과 본문 사이의 시각적 계층을 명확히 구분한다."],
};

export function defaultReportTemplateProfile(): ReportTemplateProfile {
  return {
    version: "1.0",
    referenceSummary: "등록된 레퍼런스가 없어 조직 일정 보고서 기본 양식을 사용합니다.",
    titlePattern: "{조직명} {기간유형} AI 보고서",
    subtitlePattern: "{기준일} 기준",
    tone: "간결하고 사실 중심인 한국어 실무 보고체",
    language: "ko-KR",
    style: { ...DEFAULT_STYLE, visualRules: [...DEFAULT_STYLE.visualRules] },
    blocks: [
      { key: "summary", heading: "핵심 요약", purpose: "기간 내 핵심 일정과 업무를 요약한다.", layout: "BULLETS", columns: [], required: true },
      { key: "progress", heading: "완료 및 진행 현황", purpose: "완료 및 진행 중인 업무를 정리한다.", layout: "TABLE", columns: ["구분", "내용", "담당", "상태"], required: true },
      { key: "schedule", heading: "주요 일정", purpose: "회의, 교육, 출장, 외근, 휴가 등 주요 일정을 시간순으로 정리한다.", layout: "TABLE", columns: ["일시", "유형", "내용", "담당/부서"], required: true },
      { key: "risks", heading: "확인 필요 사항", purpose: "일정 데이터에서 확인 가능한 리스크와 후속 확인 사항을 정리한다.", layout: "BULLETS", columns: [], required: true },
    ],
    fidelityRules: ["일정 데이터에 없는 사실이나 수치를 만들지 않는다."],
  };
}

function safeColor(value: string, fallback: string) {
  const normalized = value.replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

export function normalizeTemplateProfile(profile: ReportTemplateProfile): ReportTemplateProfile {
  const seen = new Set<string>();
  const blocks = profile.blocks.map((block, index) => {
    let key = block.key.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || `section-${index + 1}`;
    while (seen.has(key)) key = `${key}-${index + 1}`;
    seen.add(key);
    return { ...block, key, columns: block.layout === "TABLE" || block.layout === "MIXED" ? block.columns : [] };
  });
  return {
    ...profile,
    style: {
      ...profile.style,
      primaryColor: safeColor(profile.style.primaryColor, DEFAULT_STYLE.primaryColor),
      accentColor: safeColor(profile.style.accentColor, DEFAULT_STYLE.accentColor),
    },
    blocks,
  };
}

export function alignDocumentToTemplate(profile: ReportTemplateProfile, document: ReportDocument): ReportDocument {
  const byKey = new Map(document.blocks.map((block) => [block.key, block]));
  return {
    title: document.title,
    subtitle: document.subtitle,
    blocks: profile.blocks.map((templateBlock) => {
      const generated = byKey.get(templateBlock.key);
      return {
        key: templateBlock.key,
        heading: templateBlock.heading,
        layout: templateBlock.layout,
        paragraphs: generated?.paragraphs ?? [],
        bullets: generated?.bullets ?? [],
        columns: templateBlock.columns,
        rows: (generated?.rows ?? []).map((row) => templateBlock.columns.map((_, index) => row[index] ?? "")),
      };
    }),
  };
}

export function reportDocumentToText(document: ReportDocument) {
  const lines = [document.title, document.subtitle, ""];
  for (const block of document.blocks) {
    lines.push(`# ${block.heading}`);
    lines.push(...block.paragraphs);
    lines.push(...block.bullets.map((item) => `- ${item}`));
    if (block.columns.length) lines.push(block.columns.join(" | "));
    lines.push(...block.rows.map((row) => row.join(" | ")), "");
  }
  return lines.join("\n").trim();
}
