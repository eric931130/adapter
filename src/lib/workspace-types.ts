import type {
  Asset,
  Character,
  Environment,
  GalleryItem,
  GenerationJob,
  Preset,
  Project,
  ProviderSetting,
  Script,
  Segment,
  SeoPackage,
  Shot,
  SourceDocument,
  StudioLog,
  StoryAnalysisResult,
  TextWorkbenchSettings,
  Timeline,
  Transition,
} from "@/lib/schemas";

export type ProjectWorkspace = {
  project: Project;
  sourceDocuments: SourceDocument[];
  segments: Segment[];
  scripts: Script[];
  shots: Shot[];
  characters: Character[];
  assets: Asset[];
  generationJobs: GenerationJob[];
  presets: Preset[];
  environments: Environment[];
  galleryItems: GalleryItem[];
  transitions: Transition[];
  timeline: Timeline | null;
  studioLogs: StudioLog[];
  providerSettings: ProviderSetting[];
  storyAnalysis: (StoryAnalysisResult & { projectId: string; updatedAt: string }) | null;
  seoPackage: SeoPackage | null;
  textSettings: TextWorkbenchSettings | null;
};
