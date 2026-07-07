import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import { presetSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const presetInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), presets: z.array(presetSchema) }),
  z.object({ action: z.literal("apply-project"), presetId: z.string() }),
  z.object({ action: z.literal("apply-shots"), presetId: z.string() }),
  z.object({ action: z.literal("import"), presets: z.array(presetSchema) }),
]);

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = presetInputSchema.parse(await request.json());
    const timestamp = nowIso();
    let payload = {};

    await updateDb((db) => {
      if (input.action === "save" || input.action === "import") {
        const incoming = input.presets.map((preset) => ({ ...preset, updatedAt: timestamp }));
        const incomingIds = new Set(incoming.map((preset) => preset.id));
        db.presets = [...db.presets.filter((preset) => !incomingIds.has(preset.id)), ...incoming];
        payload = { presets: db.presets };
      } else {
        const preset = db.presets.find((item) => item.id === input.presetId);
        if (!preset) throw new Error("找不到 preset");
        if (input.action === "apply-project") {
          db.projects = db.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  defaultStyle: String(preset.settings.defaultStyle ?? project.defaultStyle),
                  defaultImageModel: String(preset.settings.imageModel ?? project.defaultImageModel),
                  defaultVideoModel: String(preset.settings.videoModel ?? project.defaultVideoModel),
                  defaultAspectRatio: preset.settings.aspectRatio === "16:9" ? "16:9" : project.defaultAspectRatio,
                  updatedAt: timestamp,
                }
              : project,
          );
        }
        if (input.action === "apply-shots") {
          db.shots = db.shots.map((shot) =>
            shot.projectId === projectId
              ? {
                  ...shot,
                  imageModel: String(preset.settings.imageModel ?? shot.imageModel),
                  videoModel: String(preset.settings.videoModel ?? shot.videoModel),
                  aspectRatio: preset.settings.aspectRatio === "16:9" ? "16:9" : "9:16",
                  negativePrompt: `${shot.negativePrompt}, ${preset.settings.negativePrompt ?? ""}`.replace(/,\s*$/, ""),
                  stale: true,
                  updatedAt: timestamp,
                }
              : shot,
          );
        }
        db.studioLogs.push(createLog({
          projectId,
          stage: "presets",
          action: input.action,
          model: "local-preset-system",
          inputSummary: preset.name,
          outputSummary: "Preset applied",
          status: "success",
          cost: 0,
          durationMs: 120,
        }));
        payload = { preset };
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
