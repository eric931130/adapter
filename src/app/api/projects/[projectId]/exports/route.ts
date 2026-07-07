import { NextResponse } from "next/server";
import { z } from "zod";

import { createSuccessJob } from "@/lib/generation-service";
import { exportFilename } from "@/lib/export-service";
import { nowIso, updateDb } from "@/lib/local-db";
import type { Asset, GenerationJob } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const exportInputSchema = z.object({
  exportType: z.string().min(1),
  extension: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = exportInputSchema.parse(await request.json());
    const timestamp = nowIso();
    let job: GenerationJob | null = null;
    let asset: Asset | null = null;

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");
      const filename = exportFilename(project, input.exportType, input.extension);
      asset = {
        id: `asset-export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        type: "exported_file",
        url: "",
        localPath: `storage/exports/${projectId}/${filename}`,
        filename,
        version: 1,
        provider: "local",
        model: "local-export-packager",
        promptSnapshot: input.exportType,
        cost: 0,
        status: "generated",
        createdAt: timestamp,
      } satisfies Asset;
      job = createSuccessJob({
        projectId,
        type: "export",
        provider: "local",
        model: "local-export-packager",
        mode: input.exportType,
        inputPayload: { exportType: input.exportType, extension: input.extension },
        outputAssetId: asset.id,
      });
      db.assets.push(asset);
      db.generationJobs.push(job);
      db.projects = db.projects.map((item) =>
        item.id === projectId ? { ...item, updatedAt: timestamp } : item,
      );
    });

    return NextResponse.json({ job, asset });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
