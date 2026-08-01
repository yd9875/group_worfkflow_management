import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getReportData } from "@/features/queries";
import { type AiProvider, getAiProvider } from "@/lib/ai-browser-settings";
import { getR2Object } from "@/lib/r2";

export const runtime = "nodejs";

const inputSchema = z.object({
  organizationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  view: z.enum(["day", "week", "month"]),
  provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI"]),
  apiKey: z.string().trim().min(20).max(500),
  model: z.string().trim().min(1).max(100),
}).refine(
  (input) => getAiProvider(input.provider).models.some((model) => model.value === input.model),
  { message: "선택한 AI 제공사에서 지원하지 않는 모델입니다.", path: ["model"] },
);

type ReferenceFile = {
  fileName: string;
  mimeType: string;
  size: number;
  data: Uint8Array;
};

type ReferenceFiles = ReferenceFile[];

type ProviderResult = {
  report?: string;
  error?: string;
  status: number;
};

const SYSTEM_INSTRUCTIONS = [
  "당신은 한국어 조직 일정 보고서 작성자입니다.",
  "제공된 일정 데이터만 사실 근거로 사용하고, 없는 사실이나 수치를 만들지 마세요.",
  "첨부된 레퍼런스 파일이 있으면 그 파일의 제목 구성, 섹션 순서, 문체, 서술 방식과 시각적 계층을 우선적으로 모방하세요.",
  "레퍼런스 파일의 실제 사실이나 수치를 이번 보고서 내용으로 복사하지 마세요.",
  "별도 레퍼런스 양식이 없으면 핵심 요약, 완료 현황, 중요 일정, 리스크 및 확인 필요 사항, 다음 기간 권고 순서로 간결하고 실무적인 보고서를 작성하세요.",
  "마크다운 표는 사용하지 말고 제목과 불릿을 사용하세요.",
].join(" ");

function referenceText(referenceFiles: ReferenceFiles) {
  const limit = 200_000;
  let remaining = limit;
  const chunks: string[] = [];
  for (const referenceFile of referenceFiles.filter((file) => file.mimeType !== "application/pdf")) {
    if (remaining <= 0) break;
    const text = Buffer.from(referenceFile.data).toString("utf8");
    const included = text.slice(0, remaining);
    chunks.push(`[${referenceFile.fileName}]\n${included}${included.length < text.length ? "\n[파일 내용 일부 생략]" : ""}`);
    remaining -= included.length;
  }
  return chunks.join("\n\n");
}

function buildPrompt(input: {
  organizationName: string;
  view: "day" | "week" | "month";
  date: string;
  organizationReference: string | null;
  scheduleData: unknown[];
  referenceFiles: ReferenceFiles;
}) {
  const textFile = referenceText(input.referenceFiles);
  return [
    "다음 데이터로 보고서를 작성하세요.",
    JSON.stringify({
      organization: input.organizationName,
      period: { view: input.view, date: input.date },
      organizationReference: input.organizationReference || "등록된 작성 원칙 없음",
      referenceFileNames: input.referenceFiles.map((file) => file.fileName),
      schedules: input.scheduleData,
    }),
    textFile ? `\n[첨부 레퍼런스 파일 텍스트]\n${textFile}` : "",
  ].filter(Boolean).join("\n");
}

function referenceBase64(referenceFile: ReferenceFile) {
  return Buffer.from(referenceFile.data).toString("base64");
}

async function callOpenAI(apiKey: string, model: string, prompt: string, referenceFiles: ReferenceFiles, userId: string): Promise<ProviderResult> {
  const content: Array<Record<string, unknown>> = referenceFiles
    .filter((file) => file.mimeType === "application/pdf")
    .map((referenceFile) => ({
      type: "input_file",
      filename: referenceFile.fileName,
      file_data: `data:application/pdf;base64,${referenceBase64(referenceFile)}`,
      detail: "high",
    }));
  content.push({ type: "input_text", text: prompt });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 3000,
      safety_identifier: createHash("sha256").update(userId).digest("hex"),
      instructions: SYSTEM_INSTRUCTIONS,
      input: [{ role: "user", content }],
    }),
    cache: "no-store",
  });
  const payload = await response.json() as {
    error?: { message?: string };
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  const report = (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return { report, error: payload.error?.message, status: response.status };
}

async function callAnthropic(apiKey: string, model: string, prompt: string, referenceFiles: ReferenceFiles): Promise<ProviderResult> {
  const content: Array<Record<string, unknown>> = referenceFiles
    .filter((file) => file.mimeType === "application/pdf")
    .map((referenceFile) => ({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: referenceBase64(referenceFile) },
    }));
  content.push({ type: "text", text: prompt });
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 3000, system: SYSTEM_INSTRUCTIONS, messages: [{ role: "user", content }] }),
    cache: "no-store",
  });
  const payload = await response.json() as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };
  const report = (payload.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return { report, error: payload.error?.message, status: response.status };
}

async function callGemini(apiKey: string, model: string, prompt: string, referenceFiles: ReferenceFiles): Promise<ProviderResult> {
  const parts: Array<Record<string, unknown>> = referenceFiles
    .filter((file) => file.mimeType === "application/pdf")
    .map((referenceFile) => ({ inline_data: { mime_type: "application/pdf", data: referenceBase64(referenceFile) } }));
  parts.push({ text: prompt });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: 3000 },
    }),
    cache: "no-store",
  });
  const payload = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const report = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .filter((item) => typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return { report, error: payload.error?.message, status: response.status };
}

async function callProvider(provider: AiProvider, apiKey: string, model: string, prompt: string, referenceFiles: ReferenceFiles, userId: string) {
  if (provider === "ANTHROPIC") return callAnthropic(apiKey, model, prompt, referenceFiles);
  if (provider === "GEMINI") return callGemini(apiKey, model, prompt, referenceFiles);
  return callOpenAI(apiKey, model, prompt, referenceFiles, userId);
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
    const prompt = buildPrompt({
      organizationName: organization.name,
      view: input.view,
      date: input.date,
      organizationReference: [
        organization.reportReference,
        ...organization.reportReferencePrinciples.map((principle) => principle.content),
      ].filter(Boolean).join("\n- ") || null,
      scheduleData,
      referenceFiles,
    });
    const result = await callProvider(input.provider, input.apiKey, input.model, prompt, referenceFiles, membership.userId);
    if (result.status < 200 || result.status >= 300) {
      return NextResponse.json(
        { error: result.error || `${getAiProvider(input.provider).label} 요청에 실패했습니다. API 키와 모델을 확인해 주세요.` },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
      );
    }
    if (!result.report) return NextResponse.json({ error: `${getAiProvider(input.provider).label} 응답에서 보고서 내용을 읽지 못했습니다.` }, { status: 502 });
    return NextResponse.json({ report: result.report });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "보고서 요청 정보가 올바르지 않습니다." }, { status: 400 });
    return NextResponse.json({ error: "AI 보고서를 생성하지 못했습니다." }, { status: 500 });
  }
}
