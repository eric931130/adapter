import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import type { Asset } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const referenceAssetInputSchema = z.object({
  characterId: z.string(),
  filename: z.string(),
  dataUrl: z.string(),
  lock: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = referenceAssetInputSchema.parse(await request.json());
    const timestamp = nowIso();
    let asset: Asset | null = null;

    await updateDb((db) => {
      const character = db.characters.find((item) => item.projectId === projectId && item.id === input.characterId);
      if (!character) throw new Error("找不到角色");
      const version =
        Math.max(
          0,
          ...db.assets
            .filter((item) => item.projectId === projectId && item.characterId === input.characterId && item.type === "reference_image")
            .map((item) => item.version),
        ) + 1;
      asset = {
        id: `asset-${input.characterId}-reference-v${version}`,
        projectId,
        characterId: input.characterId,
        type: "reference_image",
        url: input.dataUrl,
        localPath: `storage/assets/${projectId}/${input.filename}`,
        filename: input.filename,
        version,
        provider: "local",
        model: "reference-upload",
        promptSnapshot: character.fixedPromptEn,
        cost: 0,
        status: input.lock ? "approved" : "uploaded",
        createdAt: timestamp,
      } satisfies Asset;
      db.assets.push(asset);
      if (input.lock) {
        db.characters = db.characters.map((item) =>
          item.id === input.characterId ? { ...item, lockedReferenceAssetId: asset!.id, updatedAt: timestamp } : item,
        );
      }
    });

    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
