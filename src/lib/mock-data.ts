import type {
  Asset,
  Character,
  GenerationJob,
  Project,
  Script,
  Segment,
  Shot,
  SourceDocument,
} from "@/lib/schemas";

// The studio ships with no seeded projects — users create their own. These
// empty collections are the initial state for a fresh database (see
// `seedDb()` in local-db.ts).

export const projects: Project[] = [];
export const sourceDocuments: SourceDocument[] = [];
export const segments: Segment[] = [];
export const scripts: Script[] = [];
export const shots: Shot[] = [];
export const characters: Character[] = [];
export const assets: Asset[] = [];
export const generationJobs: GenerationJob[] = [];
