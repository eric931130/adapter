import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { environmentSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const environmentsInputSchema = z.object({
  environments: z.array(environmentSchema),
});

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const { environments } = environmentsInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const normalized = environments.map((environment) => ({ ...environment, projectId, updatedAt: timestamp }));

    await updateDb((db) => {
      db.environments = [
        ...db.environments.filter((environment) => environment.projectId !== projectId),
        ...normalized,
      ];
      db.studioLogs.push(createLog({
        projectId,
        stage: "environments",
        action: "save_environment_bible",
        model: "local-environment-bible",
        inputSummary: `${normalized.length} environments`,
        outputSummary: "Environment Bible saved",
        status: "success",
        cost: 0,
        durationMs: 90,
      }));
    });

    return NextResponse.json({ environments: normalized });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
