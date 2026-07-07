import { NextResponse } from "next/server";

import { nowIso, updateDb } from "@/lib/local-db";
import { generateScripts } from "@/lib/script-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const timestamp = nowIso();
    let scripts = null;

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");
      const approvedSegments = db.segments
        .filter((segment) => segment.projectId === projectId && segment.approved)
        .toSorted((a, b) => a.order - b.order);
      if (!approvedSegments.length) throw new Error("請先確認劇情片段。");
      const seoPackage = db.seoPackages.find((item) => item.projectId === projectId && item.approved) ?? null;
      if (!seoPackage) throw new Error("請先確認 SEO 包裝。");
      scripts = generateScripts(project, approvedSegments, seoPackage);
      db.scripts = [
        ...db.scripts.filter((script) => script.projectId !== projectId),
        ...scripts,
      ];
      db.projects = db.projects.map((item) =>
        item.id === projectId ? { ...item, updatedAt: timestamp } : item,
      );
    });

    return NextResponse.json({ scripts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成正式劇本失敗" },
      { status: 400 },
    );
  }
}
