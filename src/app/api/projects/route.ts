import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, readDb, slugifyProjectName, updateDb } from "@/lib/local-db";

const createProjectSchema = z.object({
  name: z.string().min(1, "請輸入專案名稱"),
  description: z.string().optional(),
  type: z.enum(["shorts", "youtube_long", "story", "ad", "course"]).default("shorts"),
  defaultAspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  defaultLanguage: z.enum(["zh", "en", "bilingual"]).default("zh"),
  defaultStyle: z.string().default("cinematic story, clean character continuity"),
  defaultSegmentCount: z.number().int().min(1).max(20).default(5),
  defaultImageModel: z.string().default("mock-image-cinematic-v1"),
  defaultVideoModel: z.string().default("mock-image-to-video-v1"),
  costLimit: z.number().min(0).default(80),
});

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ projects: db.projects });
}

export async function POST(request: Request) {
  try {
    const input = createProjectSchema.parse(await request.json());
    const timestamp = nowIso();
    const slug = slugifyProjectName(input.name);
    const id = `project-${slug}-${Date.now()}`;
    await updateDb((db) => {
      db.projects.unshift({
        id,
        name: input.name,
        description: input.description ?? "",
        type: input.type,
        defaultAspectRatio: input.defaultAspectRatio,
        defaultLanguage: input.defaultLanguage,
        defaultStyle: input.defaultStyle,
        defaultSegmentCount: input.defaultSegmentCount,
        defaultImageModel: input.defaultImageModel,
        defaultVideoModel: input.defaultVideoModel,
        costLimit: input.costLimit,
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    return NextResponse.json({ projectId: id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "建立專案失敗" },
      { status: 400 },
    );
  }
}
