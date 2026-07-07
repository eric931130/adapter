import { NextResponse } from "next/server";

import { getDbProjectBundle } from "@/lib/local-db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return NextResponse.json(await getDbProjectBundle(projectId));
}
