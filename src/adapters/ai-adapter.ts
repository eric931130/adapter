import type { GenerationJob, Shot } from "@/lib/schemas";

export interface GenerationAdapter {
  provider: string;
  enqueue(job: GenerationJob): Promise<GenerationJob>;
  generateImage(shot: Shot): Promise<GenerationJob>;
  generateVideo(shot: Shot, inputAssetId?: string): Promise<GenerationJob>;
}

function timestamp() {
  return new Date().toISOString();
}

export const mockGenerationAdapter: GenerationAdapter = {
  provider: "mock",
  async enqueue(job) {
    return {
      ...job,
      status: "queued",
      createdAt: job.createdAt || timestamp(),
    };
  },
  async generateImage(shot) {
    return {
      id: `job-image-${shot.id}-${Date.now()}`,
      projectId: shot.projectId,
      shotId: shot.id,
      type: "image",
      provider: "mock",
      model: shot.imageModel,
      mode: "image",
      status: "queued",
      inputPayload: {
        prompt: shot.imagePromptEn,
        negativePrompt: shot.negativePrompt,
        continuityRules: shot.continuityRules,
        aspectRatio: shot.aspectRatio,
      },
      inputAssets: [],
      estimatedCost: 0,
      retryCount: 0,
      createdAt: timestamp(),
    };
  },
  async generateVideo(shot, inputAssetId) {
    return {
      id: `job-video-${shot.id}-${Date.now()}`,
      projectId: shot.projectId,
      shotId: shot.id,
      type: "video",
      provider: "mock",
      model: shot.videoModel,
      mode: inputAssetId ? "image_to_video" : "text_to_video",
      status: "queued",
      inputPayload: {
        prompt: shot.videoPromptEn,
        imageAssetId: inputAssetId,
        movement: shot.movement,
        camera: shot.camera,
      },
      inputAssets: inputAssetId ? [inputAssetId] : [],
      estimatedCost: 0,
      retryCount: 0,
      createdAt: timestamp(),
    };
  },
};
