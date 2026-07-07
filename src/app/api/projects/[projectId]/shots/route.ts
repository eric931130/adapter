import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import { shotSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const shotsInputSchema = z.object({
  shots: z.array(shotSchema).min(1, "至少需要一個分鏡"),
  approve: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = shotsInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const shots = input.shots.map((shot, index) => ({
      ...shot,
      projectId,
      order: index + 1,
      imageStatus: input.approve ? "pending" : shot.imageStatus,
      videoStatus: input.approve ? "pending" : shot.videoStatus,
      approved: input.approve ? true : Boolean(shot.approved),
      updatedAt: timestamp,
    }));

    await updateDb((db) => {
      const existingShotIds = new Set(shots.map((shot) => shot.id));
      db.shots = [
        ...db.shots.filter((shot) => shot.projectId !== projectId || !existingShotIds.has(shot.id)),
        ...shots,
      ].toSorted((a, b) => a.order - b.order);
      if (input.approve) {
        db.projects = db.projects.map((project) =>
          project.id === projectId ? { ...project, status: "storyboard_ready", updatedAt: timestamp } : project,
        );
      }
    });

    return NextResponse.json({ shots });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
