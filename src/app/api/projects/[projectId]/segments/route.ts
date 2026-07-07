import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import { segmentSchema } from "@/lib/schemas";

const segmentsInputSchema = z.object({
  segments: z.array(segmentSchema).min(1, "至少需要一個片段"),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const { segments } = segmentsInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const normalized = segments.map((segment, index) => ({
      ...segment,
      projectId,
      order: index + 1,
      updatedAt: timestamp,
    }));

    await updateDb((db) => {
      const changedSegmentIds = new Set(normalized.map((segment) => segment.id));
      db.segments = [
        ...db.segments.filter((segment) => segment.projectId !== projectId),
        ...normalized,
      ];
      db.scripts = db.scripts.map((script) =>
        script.projectId === projectId && changedSegmentIds.has(script.segmentId)
          ? { ...script, approved: false, updatedAt: timestamp }
          : script,
      );
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
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, updatedAt: timestamp } : project,
      );
    });

    return NextResponse.json({ segments: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存片段失敗" },
      { status: 400 },
    );
  }
}
