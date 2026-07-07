import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import type { Asset } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.object({
  environmentId: z.string(),
  filename: z.string().min(1),
  dataUrl: z.string().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = inputSchema.parse(await request.json());
    const timestamp = nowIso();
    let asset: Asset | null = null;

    await updateDb((db) => {
      const environment = db.environments.find((item) => item.id === input.environmentId && item.projectId === projectId);
      if (!environment) throw new Error("找不到場景資料。");
      const version =
        db.assets.filter((item) => item.projectId === projectId && item.type === "reference_image").length + 1;
      asset = {
        id: `asset-env-ref-${input.environmentId}-${Date.now()}`,
        projectId,
        type: "reference_image",
        url: input.dataUrl,
        localPath: `storage/assets/${projectId}/environment_refs/${input.filename}`,
        filename: input.filename,
        version,
        provider: "local",
        model: "uploaded-reference",
        promptSnapshot: environment.fixedPromptEn,
        cost: 0,
        status: "uploaded",
        createdAt: timestamp,
      };
      db.assets.push(asset);
      db.environments = db.environments.map((item) =>
        item.id === input.environmentId
          ? {
              ...item,
              referenceAssetIds: Array.from(new Set(item.referenceAssetIds.concat(asset!.id))),
              updatedAt: timestamp,
            }
          : item,
      );
      db.studioLogs.push(createLog({
        projectId,
        stage: "environments",
        action: "upload_environment_reference",
        model: "local-upload-adapter",
        inputSummary: input.filename,
        outputSummary: asset.id,
        status: "success",
        cost: 0,
        durationMs: 80,
      }));
    });

    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
