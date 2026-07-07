import { NextResponse } from "next/server";

import { nowIso, updateDb } from "@/lib/local-db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const timestamp = nowIso();
    let approvedCount = 0;

    await updateDb((db) => {
      const projectSegments = db.segments.filter((segment) => segment.projectId === projectId);
      if (!projectSegments.length) {
        throw new Error("尚未產生劇情片段，不能確認。");
      }
      db.segments = db.segments.map((segment) =>
        segment.projectId === projectId
          ? { ...segment, approved: true, updatedAt: timestamp }
          : segment,
      );
      approvedCount = projectSegments.length;
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, status: "text_ready", updatedAt: timestamp } : project,
      );
    });

    return NextResponse.json({ approvedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "確認片段失敗" },
      { status: 400 },
    );
  }
}
