import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";
import { seoPackageSchema } from "@/lib/schemas";

const seoInputSchema = z.object({
  seoPackage: seoPackageSchema,
  approve: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = seoInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const seoPackage = {
      ...input.seoPackage,
      projectId,
      approved: input.approve ? true : input.seoPackage.approved,
      updatedAt: timestamp,
    };
    await updateDb((db) => {
      db.seoPackages = [
        ...db.seoPackages.filter((item) => item.projectId !== projectId),
        seoPackage,
      ];
      db.projects = db.projects.map((project) =>
        project.id === projectId ? { ...project, status: "text_ready", updatedAt: timestamp } : project,
      );
    });
    return NextResponse.json({ seoPackage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存 SEO 包裝失敗" },
      { status: 400 },
    );
  }
}
