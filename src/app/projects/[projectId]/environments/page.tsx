import { ProjectStagePage } from "@/components/studio/project-stage-page";

export default async function EnvironmentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectStagePage projectId={projectId} stage="environments" />;
}
