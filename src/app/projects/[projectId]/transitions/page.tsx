import { ProjectStagePage } from "@/components/studio/project-stage-page";

export default async function TransitionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectStagePage projectId={projectId} stage="transitions" />;
}
