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
  shots: Shot[];
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

// `Shot` type is re-exported via mock-data; declare it here for the LocalDb shape.
type Shot = (typeof shots)[number];

/**
 * Backend selection.
 *
 * - On Firebase App Hosting / Cloud Run the container filesystem is ephemeral
 *   and per-instance, so a JSON file on disk cannot persist writes. We use
 *   Firestore there (Cloud Run always sets `K_SERVICE`).
 * - Locally (dev / `next build`) we fall back to a JSON file so the app works
 *   without cloud credentials.
 *
 * Set `USE_FIRESTORE=true` (or `false`) to override the auto-detection.
 */
const firestoreEnabled = (() => {
  const override = process.env.USE_FIRESTORE;
  if (override === "true") return true;
  if (override === "false") return false;
  return Boolean(process.env.K_SERVICE);
})();

const dbPath = path.join(process.cwd(), "data", "local-db.json");
const FS_COLLECTION = "studio";
const FS_DOCUMENT = "db";

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

/** Merge a partial (possibly older) db payload with the current seed defaults. */
function normalize(db: Partial<LocalDb>): LocalDb {
  const seed = seedDb();
  return {
    ...seed,
    ...db,
    projects: db.projects ?? seed.projects,
    sourceDocuments: db.sourceDocuments ?? seed.sourceDocuments,
    segments: db.segments ?? seed.segments,
    scripts: db.scripts ?? seed.scripts,
    shots: db.shots ?? seed.shots,
    characters: db.characters ?? seed.characters,
    assets: db.assets ?? seed.assets,
    generationJobs: db.generationJobs ?? seed.generationJobs,
    textSettings: db.textSettings ?? {},
    storyAnalyses: db.storyAnalyses ?? [],
    seoPackages: db.seoPackages ?? [],
    presets: db.presets?.length ? db.presets : builtInPresets(),
    environments: db.environments ?? [],
    galleryItems: db.galleryItems ?? [],
    transitions: db.transitions ?? [],
    timelines: db.timelines ?? [],
    studioLogs: db.studioLogs ?? [],
    providerSettings: db.providerSettings?.length
      ? db.providerSettings
      : defaultProviderSettings(),
  };
}

// ---------------------------------------------------------------------------
// Firestore backend
//
// The whole database is stored as a single JSON string inside one document
// (`studio/db`). Every access reads/writes the full document, matching the
// existing read-modify-write access pattern, and JSON serialization avoids
// Firestore's restrictions on `undefined` values and nested arrays.
// ---------------------------------------------------------------------------

type Firestore = import("firebase-admin/firestore").Firestore;

let firestorePromise: Promise<Firestore> | null = null;

async function getFirestoreDb(): Promise<Firestore> {
  if (!firestorePromise) {
    firestorePromise = (async () => {
      const { getApps, initializeApp } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      if (!getApps().length) {
        // On App Hosting/Cloud Run this uses Application Default Credentials
        // and reads the project id from the injected FIREBASE_CONFIG env var.
        initializeApp();
      }
      return getFirestore();
    })();
  }
  return firestorePromise;
}

function dbRef(fs: Firestore) {
  return fs.collection(FS_COLLECTION).doc(FS_DOCUMENT);
}

function serialize(db: LocalDb) {
  return { json: JSON.stringify(db), updatedAt: new Date().toISOString() };
}

function deserialize(raw: unknown): LocalDb {
  if (typeof raw === "string" && raw.length) {
    return normalize(JSON.parse(raw) as Partial<LocalDb>);
  }
  return seedDb();
}

async function readFirestore(): Promise<LocalDb> {
  const fs = await getFirestoreDb();
  const snapshot = await dbRef(fs).get();
  if (!snapshot.exists) {
    const seed = seedDb();
    await dbRef(fs).set(serialize(seed));
    return seed;
  }
  return deserialize(snapshot.get("json"));
}

async function writeFirestore(db: LocalDb) {
  const fs = await getFirestoreDb();
  await dbRef(fs).set(serialize(db));
}

async function updateFirestore(
  mutator: (db: LocalDb) => void | Promise<void>,
): Promise<LocalDb> {
  const fs = await getFirestoreDb();
  const ref = dbRef(fs);
  let result: LocalDb = seedDb();
  await fs.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const db = snapshot.exists ? deserialize(snapshot.get("json")) : seedDb();
    await mutator(db);
    tx.set(ref, serialize(db));
    result = db;
  });
  return result;
}

// ---------------------------------------------------------------------------
// JSON file backend (local dev / build)
// ---------------------------------------------------------------------------

async function ensureFileDb() {
  await mkdir(path.dirname(dbPath), { recursive: true });
  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(dbPath, JSON.stringify(seedDb(), null, 2), "utf8");
  }
}

async function readFileDb(): Promise<LocalDb> {
  await ensureFileDb();
  const raw = await readFile(dbPath, "utf8");
  return normalize(JSON.parse(raw) as Partial<LocalDb>);
}

async function writeFileDb(db: LocalDb) {
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Public API (backend-agnostic)
// ---------------------------------------------------------------------------

export async function readDb(): Promise<LocalDb> {
  return firestoreEnabled ? readFirestore() : readFileDb();
}

export async function writeDb(db: LocalDb) {
  return firestoreEnabled ? writeFirestore(db) : writeFileDb(db);
}

export async function updateDb(mutator: (db: LocalDb) => void | Promise<void>) {
  if (firestoreEnabled) {
    return updateFirestore(mutator);
  }
  const db = await readFileDb();
  await mutator(db);
  await writeFileDb(db);
  return db;
}

export async function getDbProjectBundle(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === projectId) ?? db.projects[0];
  return {
    project,
    sourceDocuments: db.sourceDocuments.filter((item) => item.projectId === project?.id),
    segments: db.segments
      .filter((item) => item.projectId === project?.id)
      .toSorted((a, b) => a.order - b.order),
    scripts: db.scripts.filter((item) => item.projectId === project?.id),
    shots: db.shots.filter((item) => item.projectId === project?.id),
    characters: db.characters.filter((item) => item.projectId === project?.id),
    assets: db.assets.filter((item) => item.projectId === project?.id),
    generationJobs: db.generationJobs.filter((item) => item.projectId === project?.id),
    presets: db.presets,
    environments: db.environments.filter((item) => item.projectId === project?.id),
    galleryItems: db.galleryItems.filter((item) => item.projectId === project?.id),
    transitions: db.transitions.filter((item) => item.projectId === project?.id),
    timeline: db.timelines.find((item) => item.projectId === project?.id) ?? null,
    studioLogs: db.studioLogs.filter((item) => !item.projectId || item.projectId === project?.id),
    providerSettings: db.providerSettings,
    storyAnalysis: db.storyAnalyses.find((item) => item.projectId === project?.id) ?? null,
    seoPackage: db.seoPackages.find((item) => item.projectId === project?.id) ?? null,
    textSettings: project ? db.textSettings[project.id] ?? null : null,
  };
}

export function slugifyProjectName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/g, "-")
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
