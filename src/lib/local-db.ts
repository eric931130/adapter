import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assets,
  characters,
  generationJobs,
  projects,
  scripts,
  segments,
  shots,
  sourceDocuments,
} from "@/lib/mock-data";
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
  SourceDocument,
  StudioLog,
  StoryAnalysisResult,
  TextWorkbenchSettings,
  Timeline,
  Transition,
} from "@/lib/schemas";

export type LocalDb = {
  projects: Project[];
  sourceDocuments: SourceDocument[];
  segments: Segment[];
  scripts: Script[];
  shots: typeof shots;
  characters: Character[];
  assets: Asset[];
  generationJobs: GenerationJob[];
  presets: Preset[];
  environments: Environment[];
  galleryItems: GalleryItem[];
  transitions: Transition[];
  timelines: Timeline[];
  studioLogs: StudioLog[];
  providerSettings: ProviderSetting[];
  storyAnalyses: Array<StoryAnalysisResult & { projectId: string; updatedAt: string }>;
  seoPackages: SeoPackage[];
  textSettings: Record<string, TextWorkbenchSettings>;
};

const dbPath = path.join(process.cwd(), "data", "local-db.json");

function seedDb(): LocalDb {
  return {
    projects,
    sourceDocuments,
    segments,
    scripts,
    shots,
    characters,
    assets,
    generationJobs,
    presets: builtInPresets(),
    environments: [],
    galleryItems: [],
    transitions: [],
    timelines: [],
    studioLogs: [],
    providerSettings: defaultProviderSettings(),
    storyAnalyses: [],
    seoPackages: [],
    textSettings: {},
  };
}

async function ensureDb() {
  await mkdir(path.dirname(dbPath), { recursive: true });
  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(dbPath, JSON.stringify(seedDb(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<LocalDb> {
  await ensureDb();
  const raw = await readFile(dbPath, "utf8");
  const db = JSON.parse(raw) as Partial<LocalDb>;
  return {
    ...seedDb(),
    ...db,
    textSettings: db.textSettings ?? {},
    storyAnalyses: db.storyAnalyses ?? [],
    seoPackages: db.seoPackages ?? [],
    presets: db.presets?.length ? db.presets : builtInPresets(),
    environments: db.environments ?? [],
    galleryItems: db.galleryItems ?? [],
    transitions: db.transitions ?? [],
    timelines: db.timelines ?? [],
    studioLogs: db.studioLogs ?? [],
    providerSettings: db.providerSettings?.length ? db.providerSettings : defaultProviderSettings(),
  };
}

export async function writeDb(db: LocalDb) {
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export async function updateDb(mutator: (db: LocalDb) => void | Promise<void>) {
  const db = await readDb();
  await mutator(db);
  await writeDb(db);
  return db;
}

export async function getDbProjectBundle(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === projectId) ?? db.projects[0];
  return {
    project,
    sourceDocuments: db.sourceDocuments.filter((item) => item.projectId === project.id),
    segments: db.segments
      .filter((item) => item.projectId === project.id)
      .toSorted((a, b) => a.order - b.order),
    scripts: db.scripts.filter((item) => item.projectId === project.id),
    shots: db.shots.filter((item) => item.projectId === project.id),
    characters: db.characters.filter((item) => item.projectId === project.id),
    assets: db.assets.filter((item) => item.projectId === project.id),
    generationJobs: db.generationJobs.filter((item) => item.projectId === project.id),
    presets: db.presets,
    environments: db.environments.filter((item) => item.projectId === project.id),
    galleryItems: db.galleryItems.filter((item) => item.projectId === project.id),
    transitions: db.transitions.filter((item) => item.projectId === project.id),
    timeline:
      db.timelines.find((item) => item.projectId === project.id) ?? null,
    studioLogs: db.studioLogs.filter((item) => !item.projectId || item.projectId === project.id),
    providerSettings: db.providerSettings,
    storyAnalysis:
      db.storyAnalyses.find((item) => item.projectId === project.id) ?? null,
    seoPackage:
      db.seoPackages.find((item) => item.projectId === project.id) ?? null,
    textSettings: db.textSettings[project.id] ?? null,
  };
}

export function slugifyProjectName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "story-project"
  );
}

export function nowIso() {
  return new Date().toISOString();
}

function builtInPresets(): Preset[] {
  const timestamp = "2026-07-05T09:00:00.000+08:00";
  return [
    ["children-watercolor", "兒童水彩故事", "story_style", "soft watercolor, warm bedtime story, gentle expressions"],
    ["anime-storyboard", "日系動漫分鏡", "prompt_style", "Japanese anime storyboard, expressive eyes, clean cinematic panels"],
    ["shorts-viral", "YouTube Shorts 爆款敘事", "story_style", "fast hook, emotional contrast, cliffhanger pacing"],
    ["bible-picture-book", "聖經故事童書風", "character_style", "storybook biblical setting, warm robes, respectful gentle tone"],
    ["product-short", "商業產品短影音", "video_style", "clean product hero, benefit-led motion, bright SaaS visuals"],
    ["fantasy-cinematic", "奇幻小說電影感", "prompt_style", "fantasy film realism, atmospheric light, detailed world continuity"],
    ["dreamy-sky-healing", "夢幻淺藍療癒風", "prompt_style", "Dreamy Sky Studio palette, pale blue glass, lavender mist, mint highlights"],
  ].map(([id, name, type, style]) => ({
    id: `preset-${id}`,
    name,
    description: `${name} 內建模板`,
    type: type as Preset["type"],
    settings: {
      defaultStyle: style,
      imageModel: "local_mock_image",
      videoModel: "local_mock_video",
      aspectRatio: "9:16",
      negativePrompt: "text, watermark, extra limbs, wrong outfit, background drift",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function defaultProviderSettings(): ProviderSetting[] {
  const timestamp = "2026-07-05T09:00:00.000+08:00";
  return [
    ["openai", "OpenAI", 1],
    ["google", "Google Gemini", 2],
    ["google", "Google Vertex AI", 3],
    ["xai", "xAI Grok", 4],
    ["local", "Local ComfyUI endpoint", 5],
  ].map(([provider, label, priority], index) => ({
    id: `provider-${index + 1}`,
    provider: provider as ProviderSetting["provider"],
    label: String(label),
    enabled: provider === "local" || provider === "mock",
    maskedKey: "",
    endpoint: provider === "local" ? "http://127.0.0.1:8188" : "",
    priority: Number(priority),
    lastTestStatus: "not_tested",
    updatedAt: timestamp,
  }));
}
