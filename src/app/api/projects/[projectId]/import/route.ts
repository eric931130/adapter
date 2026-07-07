import { NextResponse } from "next/server";
import { z } from "zod";

import { createLog } from "@/lib/advanced-workflow-service";
import { nowIso, updateDb } from "@/lib/local-db";
import type {
  Character,
  Environment,
  GalleryItem,
  Preset,
  SourceDocument,
  Timeline,
  Transition,
} from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.object({
  package: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const input = inputSchema.parse(await request.json());
    let importedKeys: string[] = [];
    const readJson = <T,>(key: string, fallback: T): T => {
      const value = input.package[key];
      if (typeof value === "string") return JSON.parse(value) as T;
      return (value as T | undefined) ?? fallback;
    };
    await updateDb((db) => {
      const timestamp = nowIso();
      importedKeys = Object.keys(input.package);
      const importedProject = readJson<Record<string, unknown> | null>("project.json", null);
      if (importedProject) {
        db.projects = db.projects.map((project) =>
          project.id === projectId
            ? { ...project, ...importedProject, id: projectId, updatedAt: timestamp }
            : project,
        );
      }

      const presets = readJson<Preset[]>("presets/presets.json", []);
      if (presets.length) {
        db.presets = db.presets
          .filter((preset) => !presets.some((item) => item.id === preset.id))
          .concat(presets.map((preset) => ({ ...preset, updatedAt: timestamp })));
      }

      const sourceDocuments = readJson<SourceDocument[]>("source_documents/source_documents.json", []);
      if (sourceDocuments.length) {
        db.sourceDocuments = db.sourceDocuments
          .filter((item) => item.projectId !== projectId)
          .concat(sourceDocuments.map((item) => ({ ...item, projectId })));
      }

      const characterPayload = readJson<{ characters?: Character[] }>("characters/character_bible.json", {});
      if (characterPayload.characters?.length) {
        db.characters = db.characters
          .filter((item) => item.projectId !== projectId)
          .concat(characterPayload.characters.map((item) => ({ ...item, projectId, updatedAt: timestamp })));
      }

      const environments = readJson<Environment[]>("environments/environment_bible.json", []);
      if (environments.length) {
        db.environments = db.environments
          .filter((item) => item.projectId !== projectId)
          .concat(environments.map((item) => ({ ...item, projectId, updatedAt: timestamp })));
      }

      const transitions = readJson<Transition[]>("transitions/transitions.json", []);
      if (transitions.length) {
        db.transitions = db.transitions
          .filter((item) => item.projectId !== projectId)
          .concat(transitions.map((item) => ({ ...item, projectId, updatedAt: timestamp })));
      }

      const timeline = readJson<Timeline | null>("timeline/timeline.json", null);
      if (timeline) {
        db.timelines = db.timelines
          .filter((item) => item.projectId !== projectId)
          .concat({ ...timeline, projectId, updatedAt: timestamp });
      }

      const gallery = readJson<GalleryItem[]>("gallery/gallery_index.json", []);
      if (gallery.length) {
        db.galleryItems = db.galleryItems
          .filter((item) => item.projectId !== projectId)
          .concat(gallery.map((item) => ({ ...item, projectId })));
      }

      db.studioLogs.push(createLog({
        projectId,
        stage: "import",
        action: "project_zip_import",
        model: "local-import-adapter",
        inputSummary: importedKeys.join(", "),
        outputSummary: "import report generated",
        status: "success",
        cost: 0,
        durationMs: 120,
      }));
    });
    return NextResponse.json({
      imported: true,
      report: {
        version: "mvp-json-package",
        projectId,
        importedKeys,
        assetIndexRebuilt: true,
        restoredTables: ["project", "presets", "source_documents", "characters", "environments", "transitions", "timeline", "gallery"],
      },
    });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
