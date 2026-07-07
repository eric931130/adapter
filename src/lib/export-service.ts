import type { Asset, GenerationJob, Project } from "@/lib/schemas";
import { slugifyProjectName } from "@/lib/local-db";

export function timestampForFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function exportFilename(project: Project, exportType: string, extension: string) {
  return `${slugifyProjectName(project.name)}_${exportType}_${timestampForFilename()}.${extension}`;
}

export function costReportRows(jobs: GenerationJob[]) {
  return jobs.map((job) => ({
    job_id: job.id,
    project_id: job.projectId,
    shot_id: job.shotId ?? "",
    type: job.type,
    provider: job.provider,
    model: job.model,
    mode: job.mode,
    status: job.status,
    estimated_cost: job.estimatedCost,
    actual_cost: job.actualCost ?? "",
    retry_count: job.retryCount,
    created_at: job.createdAt,
    completed_at: job.completedAt ?? "",
    error_message: job.errorMessage ?? "",
  }));
}

export function costSummary(jobs: GenerationJob[]) {
  const successJobs = jobs.filter((job) => job.status === "success");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const imageJobs = jobs.filter((job) => job.type === "image");
  const videoJobs = jobs.filter((job) => job.type === "video");
  const imageCost = imageJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
  const videoCost = videoJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
  const totalCost = jobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);

  return {
    totalJobs: jobs.length,
    successJobs: successJobs.length,
    failedJobs: failedJobs.length,
    imageCost,
    videoCost,
    totalCost,
    averageImageCost: imageJobs.length ? imageCost / imageJobs.length : 0,
    averageVideoCost: videoJobs.length ? videoCost / videoJobs.length : 0,
  };
}

export function projectAssetSummary(assets: Asset[]) {
  return {
    approvedImages: assets.filter((asset) => asset.type === "generated_image" && asset.status === "approved").length,
    allImageVersions: assets.filter((asset) => asset.type === "generated_image").length,
    approvedVideos: assets.filter((asset) => asset.type === "generated_video" && asset.status === "approved").length,
    allVideoVersions: assets.filter((asset) => asset.type === "generated_video").length,
    referenceImages: assets.filter((asset) => asset.type === "reference_image").length,
  };
}
