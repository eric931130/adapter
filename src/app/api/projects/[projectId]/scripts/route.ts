import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import { getFinalShotCount } from "@/lib/script-service";
import { scriptSchema } from "@/lib/schemas";

const scriptsInputSchema = z.object({
  scripts: z.array(scriptSchema).min(1, "至少需要一份劇本"),
  approve: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = scriptsInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const scripts = input.scripts.map((script) => {
      const finalShotCount = getFinalShotCount(script);
      if (finalShotCount < 1 || finalShotCount > 30) {
        throw new Error("分鏡數必須介於 1 到 30。");
      }
      return {
        ...script,
        projectId,
        userShotCount: finalShotCount,
        approved: input.approve ? true : script.approved,
        updatedAt: timestamp,
      };
    });

    await updateDb((db) => {
      const changedSegmentIds = new Set(scripts.map((script) => script.segmentId));
      db.scripts = [
        ...db.scripts.filter((script) => script.projectId !== projectId),
        ...scripts,
      ];
      if (!input.approve) {
        db.shots = db.shots.map((shot) =>
          shot.projectId === projectId && changedSegmentIds.has(shot.segmentId)
            ? { ...shot, approved: false, stale: true, updatedAt: timestamp }
            : shot,
        );
        db.assets = db.assets.map((asset) =>
          asset.projectId === projectId && db.shots.some((shot) => changedSegmentIds.has(shot.segmentId) && shot.id === asset.shotId)
            ? { ...asset, status: "stale" }
            : asset,
        );
      }
      db.projects = db.projects.map((project) =>
        project.id === projectId
          ? { ...project, status: input.approve ? "storyboard_ready" : project.status, updatedAt: timestamp }
          : project,
      );
    });

    return NextResponse.json({ scripts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存正式劇本失敗" },
      { status: 400 },
    );
  }
}
