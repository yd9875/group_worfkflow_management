import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { deleteR2Object, getR2Object } from "@/lib/r2";
import { requireMembership } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizedReport(request: Request, reportId: string) {
  const organizationId = z.string().uuid().parse(new URL(request.url).searchParams.get("organizationId"));
  const membership = await requireMembership(organizationId);
  const report = await prisma.generatedReport.findFirst({
    where: { id: z.string().uuid().parse(reportId), organizationId },
  });
  if (!report) throw new AppError("NOT_FOUND", "생성된 보고서 파일을 찾지 못했습니다.", 404);
  return { report, membership };
}

export async function GET(request: Request, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params;
    const { report } = await authorizedReport(request, reportId);
    const body = await getR2Object(report.objectKey);
    return new Response(Buffer.from(body), {
      headers: {
        "Content-Type": report.mimeType,
        "Content-Length": String(report.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "보고서 요청 정보가 올바르지 않습니다." }, { status: 400 });
    console.error("Generated report download failed", error);
    return NextResponse.json({ error: "보고서 파일을 다운로드하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params;
    const { report, membership } = await authorizedReport(request, reportId);
    if (membership.role === "MEMBER" && report.createdByUserId !== membership.userId) {
      throw new AppError("FORBIDDEN", "다른 구성원이 생성한 보고서는 삭제할 수 없습니다.", 403);
    }
    await deleteR2Object(report.objectKey);
    await prisma.generatedReport.delete({ where: { id: report.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "보고서 요청 정보가 올바르지 않습니다." }, { status: 400 });
    console.error("Generated report deletion failed", error);
    return NextResponse.json({ error: "보고서 파일을 삭제하지 못했습니다." }, { status: 500 });
  }
}
