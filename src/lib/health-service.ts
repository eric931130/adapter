import { getDbProjectBundle } from "@/lib/local-db";
import { modelCapabilities } from "@/lib/model-capabilities";

export type HealthCheckResult = {
  healthScore: number;
  errors: string[];
  warnings: string[];
  suggestions: string[];
};

export async function runProjectHealthCheck(projectId: string): Promise<HealthCheckResult> {
  const bundle = await getDbProjectBundle(projectId);
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!bundle.project) errors.push("project 不存在。");
  if (!bundle.sourceDocuments.length) warnings.push("尚未建立 source document。");
  if (!bundle.segments.length || bundle.segments.some((segment) => !segment.approved)) {
    errors.push("segments 尚未全部 approved。");
  }
  if (!bundle.scripts.length || bundle.scripts.some((script) => !script.approved)) {
    errors.push("scripts 尚未全部 approved。");
  }
  if (!bundle.shots.length || bundle.shots.some((shot) => !shot.approved)) {
    errors.push("shots 尚未全部 approved。");
  }

  const characterNames = new Set(
    bundle.characters.flatMap((character) => [character.id, character.nameZh, character.nameEn].filter(Boolean)),
  );
  const imageModelIds = new Set(modelCapabilities.imageModels.map((model) => model.id));
  const videoModelIds = new Set(modelCapabilities.videoModels.map((model) => model.id));

  for (const shot of bundle.shots) {
    if (!shot.imagePromptEn || !shot.imagePromptZh) errors.push(`${shot.id} 缺少 imagePrompt。`);
    if (!shot.videoPromptEn || !shot.videoPromptZh) errors.push(`${shot.id} 缺少 videoPrompt。`);
    if (!shot.characters.length) warnings.push(`${shot.id} 缺少 characters。`);
    for (const name of shot.characters) {
      if (!characterNames.has(name)) warnings.push(`${shot.id} 的角色 ${name} 尚未建立 Character Bible。`);
    }
    const imageModel = modelCapabilities.imageModels.find((model) => model.id === shot.imageModel);
    const videoModel = modelCapabilities.videoModels.find((model) => model.id === shot.videoModel);
    if (!imageModelIds.has(shot.imageModel)) errors.push(`${shot.id} 的 imageModel 不存在。`);
    if (!videoModelIds.has(shot.videoModel)) errors.push(`${shot.id} 的 videoModel 不存在。`);
    if (imageModel && !imageModel.aspectRatios.includes(shot.aspectRatio)) {
      errors.push(`${shot.id} 的圖片模型不支援 ${shot.aspectRatio}。`);
    }
    if (videoModel && !videoModel.aspectRatios.includes(shot.aspectRatio)) {
      errors.push(`${shot.id} 的影片模型不支援 ${shot.aspectRatio}。`);
    }
    if (shot.approvedImageAssetId && !bundle.assets.some((asset) => asset.id === shot.approvedImageAssetId)) {
      errors.push(`${shot.id} 的 approved image asset 不存在。`);
    }
    if (shot.approvedVideoAssetId && !bundle.assets.some((asset) => asset.id === shot.approvedVideoAssetId)) {
      errors.push(`${shot.id} 的 approved video asset 不存在。`);
    }
    if (!shot.approvedImageAssetId) warnings.push(`${shot.id} 尚未選擇 approved image。`);
    if (!shot.approvedVideoAssetId) warnings.push(`${shot.id} 尚未選擇 approved video。`);
  }

  for (const character of bundle.characters) {
    const refs = bundle.assets.filter((asset) => asset.characterId === character.id && asset.type === "reference_image");
    if (!refs.length) warnings.push(`${character.nameZh || character.nameEn} 缺少 reference image。`);
    if (character.lockedReferenceAssetId && !refs.some((asset) => asset.id === character.lockedReferenceAssetId)) {
      errors.push(`${character.nameZh || character.nameEn} locked reference asset 不存在。`);
    }
  }

  const failedJobs = bundle.generationJobs.filter((job) => job.status === "failed");
  if (failedJobs.length) warnings.push(`目前有 ${failedJobs.length} 個 failed jobs。`);

  const actualCost = bundle.generationJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
  if (bundle.project.costLimit && actualCost > bundle.project.costLimit) {
    errors.push(`成本 $${actualCost.toFixed(2)} 已超過 costLimit $${bundle.project.costLimit.toFixed(2)}。`);
  }

  if (!bundle.characters.length) suggestions.push("先從 shots 自動偵測角色，建立 Character Bible。");
  if (!bundle.assets.some((asset) => asset.type === "generated_image")) suggestions.push("前往圖片工作台批次生成 approved shots。");
  if (!bundle.assets.some((asset) => asset.type === "generated_video")) suggestions.push("前往影片工作台使用 approved images 生成影片。");
  if (bundle.project.status !== "completed") suggestions.push("完成影片與匯出後可將專案標記為 completed。");

  const penalty = errors.length * 12 + warnings.length * 5;
  return {
    healthScore: Math.max(0, Math.min(100, 100 - penalty)),
    errors,
    warnings,
    suggestions,
  };
}
