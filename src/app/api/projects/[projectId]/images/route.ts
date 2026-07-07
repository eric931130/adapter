import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertWithinCostLimit,
  createSuccessJob,
  generateMockImage,
  getImageModel,
  validateImageGenerationReadiness,
} from "@/lib/generation-service";
import { createLog } from "@/lib/advanced-workflow-service";
import { modelCapabilities } from "@/lib/model-capabilities";
import { nowIso, updateDb } from "@/lib/local-db";
import type { Asset, GenerationJob } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const imageInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    shotIds: z.array(z.string()).optional(),
    allPending: z.boolean().optional(),
    candidateCount: z.number().int().min(1).max(4).optional(),
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
  z.object({
    action: z.literal("delete-unapproved-versions"),
    shotIds: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("apply-settings"),
    shotIds: z.array(z.string()).min(1),
    imageModel: z.string().optional(),
    aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = imageInputSchema.parse(await request.json());
    const timestamp = nowIso();
    let payload = {};

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");

      if (input.action === "generate") {
        const characters = db.characters.filter((character) => character.projectId === projectId);
        const selectedIds = new Set(input.shotIds ?? []);
        const shots = db.shots.filter((shot) => {
          if (shot.projectId !== projectId) return false;
          if (!shot.approved) return false;
          if (input.allPending) return shot.imageStatus === "pending" || shot.imageStatus === "failed";
          return selectedIds.has(shot.id);
        });
        if (!shots.length) throw new Error("沒有可生成的 approved shots。");
        const candidateCount = input.candidateCount ?? 1;
        const estimatedCost = shots.reduce((sum, shot) => {
          const model = getImageModel(modelCapabilities, shot.imageModel);
          return sum + (model?.costPerImage ?? 0) * candidateCount;
        }, 0);
        assertWithinCostLimit(project, db.generationJobs.filter((job) => job.projectId === projectId), estimatedCost);

        const assets: Asset[] = [];
        const jobs: GenerationJob[] = [];
        for (const shot of shots) {
          const readiness = validateImageGenerationReadiness(shot, characters, modelCapabilities);
          if (!readiness.ready) throw new Error(`${shot.id}: ${readiness.errors.join(" ")}`);
          const model = getImageModel(modelCapabilities, shot.imageModel);
          const hadApprovedAsset = Boolean(shot.approvedImageAssetId);
          let firstGeneratedAssetId = shot.approvedImageAssetId;
          for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
            const asset = generateMockImage(project, shot, db.assets.concat(assets));
            const shouldAutoApprove = !hadApprovedAsset && candidateIndex === 0;
            const finalAsset: Asset = { ...asset, status: shouldAutoApprove ? "approved" : "generated" };
            firstGeneratedAssetId ??= finalAsset.id;
            const job = createSuccessJob({
              projectId,
              shotId: shot.id,
              type: "image",
              provider: model?.provider ?? "mock",
              model: shot.imageModel,
              mode: candidateCount > 1 ? "multi-candidate-best-pick" : "text-to-image",
              inputPayload: {
                prompt: shot.imagePromptEn,
                aspectRatio: shot.aspectRatio,
                candidateIndex: candidateIndex + 1,
                candidateCount,
                warnings: readiness.warnings,
                fallbackModelIds: model?.fallbackModelIds ?? [],
              },
              outputAssetId: finalAsset.id,
              estimatedCost: model?.costPerImage ?? 0,
              actualCost: 0,
            });
            assets.push(finalAsset);
            jobs.push(job);
          }
          db.shots = db.shots.map((item) =>
            item.id === shot.id
              ? {
                  ...item,
                  imageStatus: hadApprovedAsset ? "success" : "approved",
                  approvedImageAssetId: item.approvedImageAssetId ?? firstGeneratedAssetId,
                  updatedAt: timestamp,
                }
              : item,
          );
        }
        db.assets.push(...assets);
        db.generationJobs.push(...jobs);
        db.studioLogs.push(createLog({
          projectId,
          stage: "images",
          action: candidateCount > 1 ? "generate_image_candidates" : "generate_images",
          model: "mock-image-adapter",
          inputSummary: `${shots.length} shots x ${candidateCount} candidates`,
          outputSummary: `${assets.length} image assets`,
          status: "success",
          cost: 0,
          durationMs: 350,
        }));
        db.projects = db.projects.map((item) =>
          item.id === projectId ? { ...item, status: "image_ready", updatedAt: timestamp } : item,
        );
        payload = { assets, jobs };
      }

      if (input.action === "approve") {
        db.assets = db.assets.map((asset) =>
          asset.projectId === projectId && asset.shotId === input.shotId && asset.type === "generated_image"
            ? { ...asset, status: asset.id === input.assetId ? "approved" : "generated" }
            : asset,
        );
        db.shots = db.shots.map((shot) =>
          shot.id === input.shotId
            ? { ...shot, approvedImageAssetId: input.assetId, imageStatus: "approved", updatedAt: timestamp }
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
          job.projectId === projectId && job.type === "image" && (job.status === "pending" || job.status === "queued")
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
            .filter((asset) => asset.projectId === projectId && asset.shotId === shotId && asset.type === "generated_image")
            .toSorted((a, b) => b.version - a.version)[0];
          if (!latest) continue;
          approvedAssetIds.push(latest.id);
          db.assets = db.assets.map((asset) =>
            asset.projectId === projectId && asset.shotId === shotId && asset.type === "generated_image"
              ? { ...asset, status: asset.id === latest.id ? "approved" : "generated" }
              : asset,
          );
          db.shots = db.shots.map((shot) =>
            shot.id === shotId
              ? { ...shot, approvedImageAssetId: latest.id, imageStatus: "approved", updatedAt: timestamp }
              : shot,
          );
        }
        payload = { approvedAssetIds };
      }

      if (input.action === "delete-unapproved-versions") {
        const shotIds = new Set(input.shotIds);
        const before = db.assets.length;
        db.assets = db.assets.filter((asset) => {
          if (asset.projectId !== projectId || !asset.shotId || !shotIds.has(asset.shotId)) return true;
          if (asset.type !== "generated_image") return true;
          return asset.status === "approved";
        });
        payload = { deleted: before - db.assets.length };
      }

      if (input.action === "apply-settings") {
        const shotIds = new Set(input.shotIds);
        db.shots = db.shots.map((shot) =>
          shot.projectId === projectId && shotIds.has(shot.id)
            ? {
                ...shot,
                imageModel: input.imageModel ?? shot.imageModel,
                aspectRatio: input.aspectRatio ?? shot.aspectRatio,
                imageStatus: "pending",
                updatedAt: timestamp,
              }
            : shot,
        );
        payload = { updatedShotIds: input.shotIds };
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
