import type { ReactNode } from "react";

// Projects are created at runtime and stored in Firestore, so project routes
// must render on demand rather than being pre-generated at build time.
export const dynamic = "force-dynamic";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return children;
}
