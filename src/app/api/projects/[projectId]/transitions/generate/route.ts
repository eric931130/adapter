import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog, generateMockTransitionVideo } from "@/lib/advanced-workflow-service";
import { getVideoModel } from "@/lib/generation-service";
import { modelCapabilities } from "@/lib/model-capabilities";
import { nowIso, updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.object({
  transitionIds: z.array(z.string()).optional(),
  allPending: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = inputSchema.parse(await request.json());
    const timestamp = nowIso();
    let payload = {};

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");
      const selectedIds = new Set(input.transitionIds ?? []);
      const transitions = db.transitions.filter((transition) => {
        if (transition.projectId !== projectId) return false;
        if (input.allPending) return transition.status === "pending" || transition.status === "failed";
        return selectedIds.has(transition.id);
      });
      if (!transitions.length) throw new Error("沒有可生成的 transition。");

      const assets = [];
      const jobs = [];
      for (const transition of transitions) {
        const model = getVideoModel(modelCapabilities, transition.videoModel);
        if (!model) throw new Error(`${transition.id}: 影片模型不存在於 model-capabilities.json`);
        const fromImage = db.assets.find((asset) => asset.id === transition.fromImageAssetId);
        const toImage = db.assets.find((asset) => asset.id === transition.toImageAssetId);
        if (!fromImage || !toImage) throw new Error(`${transition.id}: 缺少 from/to image asset`);
        const result = generateMockTransitionVideo(project, transition, db.assets.concat(assets));
        const finalAsset = { ...result.asset, status: transition.approvedVideoAssetId ? "generated" : "approved" } as const;
        assets.push(finalAsset);
        jobs.push(result.job);
        db.transitions = db.transitions.map((item) =>
          item.id === transition.id
            ? {
                ...item,
                status: transition.approvedVideoAssetId ? "success" : "approved",
                approvedVideoAssetId: transition.approvedVideoAssetId ?? finalAsset.id,
                updatedAt: timestamp,
              }
            : item,
        );
        db.studioLogs.push(createLog({
          projectId,
          stage: "transitions",
          action: "generate_transition_video",
          model: transition.videoModel,
          inputSummary: `${transition.fromShotId} -> ${transition.toShotId}`,
          outputSummary: finalAsset.filename,
          status: "success",
          cost: 0,
          durationMs: 500,
        }));
      }
      db.assets.push(...assets);
      db.generationJobs.push(...jobs);
      payload = { assets, jobs };
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
