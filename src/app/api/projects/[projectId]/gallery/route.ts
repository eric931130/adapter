import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog, syncGalleryFromAssets } from "@/lib/advanced-workflow-service";
import { updateDb } from "@/lib/local-db";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("favorite"), galleryItemId: z.string(), favorite: z.boolean() }),
  z.object({ action: z.literal("tags"), galleryItemId: z.string(), tags: z.array(z.string()) }),
]);

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = inputSchema.parse(await request.json());
    let payload = {};

    await updateDb((db) => {
      if (input.action === "sync") {
        const assets = db.assets.filter((asset) => asset.projectId === projectId);
        const existing = db.galleryItems.filter((item) => item.projectId === projectId);
        const synced = syncGalleryFromAssets(projectId, assets, existing);
        db.galleryItems = db.galleryItems.filter((item) => item.projectId !== projectId).concat(synced);
        db.studioLogs.push(createLog({
          projectId,
          stage: "gallery",
          action: "sync_assets",
          model: "local-gallery-indexer",
          inputSummary: `${assets.length} assets`,
          outputSummary: `${synced.length} gallery items`,
          status: "success",
          cost: 0,
          durationMs: 90,
        }));
        payload = { galleryItems: synced };
      }

      if (input.action === "favorite") {
        db.galleryItems = db.galleryItems.map((item) =>
          item.id === input.galleryItemId ? { ...item, favorite: input.favorite } : item,
        );
        payload = { galleryItemId: input.galleryItemId, favorite: input.favorite };
      }

      if (input.action === "tags") {
        db.galleryItems = db.galleryItems.map((item) =>
          item.id === input.galleryItemId ? { ...item, tags: input.tags } : item,
        );
        payload = { galleryItemId: input.galleryItemId, tags: input.tags };
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
