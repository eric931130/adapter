import { NextResponse } from "next/server";

import { generateShots } from "@/lib/shot-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const timestamp = nowIso();
    let shots = null;

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");
      const segments = db.segments
        .filter((segment) => segment.projectId === projectId && segment.approved)
        .toSorted((a, b) => a.order - b.order);
      const scripts = db.scripts.filter((script) => script.projectId === projectId && script.approved);
      if (!segments.length) throw new Error("請先確認劇情片段。");
      if (!scripts.length) throw new Error("請先確認正式劇本與分鏡數。");
      shots = generateShots(project, segments, scripts);
      db.shots = [
        ...db.shots.filter((shot) => shot.projectId !== projectId),
        ...shots,
      ];
      db.assets = db.assets.map((asset) =>
        asset.projectId === projectId && (asset.type === "generated_image" || asset.type === "generated_video")
          ? { ...asset, status: "prompt_outdated" }
          : asset,
      );
      db.projects = db.projects.map((item) =>
        item.id === projectId ? { ...item, status: "storyboard_ready", updatedAt: timestamp } : item,
      );
    });

    return NextResponse.json({ shots });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
