import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getReportData } from "@/features/queries";

export const runtime = "nodejs";

const inputSchema = z.object({
  organizationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  view: z.enum(["day", "week", "month"]),
  apiKey: z.string().trim().min(20).max(500),
  model: z.string().trim().min(1).max(100),
});

type OpenAIResponse = {
  error?: { message?: string };
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function responseText(payload: OpenAIResponse) {
  return (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const selectedDate = new Date(`${input.date}T12:00:00`);
    const { schedules, organization, membership } = await getReportData(
      input.organizationId,
      selectedDate,
      input.view,
    );
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
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        max_output_tokens: 3000,
        safety_identifier: createHash("sha256").update(membership.userId).digest("hex"),
        instructions: "당신은 한국어 조직 일정 보고서 작성자입니다. 제공된 일정 데이터만 근거로 사용하고, 없는 사실이나 수치를 만들지 마세요. 핵심 요약, 완료 현황, 중요 일정, 리스크 및 확인 필요 사항, 다음 기간 권고 순서로 간결하고 실무적인 보고서를 작성하세요. 마크다운 표는 사용하지 말고 제목과 불릿을 사용하세요.",
        input: JSON.stringify({
          organization: organization.name,
          period: { view: input.view, date: input.date },
          organizationReference: organization.reportReference || "등록된 레퍼런스 없음",
          schedules: scheduleData,
        }),
      }),
      cache: "no-store",
    });
    const payload = await apiResponse.json() as OpenAIResponse;
    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: payload.error?.message || "OpenAI 요청에 실패했습니다. API 키와 모델을 확인해 주세요." },
        { status: apiResponse.status },
      );
    }
    const report = responseText(payload);
    if (!report) return NextResponse.json({ error: "OpenAI 응답에서 보고서 내용을 읽지 못했습니다." }, { status: 502 });
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "보고서 요청 정보가 올바르지 않습니다." }, { status: 400 });
    return NextResponse.json({ error: "AI 보고서를 생성하지 못했습니다." }, { status: 500 });
  }
}
