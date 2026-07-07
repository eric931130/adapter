import type { ReactNode } from "react";

import { readDb } from "@/lib/local-db";

export const dynamicParams = false;

export async function generateStaticParams() {
  const db = await readDb();
  return db.projects.map((project) => ({ projectId: project.id }));
}

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return children;
}
