import { ProjectOverview } from "@/components/studio/project-overview";
import { getDbProjectBundle } from "@/lib/local-db";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectOverview bundle={await getDbProjectBundle(projectId)} />;
}
