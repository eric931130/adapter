import { NextResponse } from "next/server";
import { z } from "zod";

import { updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.object({
  action: z.literal("clear"),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    inputSchema.parse(await request.json());
    await updateDb((db) => {
      db.studioLogs = db.studioLogs.filter((log) => log.projectId !== projectId);
    });
    return NextResponse.json({ cleared: true });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
