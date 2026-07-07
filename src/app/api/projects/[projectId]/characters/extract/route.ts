import { NextResponse } from "next/server";

import { extractCharactersFromShots } from "@/lib/character-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const timestamp = nowIso();
    let characters = null;

    await updateDb((db) => {
      const shots = db.shots.filter((shot) => shot.projectId === projectId);
      const existing = db.characters.filter((character) => character.projectId === projectId);
      const drafts = extractCharactersFromShots(projectId, shots, existing);
      db.characters = [...db.characters, ...drafts];
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, updatedAt: timestamp } : project,
      );
      characters = [...existing, ...drafts];
    });

    return NextResponse.json({ characters });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
