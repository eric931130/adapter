import { NextResponse } from "next/server";
import { z } from "zod";

import { updateDb } from "@/lib/local-db";
import { providerSettingSchema, type ProviderSetting } from "@/lib/schemas";
import { errorResponse } from "@/lib/studio-errors";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), settings: z.array(providerSettingSchema) }),
  z.object({ action: z.literal("test"), provider: z.string() }),
]);

function maskKey(value?: string) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function GET() {
  let settings: ProviderSetting[] = [];
  await updateDb((db) => {
    settings = db.providerSettings.map((setting) => ({ ...setting, maskedKey: maskKey(setting.maskedKey) }));
  });
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    if (input.action === "test") {
      return NextResponse.json({
        provider: input.provider,
        status: "success",
        message: "Mock connection passed. 真實連線之後接 provider adapter。",
      });
    }

    await updateDb((db) => {
      db.providerSettings = input.settings.map((setting) => ({
        ...setting,
        maskedKey: maskKey(setting.maskedKey),
        updatedAt: new Date().toISOString(),
      }));
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json(errorResponse(error), { status: 400 });
  }
}
