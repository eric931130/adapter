import { CharacterBibleWorkbench } from "@/components/studio/character-bible-workbench";
import {
  EnvironmentBibleWorkbench,
  GalleryWorkbench,
  LogsDashboardWorkbench,
  PresetsWorkbench,
  TimelineEditorWorkbench,
  TransitionsWorkbench,
} from "@/components/studio/advanced-workbenches";
import { ExportsWorkbench } from "@/components/studio/exports-workbench";
import { ImageGenerationWorkbench } from "@/components/studio/image-generation-workbench";
import { JobsCenterWorkbench } from "@/components/studio/jobs-center-workbench";
import { ScriptWorkbench } from "@/components/studio/script-workbench";
import { SeoWorkbench } from "@/components/studio/seo-workbench";
import { ShotsWorkbench } from "@/components/studio/shots-workbench";
import { TextWorkbench } from "@/components/studio/text-workbench";
import { VideoGenerationWorkbench } from "@/components/studio/video-generation-workbench";

export type StageKey =
  | "presets"
  | "text"
  | "seo"
  | "script"
  | "shots"
  | "characters"
  | "environments"
  | "images"
  | "videos"
  | "transitions"
  | "timeline"
  | "gallery"
  | "logs"
  | "exports"
  | "jobs";

export async function ProjectStagePage({
  projectId,
  stage,
}: {
  projectId: string;
  stage: StageKey;
}) {
  if (stage === "presets") return <PresetsWorkbench projectId={projectId} />;
  if (stage === "text") return <TextWorkbench projectId={projectId} />;
  if (stage === "seo") return <SeoWorkbench projectId={projectId} />;
  if (stage === "script") return <ScriptWorkbench projectId={projectId} />;
  if (stage === "shots") return <ShotsWorkbench projectId={projectId} />;
  if (stage === "characters") return <CharacterBibleWorkbench projectId={projectId} />;
  if (stage === "environments") return <EnvironmentBibleWorkbench projectId={projectId} />;
  if (stage === "images") return <ImageGenerationWorkbench projectId={projectId} />;
  if (stage === "videos") return <VideoGenerationWorkbench projectId={projectId} />;
  if (stage === "transitions") return <TransitionsWorkbench projectId={projectId} />;
  if (stage === "timeline") return <TimelineEditorWorkbench projectId={projectId} />;
  if (stage === "gallery") return <GalleryWorkbench projectId={projectId} />;
  if (stage === "logs") return <LogsDashboardWorkbench projectId={projectId} />;
  if (stage === "exports") return <ExportsWorkbench projectId={projectId} />;
  return <JobsCenterWorkbench projectId={projectId} />;
}
