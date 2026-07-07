import { NextResponse } from "next/server";

import { runProjectHealthCheck } from "@/lib/health-service";
import { errorResponse } from "@/lib/studio-errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    return NextResponse.json(await runProjectHealthCheck(projectId));
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
