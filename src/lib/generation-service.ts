import type {
  Asset,
  Character,
  GenerationJob,
  ModelCapabilities,
  Project,
  Shot,
} from "@/lib/schemas";
import { nowIso, slugifyProjectName } from "@/lib/local-db";
import { StudioError } from "@/lib/studio-errors";

export type VideoMode =
  | "text-to-video"
  | "image-to-video"
  | "reference-to-video"
  | "first-last-frame"
  | "extend-video"
  | "edit-video"
  | "transition-video";

export type VideoSettings = {
  mode: VideoMode;
  model: string;
  duration: number;
  aspectRatio: "9:16" | "16:9";
  resolution: string;
  fps: number;
  outputFormat: string;
  audioMode: "none" | "model";
};

export function modelDisplayName(model: { name?: string; displayName?: string; id: string }) {
  return model.displayName ?? model.name ?? model.id;
}

export function getImageModel(capabilities: ModelCapabilities, modelId: string) {
  return capabilities.imageModels.find((model) => model.id === modelId);
}

export function getVideoModel(capabilities: ModelCapabilities, modelId: string) {
  return capabilities.videoModels.find((model) => model.id === modelId);
}

function characterExists(name: string, characters: Character[]) {
  const normalized = name.trim().toLowerCase();
  return characters.some((character) =>
    [character.id, character.nameZh, character.nameEn]
      .filter(Boolean)
      .some((value) => value.trim().toLowerCase() === normalized),
  );
}

function durationValues(durations: number[] | { min: number; max: number } | undefined) {
  if (!durations) return [];
  if (Array.isArray(durations)) return durations;
  const values = [];
  for (let value = durations.min; value <= durations.max; value += 1) values.push(value);
  return values;
}

export function validateImageGenerationReadiness(
  shot: Shot,
  characters: Character[],
  capabilities: ModelCapabilities,
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const model = getImageModel(capabilities, shot.imageModel);

  if (!shot.approved) errors.push("分鏡尚未確認。");
  if (!shot.imagePromptEn.trim()) errors.push("缺少英文圖片提示詞。");
  if (!model) {
    errors.push("圖片模型不存在於 model-capabilities.json。");
  } else {
    if (!model.aspectRatios.includes(shot.aspectRatio)) errors.push("圖片模型不支援目前比例。");
    if (model.supportsReferenceImages && model.maxReferenceImages !== 0) {
      for (const name of shot.characters) {
        const character = characters.find((item) =>
          [item.id, item.nameZh, item.nameEn].filter(Boolean).some((value) => value.toLowerCase() === name.toLowerCase()),
        );
        if (character && !character.lockedReferenceAssetId) warnings.push(`${name} 沒有 locked reference image。`);
      }
    }
  }
  for (const name of shot.characters) {
    if (!characterExists(name, characters)) warnings.push(`${name} 尚未建立 Character Bible。`);
  }
  if (!shot.negativePrompt.trim()) warnings.push("缺少 negativePrompt。");
  if (!shot.continuityRules.trim()) warnings.push("缺少 continuityRules。");

  return { ready: errors.length === 0, errors, warnings };
}

export function validateVideoGenerationReadiness(
  shot: Shot,
  approvedImage: Asset | undefined,
  capabilities: ModelCapabilities,
  settings: VideoSettings,
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const model = getVideoModel(capabilities, settings.model);

  if (!shot.approved) errors.push("分鏡尚未確認。");
  if (!shot.videoPromptEn.trim()) errors.push("缺少英文影片提示詞。");
  if (!model) {
    errors.push("影片模型不存在於 model-capabilities.json。");
  } else {
    const durations = durationValues(model.durations);
    if (!model.modes.includes(settings.mode)) errors.push("模型不支援目前影片生成模式。");
    if (!durations.includes(settings.duration)) errors.push("模型不支援目前秒數。");
    if (!model.aspectRatios.includes(settings.aspectRatio)) errors.push("模型不支援目前比例。");
    if (model.resolutions?.length && !model.resolutions.includes(settings.resolution)) errors.push("模型不支援目前解析度。");
    if (model.fps?.length && !model.fps.includes(settings.fps)) errors.push("模型不支援目前 FPS。");
  }
  if (settings.mode === "image-to-video" && !approvedImage) {
    errors.push("圖生影片需要 approved image。");
  }
  if (approvedImage && settings.aspectRatio !== shot.aspectRatio) {
    warnings.push("圖片比例與影片比例不一致，請先裁切或擴圖。");
  }
  if (!/consistent|一致|continuity|保持/i.test(`${shot.videoPromptEn} ${shot.continuityRules}`)) {
    warnings.push("影片提示詞可能缺少 continuity rules。");
  }

  return { ready: errors.length === 0, errors, warnings };
}

export function totalActualCost(jobs: GenerationJob[]) {
  return jobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost ?? 0), 0);
}

export function assertWithinCostLimit(project: Project, jobs: GenerationJob[], nextCost: number) {
  if (!project.costLimit) return;
  const total = totalActualCost(jobs) + nextCost;
  if (total > project.costLimit) {
    throw new StudioError("CostLimitError", {
      code: "COST_LIMIT_EXCEEDED",
      message: `Cost limit ${project.costLimit} would be exceeded by ${total}.`,
      userMessage: `預估成本會超過專案上限 $${project.costLimit.toFixed(2)}。`,
      details: { currentCost: totalActualCost(jobs), nextCost, costLimit: project.costLimit },
      suggestedAction: "請調高 costLimit，或減少本次佇列任務數。",
    });
  }
}

export function nextAssetVersion(assets: Asset[], shotId: string, type: Asset["type"]) {
  const versions = assets
    .filter((asset) => asset.shotId === shotId && asset.type === type)
    .map((asset) => asset.version);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

function svgDataUrl(title: string, lines: string[], aspectRatio: "9:16" | "16:9") {
  const width = aspectRatio === "9:16" ? 720 : 1280;
  const height = aspectRatio === "9:16" ? 1280 : 720;
  const escapedTitle = title.replace(/[<>&"]/g, "");
  const text = lines
    .slice(0, 6)
    .map((line, index) => `<text x="56" y="${180 + index * 48}" fill="#dff7f4" font-size="28">${line.replace(/[<>&"]/g, "")}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f766e"/><stop offset="0.58" stop-color="#2563eb"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="28" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.35)"/>
  <text x="56" y="110" fill="#ffffff" font-size="42" font-weight="700">${escapedTitle}</text>
  ${text}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generateMockImage(project: Project, shot: Shot, assets: Asset[]) {
  const version = nextAssetVersion(assets, shot.id, "generated_image");
  const slug = slugifyProjectName(project.name);
  const model = shot.imageModel;
  const filename = `${slug}_${shot.segmentId}_${shot.id}_image_v${version}.png`;
  const timestamp = nowIso();
  return {
    id: `asset-${shot.id}-image-v${version}`,
    projectId: project.id,
    shotId: shot.id,
    type: "generated_image",
    url: svgDataUrl(`${shot.id} image v${version}`, [shot.titleZh, model, shot.aspectRatio, shot.camera], shot.aspectRatio),
    localPath: `storage/assets/${project.id}/${filename}`,
    filename,
    version,
    provider: "mock",
    model,
    promptSnapshot: shot.imagePromptEn,
    cost: 0,
    status: "generated",
    createdAt: timestamp,
  } satisfies Asset;
}

export function generateMockVideo(
  project: Project,
  shot: Shot,
  assets: Asset[],
  settings: VideoSettings,
) {
  const version = nextAssetVersion(assets, shot.id, "generated_video");
  const slug = slugifyProjectName(project.name);
  const filename = `${slug}_${shot.segmentId}_${shot.id}_video_v${version}.mp4`;
  const timestamp = nowIso();
  const payload = {
    shotId: shot.id,
    title: shot.titleZh,
    videoModel: settings.model,
    duration: settings.duration,
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    version,
    status: "success",
  };

  return {
    id: `asset-${shot.id}-video-v${version}`,
    projectId: project.id,
    shotId: shot.id,
    type: "generated_video",
    url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`,
    localPath: `storage/assets/${project.id}/${filename}`,
    filename,
    version,
    provider: "mock",
    model: settings.model,
    promptSnapshot: shot.videoPromptEn,
    cost: 0,
    status: "generated",
    createdAt: timestamp,
  } satisfies Asset;
}

export function createSuccessJob(input: {
  projectId: string;
  shotId?: string;
  type: GenerationJob["type"];
  provider: GenerationJob["provider"];
  model: string;
  mode: string;
  inputPayload: Record<string, unknown>;
  inputAssets?: string[];
  outputAssetId?: string;
  estimatedCost?: number;
  actualCost?: number;
}) {
  const timestamp = nowIso();
  return {
    id: `job-${input.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId: input.projectId,
    shotId: input.shotId,
    type: input.type,
    provider: input.provider,
    model: input.model,
    mode: input.mode,
    status: "success",
    inputPayload: input.inputPayload,
    outputPayload: input.outputAssetId ? { assetId: input.outputAssetId } : undefined,
    inputAssets: input.inputAssets ?? [],
    outputAssetId: input.outputAssetId,
    estimatedCost: input.estimatedCost ?? 0,
    actualCost: input.actualCost ?? input.estimatedCost ?? 0,
    retryCount: 0,
    createdAt: timestamp,
    startedAt: timestamp,
    completedAt: timestamp,
  } satisfies GenerationJob;
}
