import { NextResponse } from "next/server";

import { createLog, extractEnvironmentsFromShots } from "@/lib/advanced-workflow-service";
import { updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    let environments = null;
    await updateDb((db) => {
      const shots = db.shots.filter((shot) => shot.projectId === projectId);
      const existing = db.environments.filter((environment) => environment.projectId === projectId);
      const drafts = extractEnvironmentsFromShots(projectId, shots, existing);
      db.environments.push(...drafts);
      environments = [...existing, ...drafts];
      db.studioLogs.push(createLog({
        projectId,
        stage: "environments",
        action: "extract_from_shots",
        model: "mock-environment-extractor",
        inputSummary: `${shots.length} shots`,
        outputSummary: `${drafts.length} environment drafts`,
        status: "success",
        cost: 0,
        durationMs: 180,
      }));
    });
    return NextResponse.json({ environments });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
