import { NextResponse } from "next/server";

import { applyCharacterBibleToShotPrompts, getCharacterIssues } from "@/lib/character-service";
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
    let issues = null;

    await updateDb((db) => {
      const projectShots = db.shots.filter((shot) => shot.projectId === projectId);
      const characters = db.characters.filter((character) => character.projectId === projectId);
      const assets = db.assets.filter((asset) => asset.projectId === projectId);
      const updatedShots = applyCharacterBibleToShotPrompts(projectShots, characters);
      const shotIds = new Set(updatedShots.map((shot) => shot.id));
      db.shots = [
        ...db.shots.filter((shot) => shot.projectId !== projectId || !shotIds.has(shot.id)),
        ...updatedShots,
      ].toSorted((a, b) => a.order - b.order);
      db.assets = db.assets.map((asset) =>
        asset.projectId === projectId && shotIds.has(asset.shotId ?? "")
          ? { ...asset, status: "prompt_outdated" }
          : asset,
      );
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, updatedAt: timestamp } : project,
      );
      shots = updatedShots;
      issues = getCharacterIssues(updatedShots, characters, assets);
    });

    return NextResponse.json({ shots, issues });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
