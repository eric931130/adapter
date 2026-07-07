import { NextResponse } from "next/server";
import { z } from "zod";

import { updateDb, nowIso } from "@/lib/local-db";
import { analyzeStory, analysisSegmentsToSegments } from "@/lib/story-analysis";
import { textWorkbenchSettingsSchema } from "@/lib/schemas";

const analyzeInputSchema = z.object({
  sourceText: z.string().min(1, "請先貼上或上傳故事原稿"),
  settings: textWorkbenchSettingsSchema,
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = analyzeInputSchema.parse(await request.json());
    const timestamp = nowIso();
    let responsePayload: unknown = null;

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) {
        throw new Error("找不到專案");
      }
      const analysis = analyzeStory({ project, sourceText: input.sourceText, settings: input.settings });
      const nextSegments = analysisSegmentsToSegments(projectId, analysis.segments);
      db.textSettings[projectId] = input.settings;
      db.storyAnalyses = [
        ...db.storyAnalyses.filter((item) => item.projectId !== projectId),
        { ...analysis, projectId, updatedAt: timestamp },
      ];
      db.segments = [
        ...db.segments.filter((segment) => segment.projectId !== projectId),
        ...nextSegments,
      ];
      db.projects = db.projects.map((item) =>
        item.id === projectId ? { ...item, status: "text_ready", updatedAt: timestamp } : item,
      );
      responsePayload = { analysis, segments: nextSegments };
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "故事分析失敗" },
      { status: 400 },
    );
  }
}
