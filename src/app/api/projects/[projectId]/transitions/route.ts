import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog, createTransitions } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { transitionSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-adjacent") }),
  z.object({ action: z.literal("save"), transitions: z.array(transitionSchema) }),
  z.object({ action: z.literal("approve"), transitionId: z.string(), assetId: z.string() }),
]);

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = inputSchema.parse(await request.json());
    let payload = {};
    await updateDb((db) => {
      const timestamp = nowIso();
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");

      if (input.action === "create-adjacent") {
        const shots = db.shots.filter((shot) => shot.projectId === projectId).toSorted((a, b) => a.order - b.order);
        const drafts = createTransitions(project, shots);
        const existingIds = new Set(db.transitions.filter((item) => item.projectId === projectId).map((item) => item.id));
        const newDrafts = drafts.filter((item) => !existingIds.has(item.id));
        db.transitions.push(...newDrafts);
        db.studioLogs.push(createLog({
          projectId,
          stage: "transitions",
          action: "create_adjacent_transitions",
          model: "mock-transition-planner",
          inputSummary: `${shots.length} approved shots`,
          outputSummary: `${newDrafts.length} transition drafts`,
          status: "success",
          cost: 0,
          durationMs: 180,
        }));
        payload = { transitions: db.transitions.filter((item) => item.projectId === projectId) };
      }

      if (input.action === "save") {
        const ids = new Set(input.transitions.map((item) => item.id));
        db.transitions = db.transitions
          .filter((item) => item.projectId !== projectId || !ids.has(item.id))
          .concat(input.transitions.map((item) => ({ ...item, projectId, updatedAt: timestamp })));
        db.studioLogs.push(createLog({
          projectId,
          stage: "transitions",
          action: "save_transitions",
          model: "local-json-db",
          inputSummary: `${input.transitions.length} transitions`,
          outputSummary: "saved",
          status: "success",
          cost: 0,
          durationMs: 80,
        }));
        payload = { transitions: db.transitions.filter((item) => item.projectId === projectId) };
      }

      if (input.action === "approve") {
        db.assets = db.assets.map((asset) =>
          asset.id === input.assetId ? { ...asset, status: "approved" } : asset,
        );
        db.transitions = db.transitions.map((transition) =>
          transition.id === input.transitionId
            ? { ...transition, approvedVideoAssetId: input.assetId, status: "approved", updatedAt: timestamp }
            : transition,
        );
        payload = { transitionId: input.transitionId, assetId: input.assetId };
      }
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
