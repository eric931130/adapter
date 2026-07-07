import { NextResponse } from "next/server";
import { z } from "zod";

import { nowIso, updateDb } from "@/lib/local-db";

const sourceDocumentInputSchema = z.object({
  filename: z.string().min(1),
  fileType: z.enum(["txt", "pdf", "docx", "md"]),
  rawText: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const input = sourceDocumentInputSchema.parse(await request.json());
    const timestamp = nowIso();
    const parsedText =
      input.fileType === "txt" || input.fileType === "md"
        ? input.rawText?.trim() ?? ""
        : "完整解析器之後串接；目前僅建立上傳紀錄與 placeholder parsing。";

    if ((input.fileType === "txt" || input.fileType === "md") && !parsedText) {
      return NextResponse.json({ error: "文字檔內容為空，請重新上傳或貼上原稿。" }, { status: 400 });
    }

    const document = {
      id: `source-${projectId}-${Date.now()}`,
      projectId,
      filename: input.filename,
      fileType: input.fileType,
      rawText: input.rawText ?? "",
      parsedText,
      status: input.fileType === "txt" || input.fileType === "md" ? "parsed" : "placeholder",
      createdAt: timestamp,
    };

    await updateDb((db) => {
      db.sourceDocuments.unshift(document);
      db.projects = db.projects.map((project) =>
        project.id === projectId
          ? { ...project, status: "draft", updatedAt: timestamp }
          : project,
      );
    });

    return NextResponse.json({ sourceDocument: document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存原稿失敗" },
      { status: 400 },
    );
  }
}
