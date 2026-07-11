import { ExternalLinkIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const providers = [
  {
    name: "OpenAI",
    status: "尚未串接",
    models: "文字：GPT-5.5｜圖片：GPT Image 2｜影片：Sora 2 已列為舊版，不再新增",
    applyUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://developers.openai.com/api/docs/models",
  },
  {
    name: "Google Gemini API",
    status: "尚未串接",
    models: "文字：Gemini 3.5 Flash｜圖片：Nano Banana 2｜影片：Gemini Omni Flash / Veo 3.1",
    applyUrl: "https://aistudio.google.com/api-keys",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
  },
  {
    name: "Google Vertex AI",
    status: "尚未串接",
    models: "適合正式環境與 Google Cloud 權限管理；需啟用計費與 Vertex AI API",
    applyUrl: "https://console.cloud.google.com/vertex-ai",
    docsUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart",
  },
  {
    name: "xAI",
    status: "尚未串接",
    models: "文字：Grok 4.3｜影片：Grok Imagine Video / Video 1.5",
    applyUrl: "https://console.x.ai/team/default/api-keys",
    docsUrl: "https://docs.x.ai/developers/models",
  },
] as const;

export function ApiProviderGuide() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-[#e6f3ff] text-[#0078ff]">
            <KeyRoundIcon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-[#0b315e]">API 申請與模型狀態</h1>
            <p className="mt-1 text-sm font-semibold text-[#5f7f9d]">模型名稱已依官方文件更新；目前各家雲端 API 尚未接到生成流程。</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.name} className="border-white/70 bg-white/60">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-[#0b315e]">{provider.name}</CardTitle>
                  <CardDescription className="mt-1 leading-6">{provider.models}</CardDescription>
                </div>
                <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{provider.status}</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <a className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0078ff] px-3 text-sm font-bold text-white hover:bg-[#0066d9]" href={provider.applyUrl} target="_blank" rel="noreferrer">
                申請 API
                <ExternalLinkIcon className="size-4" aria-hidden="true" />
              </a>
              <a className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#9cc4e8] bg-white px-3 text-sm font-bold text-[#0b5ca8] hover:bg-[#eef8ff]" href={provider.docsUrl} target="_blank" rel="noreferrer">
                官方模型文件
                <ExternalLinkIcon className="size-4" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-black">金鑰安全</p>
          <p>請勿把 API 金鑰貼進公開網頁、程式碼或 GitHub。正式串接時會放進 Firebase App Hosting 的伺服器端密鑰，前端只顯示連線狀態。</p>
        </div>
      </section>
    </div>
  );
}
