import { z } from "zod";

export const projectTypeSchema = z.enum([
  "shorts",
  "youtube_long",
  "story",
  "ad",
  "course",
]);

export const aspectRatioSchema = z.enum(["9:16", "16:9"]);
export const languageSchema = z.enum(["zh", "en", "bilingual"]);

export const projectStatusSchema = z.enum([
  "draft",
  "text_ready",
  "storyboard_ready",
  "image_ready",
  "video_ready",
  "completed",
]);

export const fileTypeSchema = z.enum(["txt", "pdf", "docx", "md"]);
export const assetTypeSchema = z.enum([
  "source_file",
  "reference_image",
  "generated_image",
  "generated_video",
  "exported_file",
]);

export const assetStatusSchema = z.enum([
  "uploaded",
  "generated",
  "approved",
  "rejected",
  "failed",
  "stale",
  "prompt_outdated",
]);

export const generationJobTypeSchema = z.enum([
  "text_analysis",
  "prompt_generation",
  "image",
  "video",
  "transition",
  "export",
]);

export const providerSchema = z.enum([
  "openai",
  "google",
  "xai",
  "local",
  "mock",
]);

export const generationJobStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "success",
  "failed",
  "expired",
  "cancelled",
]);

export const generationAssetStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "success",
  "failed",
  "approved",
]);

export const presetTypeSchema = z.enum([
  "story_style",
  "prompt_style",
  "character_style",
  "video_style",
  "export_style",
]);

export const galleryItemTypeSchema = z.enum(["image", "video", "reference", "export"]);

export const timelineTrackTypeSchema = z.enum(["video", "audio", "subtitle", "image"]);

export const transitionStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "success",
  "failed",
  "approved",
]);

export const scriptDifficultySchema = z.enum(["low", "medium", "high"]);

export const textWorkbenchSettingsSchema = z.object({
  storyTheme: z.string().min(1, "請輸入故事主題"),
  videoType: z.enum(["youtube_long", "shorts", "children_story", "ad", "course"]),
  targetAudience: z.string().min(1, "請輸入目標觀眾"),
  defaultLanguage: z.enum(["zh_tw", "en", "bilingual"]),
  segmentCount: z.number().int().min(1).max(20),
  defaultStyle: z.string().min(1, "請輸入預設畫風"),
  notes: z.string().optional(),
});

export const storyAnalysisSegmentSchema = z.object({
  order: z.number().int().positive(),
  titleZh: z.string(),
  titleEn: z.string(),
  summaryZh: z.string(),
  summaryEn: z.string(),
  storyPurpose: z.string(),
  emotion: z.string(),
  location: z.string(),
  characters: z.array(z.string()),
  estimatedShots: z.number().int().min(1).max(30),
});

export const storyAnalysisResultSchema = z.object({
  storyTheme: z.string(),
  logline: z.string(),
  mainCharacters: z.array(z.string()),
  conflict: z.string(),
  worldSetting: z.string(),
  emotionalArc: z.string(),
  recommendedSegmentCount: z.number().int().positive(),
  riskWarnings: z.array(z.string()),
  segments: z.array(storyAnalysisSegmentSchema),
});

export const seoPackageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  seoTitleZh: z.string(),
  seoTitleEn: z.string(),
  alternativeTitlesZh: z.array(z.string()),
  alternativeTitlesEn: z.array(z.string()),
  youtubeHookZh: z.string(),
  youtubeHookEn: z.string(),
  shortDescriptionZh: z.string(),
  shortDescriptionEn: z.string(),
  longDescriptionZh: z.string(),
  longDescriptionEn: z.string(),
  keywordsZh: z.array(z.string()),
  keywordsEn: z.array(z.string()),
  targetAudience: z.string(),
  emotionalSellingPoints: z.array(z.string()),
  thumbnailIdeas: z.array(z.string()),
  shortsCutPoints: z.array(z.string()),
  contentWarnings: z.array(z.string()),
  platformSuggestions: z.string(),
  score: z.number().int().min(0).max(100),
  approved: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const segmentOutlineRowSchema = z.object({
  segment_id: z.string(),
  segment_order: z.number(),
  segment_title_zh: z.string(),
  segment_title_en: z.string(),
  story_purpose: z.string(),
  summary_zh: z.string(),
  summary_en: z.string(),
  emotion: z.string(),
  location: z.string(),
  characters: z.string(),
  estimated_shots: z.number(),
  seo_hook: z.string(),
  notes: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: projectTypeSchema,
  defaultAspectRatio: aspectRatioSchema,
  defaultLanguage: languageSchema,
  defaultStyle: z.string(),
  defaultSegmentCount: z.number().int().positive(),
  defaultImageModel: z.string(),
  defaultVideoModel: z.string(),
  costLimit: z.number().nonnegative(),
  status: projectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sourceDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  filename: z.string(),
  fileType: fileTypeSchema,
  rawText: z.string(),
  parsedText: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export const segmentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  order: z.number().int().positive(),
  titleZh: z.string(),
  titleEn: z.string(),
  summaryZh: z.string(),
  summaryEn: z.string(),
  storyPurpose: z.string(),
  emotion: z.string(),
  location: z.string(),
  characters: z.array(z.string()),
  estimatedShots: z.number().int().positive(),
  userShotCount: z.number().int().positive().optional(),
  approved: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const scriptSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  segmentId: z.string(),
  narrationZh: z.string(),
  narrationEn: z.string(),
  characterAction: z.string(),
  emotionalDirection: z.string(),
  visualDirection: z.string(),
  suggestedShotCount: z.number().int().positive(),
  userShotCount: z.number().int().positive().optional(),
  difficulty: scriptDifficultySchema,
  generationRisk: z.string(),
  approved: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shotSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  segmentId: z.string(),
  order: z.number().int().positive(),
  titleZh: z.string(),
  titleEn: z.string(),
  plotZh: z.string(),
  plotEn: z.string(),
  characters: z.array(z.string()),
  location: z.string(),
  timeOfDay: z.string(),
  emotion: z.string(),
  camera: z.string(),
  movement: z.string(),
  imagePromptZh: z.string(),
  imagePromptEn: z.string(),
  videoPromptZh: z.string(),
  videoPromptEn: z.string(),
  negativePrompt: z.string(),
  continuityRules: z.string(),
  aspectRatio: aspectRatioSchema,
  imageModel: z.string(),
  videoModel: z.string(),
  imageStatus: generationAssetStatusSchema,
  videoStatus: generationAssetStatusSchema,
  approved: z.boolean().optional(),
  stale: z.boolean().optional(),
  approvedImageAssetId: z.string().optional(),
  approvedVideoAssetId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const characterSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  nameZh: z.string(),
  nameEn: z.string(),
  gender: z.string(),
  ageRange: z.string(),
  bodyType: z.string(),
  faceFeatures: z.string(),
  hairFeatures: z.string(),
  eyeFeatures: z.string().optional(),
  outfitFeatures: z.string(),
  colorPalette: z.string(),
  personality: z.string(),
  fixedPromptZh: z.string(),
  fixedPromptEn: z.string(),
  negativePrompt: z.string(),
  lockedReferenceAssetId: z.string().optional(),
  consistencyNotes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const assetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  shotId: z.string().optional(),
  characterId: z.string().optional(),
  type: assetTypeSchema,
  url: z.string(),
  localPath: z.string(),
  filename: z.string(),
  version: z.number().int().positive(),
  provider: providerSchema,
  model: z.string(),
  promptSnapshot: z.string(),
  cost: z.number().nonnegative(),
  status: assetStatusSchema,
  createdAt: z.string(),
});

export const presetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: presetTypeSchema,
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const environmentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  nameZh: z.string(),
  nameEn: z.string(),
  descriptionZh: z.string(),
  descriptionEn: z.string(),
  visualStyle: z.string(),
  colorPalette: z.string(),
  lighting: z.string(),
  fixedPromptZh: z.string(),
  fixedPromptEn: z.string(),
  negativePrompt: z.string(),
  referenceAssetIds: z.array(z.string()),
  consistencyNotes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const galleryItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  assetId: z.string(),
  type: galleryItemTypeSchema,
  tags: z.array(z.string()),
  favorite: z.boolean(),
  usageCount: z.number().int().nonnegative(),
  linkedShotIds: z.array(z.string()),
  createdAt: z.string(),
});

export const transitionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  fromShotId: z.string(),
  toShotId: z.string(),
  fromImageAssetId: z.string(),
  toImageAssetId: z.string(),
  transitionPromptZh: z.string(),
  transitionPromptEn: z.string(),
  cameraMotion: z.string(),
  motionDescription: z.string(),
  durationSeconds: z.number().positive(),
  videoModel: z.string(),
  status: transitionStatusSchema,
  approvedVideoAssetId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const timelineItemSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  shotId: z.string().optional(),
  transitionId: z.string().optional(),
});

export const timelineTrackSchema = z.object({
  id: z.string(),
  type: timelineTrackTypeSchema,
  items: z.array(timelineItemSchema),
});

export const timelineSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tracks: z.array(timelineTrackSchema),
  durationSeconds: z.number().nonnegative(),
  exportStatus: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const studioLogSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  time: z.string(),
  stage: z.string(),
  action: z.string(),
  model: z.string().optional(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  status: z.string(),
  error: z.string().optional(),
  cost: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
});

export const providerSettingSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  label: z.string(),
  enabled: z.boolean(),
  maskedKey: z.string(),
  endpoint: z.string().optional(),
  priority: z.number().int().positive(),
  lastTestStatus: z.string().optional(),
  updatedAt: z.string(),
});

export const generationJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  shotId: z.string().optional(),
  type: generationJobTypeSchema,
  provider: providerSchema,
  model: z.string(),
  mode: z.string(),
  status: generationJobStatusSchema,
  inputPayload: z.record(z.string(), z.unknown()),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
  inputAssets: z.array(z.string()),
  outputAssetId: z.string().optional(),
  estimatedCost: z.number().nonnegative(),
  actualCost: z.number().nonnegative().optional(),
  retryCount: z.number().int().nonnegative(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export const modelCapabilitiesSchema = z.object({
  textModels: z.array(
    z.object({
      id: z.string(),
      provider: providerSchema,
      name: z.string(),
      supports: z.array(z.string()),
      costPerRun: z.number(),
    }),
  ),
  imageModels: z.array(
    z.object({
      id: z.string(),
      provider: providerSchema,
      name: z.string().optional(),
      displayName: z.string().optional(),
      type: z.literal("image").optional(),
      modes: z.array(z.string()).optional(),
      aspectRatios: z.array(aspectRatioSchema),
      sizes: z.array(z.string()).optional(),
      qualities: z.array(z.string()).optional(),
      outputFormats: z.array(z.string()).optional(),
      supportsReferenceImages: z.boolean().optional(),
      supportsBatch: z.boolean().optional(),
      maxReferenceImages: z.number().int().nonnegative().optional(),
      maxBatch: z.number().int().positive().optional(),
      costPerImage: z.number().optional(),
      maxOutputsPerPrompt: z.number().int().positive().optional(),
      costEstimate: z.record(z.string(), z.number()).optional(),
      fallbackModelIds: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  ),
  videoModels: z.array(
    z.object({
      id: z.string(),
      provider: providerSchema,
      name: z.string().optional(),
      displayName: z.string().optional(),
      type: z.literal("video").optional(),
      modes: z.array(z.string()),
      durations: z.union([z.array(z.number()), z.object({ min: z.number(), max: z.number() })]),
      aspectRatios: z.array(aspectRatioSchema),
      resolutions: z.array(z.string()).optional(),
      fps: z.array(z.number()).optional(),
      outputFormats: z.array(z.string()).optional(),
      supportsAudio: z.boolean().optional(),
      supportsNativeAudio: z.boolean().optional(),
      supportsImageToVideo: z.boolean().optional(),
      supportsTextToVideo: z.boolean().optional(),
      supportsReferenceImages: z.boolean().optional(),
      supportsFirstLastFrame: z.boolean().optional(),
      supportsVideoExtension: z.boolean().optional(),
      supportsVideoEditing: z.boolean().optional(),
      maxInputImageSizeMB: z.number().optional(),
      maxOutputsPerPrompt: z.number().int().positive().optional(),
      costPerSecond: z.number().optional(),
      costEstimate: z.record(z.string(), z.number()).optional(),
      fallbackModelIds: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  ),
  exportFormats: z.array(z.string()),
});

export const shotPromptRowSchema = z.object({
  shot_id: z.string(),
  segment_id: z.string(),
  shot_order: z.number(),
  shot_title_zh: z.string(),
  shot_title_en: z.string(),
  plot_zh: z.string(),
  plot_en: z.string(),
  characters: z.string(),
  location: z.string(),
  time_of_day: z.string(),
  emotion: z.string(),
  image_prompt_zh: z.string(),
  image_prompt_en: z.string(),
  video_prompt_zh: z.string(),
  video_prompt_en: z.string(),
  negative_prompt: z.string(),
  camera: z.string(),
  movement: z.string(),
  continuity_rules: z.string(),
  aspect_ratio: aspectRatioSchema,
  image_model: z.string(),
  video_model: z.string(),
  status: z.string(),
});

export const appErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  userMessage: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  recoverable: z.boolean(),
  suggestedAction: z.string(),
});

export type Project = z.infer<typeof projectSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Script = z.infer<typeof scriptSchema>;
export type Shot = z.infer<typeof shotSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type GenerationJob = z.infer<typeof generationJobSchema>;
export type Preset = z.infer<typeof presetSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
export type TimelineTrack = z.infer<typeof timelineTrackSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type StudioLog = z.infer<typeof studioLogSchema>;
export type ProviderSetting = z.infer<typeof providerSettingSchema>;
export type ModelCapabilities = z.infer<typeof modelCapabilitiesSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type GenerationJobStatus = z.infer<typeof generationJobStatusSchema>;
export type TextWorkbenchSettings = z.infer<typeof textWorkbenchSettingsSchema>;
export type StoryAnalysisResult = z.infer<typeof storyAnalysisResultSchema>;
export type StoryAnalysisSegment = z.infer<typeof storyAnalysisSegmentSchema>;
export type SeoPackage = z.infer<typeof seoPackageSchema>;
export type SegmentOutlineRow = z.infer<typeof segmentOutlineRowSchema>;
export type ScriptDifficulty = z.infer<typeof scriptDifficultySchema>;
export type ShotPromptRow = z.infer<typeof shotPromptRowSchema>;
export type AppError = z.infer<typeof appErrorSchema>;
