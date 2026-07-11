import { NextResponse } from "next/server";
import { z } from "zod";

import { buildTimeline, createLog } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { timelineSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto-build") }),
  z.object({ action: z.literal("save"), timeline: timelineSchema }),
  z.object({ action: z.literal("mock-export") }),
]);

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = inputSchema.parse(await request.json());
    let payload = {};

    await updateDb((db) => {
      const timestamp = nowIso();
      if (input.action === "auto-build") {
        const shots = db.shots.filter((shot) => shot.projectId === projectId).toSorted((a, b) => a.order - b.order);
        const transitions = db.transitions.filter((transition) => transition.projectId === projectId);
        const timeline = buildTimeline(projectId, shots, transitions);
        db.timelines = db.timelines.filter((item) => item.projectId !== projectId).concat(timeline);
        db.studioLogs.push(createLog({
          projectId,
          stage: "timeline",
          action: "auto_arrange_by_shot_order",
          model: "mock-ffmpeg-adapter",
          inputSummary: `${shots.length} shots, ${transitions.length} transitions`,
          outputSummary: `${timeline.durationSeconds}s timeline`,
          status: "success",
          cost: 0,
          durationMs: 210,
        }));
        payload = { timeline };
      }

      if (input.action === "save") {
        const timeline = { ...input.timeline, projectId, updatedAt: timestamp };
        db.timelines = db.timelines.filter((item) => item.projectId !== projectId).concat(timeline);
        payload = { timeline };
      }

      if (input.action === "mock-export") {
        db.timelines = db.timelines.map((item) =>
          item.projectId === projectId ? { ...item, exportStatus: "success", updatedAt: timestamp } : item,
        );
        db.studioLogs.push(createLog({
          projectId,
          stage: "timeline",
          action: "mock_ffmpeg_merge",
          model: "mock-ffmpeg-adapter",
          inputSummary: "approved videos + transition clips",
          outputSummary: "final_video_export_record.mp4",
          status: "success",
          cost: 0,
          durationMs: 600,
        }));
        payload = { exportStatus: "success" };
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
