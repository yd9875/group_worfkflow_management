import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getReportData } from "@/features/queries";
import { type AiProvider, getAiProvider } from "@/lib/ai-browser-settings";
import { prisma } from "@/lib/db";
import { createReportFile, safeReportFileName } from "@/lib/report-file";
import { REPORT_FORMATS } from "@/lib/report-formats";
import { deleteR2Object, getR2Object, putR2Object } from "@/lib/r2";
import {
  extractReportReferenceText,
  isNativeVisualReference,
  isReferenceImage,
  type ReportReferenceFile,
} from "@/lib/report-reference";
import {
  alignDocumentToTemplate,
  defaultReportTemplateProfile,
  normalizeTemplateProfile,
  REPORT_DOCUMENT_JSON_SCHEMA,
  REPORT_TEMPLATE_PROFILE_JSON_SCHEMA,
  reportDocumentToText,
  reportDocumentSchema,
  reportTemplateProfileSchema,
  type ReportDocument,
  type ReportTemplateProfile,
} from "@/lib/report-schema";

export const runtime = "nodejs";

const inputSchema = z.object({
  organizationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  view: z.enum(["day", "week", "month"]),
  provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI"]),
  apiKey: z.string().trim().min(20).max(500),
  model: z.string().trim().min(1).max(100),
  format: z.enum(REPORT_FORMATS),
}).refine(
  (input) => getAiProvider(input.provider).models.some((model) => model.value === input.model),
  { message: "선택한 AI 제공사에서 지원하지 않는 모델입니다.", path: ["model"] },
);

type ReferenceFiles = ReportReferenceFile[];

type ProviderResult = {
  text?: string;
  error?: string;
  status: number;
};

type StructuredTask = {
  name: "report_template_profile" | "report_document";
  schema: Record<string, unknown>;
  prompt: string;
  instructions: string;
  maxTokens: number;
  referenceFiles: ReferenceFiles;
};

const TEMPLATE_ANALYSIS_INSTRUCTIONS = [
  "당신은 보고서 양식 분석가입니다.",
  "작성 원칙과 첨부 파일은 단순 참고 자료가 아니라 최종 보고서 구조를 결정하는 최우선 명세입니다.",
  "작성 원칙이 파일 양식과 충돌하면 작성 원칙을 우선하고, 그다음 첨부 양식, 마지막으로 일반적인 보고서 관례를 적용하세요.",
  "Word의 제목·문단·표 순서, Excel의 시트·행·열, 이미지와 PDF의 배치·색상·표·시각 계층을 재사용 가능한 양식 프로필로 변환하세요.",
  "레퍼런스 안의 실제 사실과 수치는 복사하지 말고 구조·문체·표현 규칙만 추출하세요.",
].join(" ");

const REPORT_GENERATION_INSTRUCTIONS = [
  "당신은 주어진 양식 프로필을 정확히 채우는 한국어 조직 보고서 작성자입니다.",
  "양식 프로필의 블록 순서, 제목, 레이아웃, 표 열, 문체와 충실도 규칙은 변경할 수 없는 최우선 규칙입니다.",
  "일정 데이터는 양식의 빈 내용을 채우는 사실 근거로만 사용하고, 없는 사실·수치·평가를 만들지 마세요.",
  "각 블록 key를 그대로 사용하고 모든 블록을 같은 순서로 출력하세요.",
  "자료가 없는 필수 블록은 삭제하지 말고 '해당 기간 등록 내용 없음'이라고 명시하세요.",
].join(" ");

async function buildTemplateAnalysisPrompt(input: {
  organizationName: string;
  principles: string[];
  referenceFiles: ReferenceFiles;
}) {
  const textFile = await extractReportReferenceText(input.referenceFiles);
  return [
    "다음 작성 원칙과 첨부 파일을 분석해 재사용 가능한 보고서 양식 프로필을 만드세요.",
    "우선순위: 1) 작성 원칙 2) 첨부 보고서 양식의 구조와 시각 규칙 3) 기본 보고서 관례.",
    JSON.stringify({
      organization: input.organizationName,
      principles: input.principles.length ? input.principles : ["등록된 작성 원칙 없음"],
      referenceFileNames: input.referenceFiles.map((file) => file.fileName),
    }),
    textFile ? `\n[첨부 보고서 양식에서 추출한 구조]\n${textFile}` : "",
    `\n[출력 JSON 스키마]\n${JSON.stringify(REPORT_TEMPLATE_PROFILE_JSON_SCHEMA)}`,
  ].filter(Boolean).join("\n");
}

function buildReportPrompt(input: {
  organizationName: string;
  view: "day" | "week" | "month";
  date: string;
  scheduleData: unknown[];
  templateProfile: ReportTemplateProfile;
}) {
  return [
    "아래 양식 프로필을 절대적인 출력 명세로 사용해 일정 데이터를 보고서에 채우세요.",
    "블록의 key·순서·heading·layout·columns는 양식 프로필과 정확히 같아야 합니다.",
    JSON.stringify({
      organization: input.organizationName,
      period: { view: input.view, date: input.date },
      authoritativeTemplateProfile: input.templateProfile,
      schedules: input.scheduleData,
    }),
    `\n[출력 JSON 스키마]\n${JSON.stringify(REPORT_DOCUMENT_JSON_SCHEMA)}`,
  ].join("\n");
}

function parseStructuredText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  return JSON.parse(fenced ?? trimmed) as unknown;
}

function resolveTemplatePattern(pattern: string, values: { organizationName: string; viewLabel: string; date: string }, fallback: string) {
  const resolved = pattern
    .replaceAll("{조직명}", values.organizationName)
    .replaceAll("{기간유형}", values.viewLabel)
    .replaceAll("{기준일}", values.date)
    .trim();
  return resolved || fallback;
}

function referenceBase64(referenceFile: ReportReferenceFile) {
  return Buffer.from(referenceFile.data).toString("base64");
}

async function callOpenAI(apiKey: string, model: string, task: StructuredTask, userId: string): Promise<ProviderResult> {
  const content: Array<Record<string, unknown>> = task.referenceFiles
    .filter((file) => file.mimeType === "application/pdf")
    .map((referenceFile) => ({
      type: "input_file",
      filename: referenceFile.fileName,
      file_data: `data:application/pdf;base64,${referenceBase64(referenceFile)}`,
      detail: "high",
    }));
  content.push(...task.referenceFiles.filter(isReferenceImage).map((referenceFile) => ({
    type: "input_image",
    image_url: `data:${referenceFile.mimeType};base64,${referenceBase64(referenceFile)}`,
    detail: "high",
  })));
  content.push({ type: "input_text", text: task.prompt });
  const requestBody: Record<string, unknown> = {
      model,
      store: false,
      max_output_tokens: task.maxTokens,
      safety_identifier: createHash("sha256").update(userId).digest("hex"),
      instructions: task.instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: task.name, strict: true, schema: task.schema } },
  };
  const send = (body: Record<string, unknown>) => fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let response = await send(requestBody);
  let payload = await response.json() as {
    error?: { message?: string };
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (response.status === 400 && /schema|format|structured|unsupported parameter/i.test(payload.error?.message ?? "")) {
    const fallbackBody = { ...requestBody };
    delete fallbackBody.text;
    response = await send(fallbackBody);
    payload = await response.json() as typeof payload;
  }
  const outputText = (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return { text: outputText, error: payload.error?.message, status: response.status };
}

async function callAnthropic(apiKey: string, model: string, task: StructuredTask): Promise<ProviderResult> {
  const content: Array<Record<string, unknown>> = task.referenceFiles
    .filter((file) => file.mimeType === "application/pdf")
    .map((referenceFile) => ({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: referenceBase64(referenceFile) },
    }));
  content.push(...task.referenceFiles.filter(isReferenceImage).map((referenceFile) => ({
    type: "image",
    source: { type: "base64", media_type: referenceFile.mimeType, data: referenceBase64(referenceFile) },
  })));
  content.push({ type: "text", text: task.prompt });
  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: task.maxTokens,
    system: task.instructions,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: task.schema } },
  };
  const send = (body: Record<string, unknown>) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let response = await send(requestBody);
  let payload = await response.json() as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };
  if (response.status === 400 && /schema|format|structured|output_config/i.test(payload.error?.message ?? "")) {
    const fallbackBody = { ...requestBody };
    delete fallbackBody.output_config;
    response = await send(fallbackBody);
    payload = await response.json() as typeof payload;
  }
  const outputText = (payload.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return { text: outputText, error: payload.error?.message, status: response.status };
}

async function callGemini(apiKey: string, model: string, task: StructuredTask): Promise<ProviderResult> {
  const parts: Array<Record<string, unknown>> = task.referenceFiles
    .filter(isNativeVisualReference)
    .map((referenceFile) => ({ inline_data: { mime_type: referenceFile.mimeType, data: referenceBase64(referenceFile) } }));
  parts.push({ text: task.prompt });
  const requestBody: Record<string, unknown> = {
      system_instruction: { parts: [{ text: task.instructions }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: task.maxTokens,
        responseMimeType: "application/json",
        responseJsonSchema: task.schema,
      },
  };
  const send = (body: Record<string, unknown>) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let response = await send(requestBody);
  let payload = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (response.status === 400 && /schema|format|structured|responseJsonSchema/i.test(payload.error?.message ?? "")) {
    const fallbackBody = { ...requestBody, generationConfig: { maxOutputTokens: task.maxTokens } };
    response = await send(fallbackBody);
    payload = await response.json() as typeof payload;
  }
  const outputText = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .filter((item) => typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return { text: outputText, error: payload.error?.message, status: response.status };
}

async function callProvider(provider: AiProvider, apiKey: string, model: string, task: StructuredTask, userId: string) {
  if (provider === "ANTHROPIC") return callAnthropic(apiKey, model, task);
  if (provider === "GEMINI") return callGemini(apiKey, model, task);
  return callOpenAI(apiKey, model, task, userId);
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const selectedDate = new Date(`${input.date}T12:00:00`);
    const { schedules, organization, membership } = await getReportData(input.organizationId, selectedDate, input.view);
    const scheduleData = schedules.map((item) => ({
      title: item.title,
      type: item.itemType,
      category: item.category,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      allDay: item.isAllDay,
      important: item.isImportant,
      completed: item.isCompleted,
      department: item.department?.name ?? null,
      description: item.description,
      memo: item.scope === "PERSONAL" ? item.memo : null,
    }));
    const referenceFiles = await Promise.all(organization.reportReferenceFiles.map(async (file) => ({
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      data: await getR2Object(file.objectKey),
    })));
    const principles = [
      organization.reportReference,
      ...organization.reportReferencePrinciples.map((principle) => principle.content),
    ].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim());
    const templateFingerprint = createHash("sha256").update(JSON.stringify({
      profileSchemaVersion: "1.0",
      analyzer: { provider: input.provider, model: input.model },
      principles,
      files: organization.reportReferenceFiles.map((file) => ({
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
        objectKey: file.objectKey,
      })),
    })).digest("hex");
    const cachedTemplate = organization.reportTemplateFingerprint === templateFingerprint
      ? reportTemplateProfileSchema.safeParse(organization.reportTemplateSchema)
      : null;
    let templateProfile: ReportTemplateProfile;
    if (cachedTemplate?.success) {
      templateProfile = normalizeTemplateProfile(cachedTemplate.data);
    } else if (!principles.length && !referenceFiles.length) {
      templateProfile = defaultReportTemplateProfile();
    } else {
      const templateResult = await callProvider(input.provider, input.apiKey, input.model, {
        name: "report_template_profile",
        schema: REPORT_TEMPLATE_PROFILE_JSON_SCHEMA,
        prompt: await buildTemplateAnalysisPrompt({ organizationName: organization.name, principles, referenceFiles }),
        instructions: TEMPLATE_ANALYSIS_INSTRUCTIONS,
        maxTokens: 2500,
        referenceFiles,
      }, membership.userId);
      if (templateResult.status < 200 || templateResult.status >= 300) {
        return NextResponse.json(
          { error: templateResult.error || `${getAiProvider(input.provider).label}가 레퍼런스 양식을 분석하지 못했습니다.` },
          { status: templateResult.status >= 400 && templateResult.status < 600 ? templateResult.status : 502 },
        );
      }
      try {
        templateProfile = normalizeTemplateProfile(reportTemplateProfileSchema.parse(parseStructuredText(templateResult.text ?? "")));
      } catch (error) {
        console.error("Report template profile validation failed", error);
        return NextResponse.json({ error: `${getAiProvider(input.provider).label}의 레퍼런스 양식 분석 결과가 올바르지 않습니다. 다시 시도해 주세요.` }, { status: 502 });
      }
      await prisma.organization.update({
        where: { id: input.organizationId },
        data: {
          reportTemplateSchema: templateProfile,
          reportTemplateFingerprint: templateFingerprint,
          reportTemplateUpdatedAt: new Date(),
        },
      }).catch((error) => console.error("Report template profile cache failed", error));
    }

    const result = await callProvider(input.provider, input.apiKey, input.model, {
      name: "report_document",
      schema: REPORT_DOCUMENT_JSON_SCHEMA,
      prompt: buildReportPrompt({ organizationName: organization.name, view: input.view, date: input.date, scheduleData, templateProfile }),
      instructions: REPORT_GENERATION_INSTRUCTIONS,
      maxTokens: 5000,
      referenceFiles: [],
    }, membership.userId);
    if (result.status < 200 || result.status >= 300) {
      return NextResponse.json(
        { error: result.error || `${getAiProvider(input.provider).label} 요청에 실패했습니다. API 키와 모델을 확인해 주세요.` },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
      );
    }
    let reportDocument: ReportDocument;
    try {
      reportDocument = alignDocumentToTemplate(templateProfile, reportDocumentSchema.parse(parseStructuredText(result.text ?? "")));
    } catch (error) {
      console.error("Report document validation failed", error);
      return NextResponse.json({ error: `${getAiProvider(input.provider).label} 응답의 보고서 구조가 올바르지 않습니다. 다시 시도해 주세요.` }, { status: 502 });
    }
    const viewLabel = input.view === "day" ? "일일" : input.view === "week" ? "주간" : "월간";
    const patternValues = { organizationName: organization.name, viewLabel, date: input.date };
    const title = resolveTemplatePattern(templateProfile.titlePattern, patternValues, reportDocument.title || `${organization.name} ${viewLabel} AI 보고서`);
    const subtitle = resolveTemplatePattern(templateProfile.subtitlePattern, patternValues, reportDocument.subtitle || `${input.date} 기준`);
    reportDocument = { ...reportDocument, title, subtitle };
    const file = await createReportFile({
      format: input.format,
      title,
      subtitle,
      report: reportDocumentToText(reportDocument),
      document: reportDocument,
      style: templateProfile.style,
    });
    const reportId = randomUUID();
    const baseName = safeReportFileName(`${organization.name}_${viewLabel}_AI보고서_${input.date}`);
    const fileName = `${baseName}.${file.extension}`;
    const objectKey = `generated-reports/${input.organizationId}/${reportId}.${file.extension}`;
    await putR2Object({ key: objectKey, body: file.body, contentType: file.mimeType });
    try {
      const generatedReport = await prisma.generatedReport.create({
        data: {
          id: reportId,
          organizationId: input.organizationId,
          createdByUserId: membership.userId,
          view: input.view,
          referenceDate: new Date(`${input.date}T00:00:00.000Z`),
          format: input.format,
          fileName,
          mimeType: file.mimeType,
          size: file.body.byteLength,
          objectKey,
        },
        select: {
          id: true,
          view: true,
          referenceDate: true,
          format: true,
          fileName: true,
          mimeType: true,
          size: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      });
      return NextResponse.json({ report: generatedReport });
    } catch (error) {
      await deleteR2Object(objectKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "보고서 요청 정보가 올바르지 않습니다." }, { status: 400 });
    console.error("AI report generation failed", error);
    return NextResponse.json({ error: "AI 보고서를 생성하지 못했습니다." }, { status: 500 });
  }
}
