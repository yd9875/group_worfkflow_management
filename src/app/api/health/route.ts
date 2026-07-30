import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "organization-schedule",
    time: new Date().toISOString(),
  });
}
