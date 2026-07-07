import { NextResponse } from "next/server";

import { applyEnvironmentBibleToShotPrompts, createLog } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    let updatedShots = 0;
    await updateDb((db) => {
      const timestamp = nowIso();
      const projectShots = db.shots.filter((shot) => shot.projectId === projectId);
      const environments = db.environments.filter((environment) => environment.projectId === projectId);
      const applied = applyEnvironmentBibleToShotPrompts(projectShots, environments);
      const appliedMap = new Map(applied.map((shot) => [shot.id, shot]));
      db.shots = db.shots.map((shot) =>
        appliedMap.has(shot.id) ? { ...appliedMap.get(shot.id)!, updatedAt: timestamp } : shot,
      );
      updatedShots = applied.length;
      db.studioLogs.push(createLog({
        projectId,
        stage: "environments",
        action: "apply_environment_bible",
        model: "local-prompt-merge",
        inputSummary: `${environments.length} environments`,
        outputSummary: `${updatedShots} shots updated`,
        status: "success",
        cost: 0,
        durationMs: 140,
      }));
    });
    return NextResponse.json({ updatedShots });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
