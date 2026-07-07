import { NextResponse } from "next/server";
import { z } from "zod";

import { modelCapabilities } from "@/lib/model-capabilities";
import { nowIso, updateDb } from "@/lib/local-db";
import { rowToShot } from "@/lib/shot-service";
import { errorResponse } from "@/lib/studio-errors";

const importInputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "請提供匯入列"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const { rows } = importInputSchema.parse(await request.json());
    const imageModelIds = new Set(modelCapabilities.imageModels.map((model) => model.id));
    const videoModelIds = new Set(modelCapabilities.videoModels.map((model) => model.id));
    const timestamp = nowIso();
    let shots = null;

    await updateDb((db) => {
      const projectShots = db.shots.filter((shot) => shot.projectId === projectId);
      const shotMap = new Map(projectShots.map((shot) => [shot.id, shot]));
      const segmentIds = new Set(db.segments.filter((segment) => segment.projectId === projectId).map((segment) => segment.id));
      const imported = rows.map((row) => {
        const shotId = String(row.shot_id ?? "");
        const segmentId = String(row.segment_id ?? "");
        const imagePromptEn = String(row.image_prompt_en ?? "");
        const videoPromptEn = String(row.video_prompt_en ?? "");
        const aspectRatio = String(row.aspect_ratio ?? "");
        const imageModel = String(row.image_model ?? "");
        const videoModel = String(row.video_model ?? "");
        if (!shotMap.has(shotId)) throw new Error(`shot_id 不存在：${shotId}`);
        if (!segmentIds.has(segmentId)) throw new Error(`segment_id 不存在：${segmentId}`);
        if (!imagePromptEn.trim()) throw new Error(`${shotId} 缺少 image_prompt_en`);
        if (!videoPromptEn.trim()) throw new Error(`${shotId} 缺少 video_prompt_en`);
        if (aspectRatio !== "9:16" && aspectRatio !== "16:9") throw new Error(`${shotId} aspect_ratio 不合法`);
        if (!imageModelIds.has(imageModel)) throw new Error(`${shotId} image_model 不存在於 model capabilities`);
        if (!videoModelIds.has(videoModel)) throw new Error(`${shotId} video_model 不存在於 model capabilities`);
        return rowToShot(shotMap.get(shotId)!, row);
      });

      const importedIds = new Set(imported.map((shot) => shot.id));
      db.shots = [
        ...db.shots.filter((shot) => shot.projectId !== projectId || !importedIds.has(shot.id)),
        ...imported,
      ].toSorted((a, b) => a.order - b.order);
      db.assets = db.assets.map((asset) =>
        asset.projectId === projectId && importedIds.has(asset.shotId ?? "")
          ? { ...asset, status: "prompt_outdated" }
          : asset,
      );
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, updatedAt: timestamp } : project,
      );
      shots = db.shots.filter((shot) => shot.projectId === projectId);
    });

    return NextResponse.json({ shots });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
