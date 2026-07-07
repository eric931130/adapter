import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import { characterSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const charactersInputSchema = z.object({
  characters: z.array(characterSchema),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const { characters } = charactersInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const normalized = characters.map((character) => ({
      ...character,
      projectId,
      updatedAt: timestamp,
    }));

    await updateDb((db) => {
      db.characters = [
        ...db.characters.filter((character) => character.projectId !== projectId),
        ...normalized,
      ];
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, updatedAt: timestamp } : project,
      );
    });

    return NextResponse.json({ characters: normalized });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
