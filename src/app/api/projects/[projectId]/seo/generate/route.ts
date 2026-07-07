import { NextResponse } from "next/server";

import { generateSeoPackage } from "@/lib/seo-service";
import { nowIso, updateDb } from "@/lib/local-db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const timestamp = nowIso();
    let seoPackage = null;

    await updateDb((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("找不到專案");
      const approvedSegments = db.segments
        .filter((segment) => segment.projectId === projectId && segment.approved)
        .toSorted((a, b) => a.order - b.order);
      if (!approvedSegments.length) {
        throw new Error("沒有 approved segments，請先回文本工作台確認片段。");
      }
      seoPackage = generateSeoPackage(project, approvedSegments);
      db.seoPackages = [
        ...db.seoPackages.filter((item) => item.projectId !== projectId),
        seoPackage,
      ];
      db.projects = db.projects.map((item) =>
        item.id === projectId && item.status === "draft"
          ? { ...item, status: "text_ready", updatedAt: timestamp }
          : item.id === projectId
            ? { ...item, updatedAt: timestamp }
            : item,
      );
    });

    return NextResponse.json({ seoPackage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成 SEO 包裝失敗" },
      { status: 400 },
    );
  }
}
