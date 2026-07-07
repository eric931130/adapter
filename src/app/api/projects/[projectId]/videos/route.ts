import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertWithinCostLimit,
  createSuccessJob,
  generateMockVideo,
  getVideoModel,
  validateVideoGenerationReadiness,
} from "@/lib/generation-service";
import { createLog } from "@/lib/advanced-workflow-service";
import { modelCapabilities } from "@/lib/model-capabilities";
import { nowIso, updateDb } from "@/lib/local-db";
import type { Asset, GenerationJob } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const videoSettingsSchema = z.object({
  mode: z.enum(["text-to-video", "image-to-video", "reference-to-video", "first-last-frame", "extend-video", "edit-video", "transition-video"]),
  model: z.string(),
  duration: z.number().int().positive(),
  aspectRatio: z.enum(["9:16", "16:9"]),
  resolution: z.string(),
  fps: z.number().int().positive(),
  outputFormat: z.string(),
  audioMode: z.enum(["none", "model"]),
});

const videoInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    shotIds: z.array(z.string()).optional(),
    allPending: z.boolean().optional(),
    settings: videoSettingsSchema,
  }),
  z.object({
    action: z.literal("approve"),
    shotId: z.string(),
    assetId: z.string(),
  }),
  z.object({
    action: z.literal("rename"),
    assetId: z.string(),
    filename: z.string().min(1),
  }),
  z.object({
    action: z.literal("cancel-pending"),
  }),
  z.object({
    action: z.literal("batch-approve-latest"),
    shotIds: z.array(z.string()).min(1),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = videoInputSchema.parse(await request.json());
    const timestamp = nowIso();
    let payload = {};

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");

      if (input.action === "generate") {
        const selectedIds = new Set(input.shotIds ?? []);
        const shots = db.shots.filter((shot) => {
          if (shot.projectId !== projectId) return false;
          if (!shot.approved) return false;
          if (input.allPending) return shot.videoStatus === "pending" || shot.videoStatus === "failed";
          return selectedIds.has(shot.id);
        });
        if (!shots.length) throw new Error("沒有可生成的 approved shots。");
        const model = getVideoModel(modelCapabilities, input.settings.model);
        const estimatedCost = (model?.costPerSecond ?? 0) * input.settings.duration * shots.length;
        assertWithinCostLimit(project, db.generationJobs.filter((job) => job.projectId === projectId), estimatedCost);

        const assets: Asset[] = [];
        const jobs: GenerationJob[] = [];
        for (const shot of shots) {
          const approvedImage = db.assets.find((asset) => asset.id === shot.approvedImageAssetId && asset.status === "approved");
          const readiness = validateVideoGenerationReadiness(shot, approvedImage, modelCapabilities, input.settings);
          if (!readiness.ready) throw new Error(`${shot.id}: ${readiness.errors.join(" ")}`);
          const nextShot = { ...shot, videoModel: input.settings.model, aspectRatio: input.settings.aspectRatio };
          const asset = generateMockVideo(project, nextShot, db.assets.concat(assets), input.settings);
          const shouldAutoApprove = !shot.approvedVideoAssetId;
          const finalAsset: Asset = { ...asset, status: shouldAutoApprove ? "approved" : "generated" };
          const job = createSuccessJob({
            projectId,
            shotId: shot.id,
            type: "video",
            provider: model?.provider ?? "mock",
            model: input.settings.model,
            mode: input.settings.mode,
            inputPayload: {
              prompt: shot.videoPromptEn,
              settings: input.settings,
              inputAssetId: approvedImage?.id,
              providerStatusMap: model?.provider === "xai" ? ["pending", "done", "expired", "failed"] : undefined,
              warnings: readiness.warnings,
            },
            inputAssets: approvedImage ? [approvedImage.id] : [],
            outputAssetId: finalAsset.id,
            estimatedCost: (model?.costPerSecond ?? 0) * input.settings.duration,
            actualCost: 0,
          });
          assets.push(finalAsset);
          jobs.push(job);
          db.shots = db.shots.map((item) =>
            item.id === shot.id
              ? {
                  ...item,
                  videoModel: input.settings.model,
                  aspectRatio: input.settings.aspectRatio,
                  videoStatus: shouldAutoApprove ? "approved" : "success",
                  approvedVideoAssetId: shouldAutoApprove ? finalAsset.id : item.approvedVideoAssetId,
                  updatedAt: timestamp,
                }
              : item,
          );
        }
        db.assets.push(...assets);
        db.generationJobs.push(...jobs);
        db.studioLogs.push(createLog({
          projectId,
          stage: "videos",
          action: "generate_videos_with_fallback_ready",
          model: input.settings.model,
          inputSummary: `${shots.length} shots, mode=${input.settings.mode}`,
          outputSummary: `${assets.length} video assets; fallback=${model?.fallbackModelIds?.join(" > ") ?? "none"}`,
          status: "success",
          cost: 0,
          durationMs: 520,
        }));
        db.projects = db.projects.map((item) =>
          item.id === projectId ? { ...item, status: "video_ready", updatedAt: timestamp } : item,
        );
        payload = { assets, jobs };
      }

      if (input.action === "approve") {
        db.assets = db.assets.map((asset) =>
          asset.projectId === projectId && asset.shotId === input.shotId && asset.type === "generated_video"
            ? { ...asset, status: asset.id === input.assetId ? "approved" : "generated" }
            : asset,
        );
        db.shots = db.shots.map((shot) =>
          shot.id === input.shotId
            ? { ...shot, approvedVideoAssetId: input.assetId, videoStatus: "approved", updatedAt: timestamp }
            : shot,
        );
        payload = { assetId: input.assetId };
      }

      if (input.action === "rename") {
        db.assets = db.assets.map((asset) =>
          asset.id === input.assetId ? { ...asset, filename: input.filename } : asset,
        );
        payload = { assetId: input.assetId, filename: input.filename };
      }

      if (input.action === "cancel-pending") {
        db.generationJobs = db.generationJobs.map((job) =>
          job.projectId === projectId && job.type === "video" && (job.status === "pending" || job.status === "queued")
            ? { ...job, status: "cancelled", completedAt: timestamp }
            : job,
        );
        payload = { cancelled: true };
      }

      if (input.action === "batch-approve-latest") {
        const shotIds = new Set(input.shotIds);
        const approvedAssetIds: string[] = [];
        for (const shotId of shotIds) {
          const latest = db.assets
            .filter((asset) => asset.projectId === projectId && asset.shotId === shotId && asset.type === "generated_video")
            .toSorted((a, b) => b.version - a.version)[0];
          if (!latest) continue;
          approvedAssetIds.push(latest.id);
          db.assets = db.assets.map((asset) =>
            asset.projectId === projectId && asset.shotId === shotId && asset.type === "generated_video"
              ? { ...asset, status: asset.id === latest.id ? "approved" : "generated" }
              : asset,
          );
          db.shots = db.shots.map((shot) =>
            shot.id === shotId
              ? { ...shot, approvedVideoAssetId: latest.id, videoStatus: "approved", updatedAt: timestamp }
              : shot,
          );
        }
        payload = { approvedAssetIds };
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
