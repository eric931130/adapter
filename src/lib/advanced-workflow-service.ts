import type {
  Asset,
  Environment,
  GalleryItem,
  Project,
  Shot,
  StudioLog,
  Timeline,
  Transition,
} from "@/lib/schemas";
import { nowIso, slugifyProjectName } from "@/lib/local-db";
import { createSuccessJob, nextAssetVersion, type VideoSettings } from "@/lib/generation-service";

function normalizeId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

export function createLog(input: Omit<StudioLog, "id" | "time">) {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: nowIso(),
    ...input,
  } satisfies StudioLog;
}

export function extractEnvironmentsFromShots(projectId: string, shots: Shot[], existing: Environment[] = []) {
  const timestamp = nowIso();
  const existingNames = new Set(existing.flatMap((item) => [item.id, item.nameZh, item.nameEn]));
  const locations = Array.from(new Set(shots.map((shot) => shot.location.trim()).filter(Boolean)));

  return locations
    .filter((location) => !existingNames.has(location) && !existingNames.has(`environment-${projectId}-${normalizeId(location)}`))
    .map((location) => ({
      id: `environment-${projectId}-${normalizeId(location)}`,
      projectId,
      nameZh: location,
      nameEn: location,
      descriptionZh: `${location} 的場景一致性設定。`,
      descriptionEn: `Environment consistency profile for ${location}.`,
      visualStyle: "consistent cinematic background, stable geography",
      colorPalette: "sky blue, soft teal, gentle lavender",
      lighting: "soft directional light, stable shadows",
      fixedPromptZh: `${location}：固定牆面材質、空間方向、道具位置與色調。`,
      fixedPromptEn: `${location}: keep wall texture, spatial layout, prop placement, and color palette consistent.`,
      negativePrompt: "background drift, wrong architecture, inconsistent lighting, extra signs, random text",
      referenceAssetIds: [],
      consistencyNotes: "Keep the same environment logic across every related shot.",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Environment));
}

function removeEnvironmentBlock(prompt: string) {
  return prompt.replace(/^\[ENVIRONMENT CONSISTENCY\][\s\S]*?\[SHOT PROMPT\]\n?/m, "").trim();
}

function environmentForShot(shot: Shot, environments: Environment[]) {
  const normalizedLocation = shot.location.trim().toLowerCase();
  return environments.find((environment) =>
    [environment.id, environment.nameZh, environment.nameEn].some((value) => value.trim().toLowerCase() === normalizedLocation),
  );
}

export function applyEnvironmentBibleToShotPrompts(shots: Shot[], environments: Environment[]) {
  const timestamp = nowIso();
  return shots.map((shot) => {
    const environment = environmentForShot(shot, environments);
    if (!environment) return shot;
    const blockZh = [
      "[ENVIRONMENT CONSISTENCY]",
      `Location: ${environment.nameZh}`,
      `Lighting: ${environment.lighting}`,
      `Must keep: ${environment.consistencyNotes}`,
      `Fixed environment: ${environment.fixedPromptZh}`,
      "",
      "[SHOT PROMPT]",
    ].join("\n");
    const blockEn = [
      "[ENVIRONMENT CONSISTENCY]",
      `Location: ${environment.nameEn}`,
      `Lighting: ${environment.lighting}`,
      `Must keep: ${environment.consistencyNotes}`,
      `Fixed environment: ${environment.fixedPromptEn}`,
      "",
      "[SHOT PROMPT]",
    ].join("\n");
    return {
      ...shot,
      imagePromptZh: `${blockZh}\n${removeEnvironmentBlock(shot.imagePromptZh)}`,
      imagePromptEn: `${blockEn}\n${removeEnvironmentBlock(shot.imagePromptEn)}`,
      videoPromptZh: `${blockZh}\n${removeEnvironmentBlock(shot.videoPromptZh)}`,
      videoPromptEn: `${blockEn}\n${removeEnvironmentBlock(shot.videoPromptEn)}`,
      negativePrompt: Array.from(new Set(`${shot.negativePrompt}, ${environment.negativePrompt}`.split(",").map((item) => item.trim()).filter(Boolean))).join(", "),
      continuityRules: `${shot.continuityRules}\nEnvironment: ${environment.consistencyNotes}`,
      stale: true,
      updatedAt: timestamp,
    };
  });
}

export function createTransitions(project: Project, shots: Shot[]) {
  const timestamp = nowIso();
  const approved = shots
    .filter((shot) => shot.approved && shot.approvedImageAssetId)
    .toSorted((a, b) => a.order - b.order);

  return approved.slice(0, -1).map((fromShot, index) => {
    const toShot = approved[index + 1];
    return {
      id: `transition-${project.id}-${fromShot.id}-to-${toShot.id}`,
      projectId: project.id,
      fromShotId: fromShot.id,
      toShotId: toShot.id,
      fromImageAssetId: fromShot.approvedImageAssetId ?? "",
      toImageAssetId: toShot.approvedImageAssetId ?? "",
      transitionPromptZh: [
        `從 ${fromShot.titleZh} 過渡到 ${toShot.titleZh}。`,
        `起點畫面：${fromShot.plotZh}`,
        `終點畫面：${toShot.plotZh}`,
        "鏡頭運動要平順，主體動作方向清楚，情緒自然轉換。",
        "背景邏輯保持一致，不要字幕，不要對話，保持角色身份與服裝。",
      ].join(" "),
      transitionPromptEn: [
        `Transition from ${fromShot.titleEn} to ${toShot.titleEn}.`,
        `From shot visual description: ${fromShot.plotEn}`,
        `To shot visual description: ${toShot.plotEn}`,
        "Use smooth camera motion, clear subject movement, and a natural emotional transition.",
        "Maintain background continuity. No subtitles. No dialogue unless specified. Keep character identity and clothing consistent.",
      ].join(" "),
      cameraMotion: "soft match cut with slow push and drift",
      motionDescription: "Blend the first image into the next shot while preserving environment logic.",
      durationSeconds: 4,
      videoModel: project.defaultVideoModel || "local_mock_video",
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Transition;
  });
}

export function generateMockTransitionVideo(project: Project, transition: Transition, assets: Asset[]) {
  const version = nextAssetVersion(assets, transition.id, "generated_video");
  const slug = slugifyProjectName(project.name);
  const filename = `${slug}_${transition.id}_transition_v${version}.mp4`;
  const timestamp = nowIso();
  const asset = {
    id: `asset-${transition.id}-video-v${version}`,
    projectId: project.id,
    type: "generated_video",
    url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ transitionId: transition.id, version, model: transition.videoModel }, null, 2))}`,
    localPath: `storage/assets/${project.id}/${filename}`,
    filename,
    version,
    provider: "mock",
    model: transition.videoModel,
    promptSnapshot: transition.transitionPromptEn,
    cost: 0,
    status: "generated",
    createdAt: timestamp,
  } satisfies Asset;
  const job = createSuccessJob({
    projectId: project.id,
    type: "transition",
    provider: "mock",
    model: transition.videoModel,
    mode: "transition-video",
    inputPayload: {
      transitionPromptEn: transition.transitionPromptEn,
      fromImageAssetId: transition.fromImageAssetId,
      toImageAssetId: transition.toImageAssetId,
    },
    inputAssets: [transition.fromImageAssetId, transition.toImageAssetId],
    outputAssetId: asset.id,
  });
  return { asset, job };
}

export function buildTimeline(projectId: string, shots: Shot[], transitions: Transition[]) {
  const timestamp = nowIso();
  const videoItems = shots
    .filter((shot) => shot.approvedVideoAssetId)
    .toSorted((a, b) => a.order - b.order)
    .map((shot, index) => ({
      id: `timeline-item-video-${shot.id}`,
      assetId: shot.approvedVideoAssetId ?? "",
      startTime: index * 4,
      endTime: index * 4 + 4,
      shotId: shot.id,
    }));
  const transitionItems = transitions
    .filter((transition) => transition.approvedVideoAssetId)
    .map((transition, index) => ({
      id: `timeline-item-transition-${transition.id}`,
      assetId: transition.approvedVideoAssetId ?? "",
      startTime: index * 4 + 3.2,
      endTime: index * 4 + 4.2,
      transitionId: transition.id,
    }));
  const durationSeconds = Math.max(0, ...videoItems.map((item) => item.endTime), ...transitionItems.map((item) => item.endTime));
  return {
    id: `timeline-${projectId}`,
    projectId,
    durationSeconds,
    exportStatus: "draft",
    tracks: [
      { id: "track-video", type: "video", items: videoItems },
      { id: "track-transition", type: "video", items: transitionItems },
      { id: "track-audio", type: "audio", items: [] },
      { id: "track-subtitle", type: "subtitle", items: [] },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies Timeline;
}

export function syncGalleryFromAssets(projectId: string, assets: Asset[], existing: GalleryItem[]) {
  const existingAssetIds = new Set(existing.map((item) => item.assetId));
  const timestamp = nowIso();
  const created = assets
    .filter((asset) => asset.projectId === projectId && !existingAssetIds.has(asset.id))
    .map((asset) => ({
      id: `gallery-${asset.id}`,
      projectId,
      assetId: asset.id,
      type: asset.type === "generated_video" ? "video" : asset.type === "generated_image" ? "image" : asset.type === "reference_image" ? "reference" : "export",
      tags: [asset.model, asset.status],
      favorite: asset.status === "approved",
      usageCount: 0,
      linkedShotIds: asset.shotId ? [asset.shotId] : [],
      createdAt: timestamp,
    } satisfies GalleryItem));
  return [...existing, ...created];
}

export function evaluateImageCandidates(assets: Asset[]) {
  return assets.map((asset) => {
    const seed = asset.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const metric = (offset: number) => 65 + ((seed + offset) % 30);
    const scores = {
      character_consistency: metric(3),
      environment_consistency: metric(7),
      prompt_alignment: metric(11),
      composition_quality: metric(17),
      generation_artifacts: 100 - metric(23),
    };
    const total =
      scores.character_consistency +
      scores.environment_consistency +
      scores.prompt_alignment +
      scores.composition_quality -
      scores.generation_artifacts * 0.4;
    return { assetId: asset.id, scores, total: Math.round(total) };
  }).toSorted((a, b) => b.total - a.total);
}

export function defaultVideoSettings(model: string, aspectRatio: "9:16" | "16:9"): VideoSettings {
  return {
    mode: "image-to-video",
    model,
    duration: 4,
    aspectRatio,
    resolution: "720p",
    fps: 24,
    outputFormat: "mp4",
    audioMode: "none",
  };
}
