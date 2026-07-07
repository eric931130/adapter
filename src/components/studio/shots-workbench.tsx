"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  RefreshCcwIcon,
  UploadIcon,
} from "lucide-react";

import { DataTable } from "@/components/studio/data-table";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob, downloadXlsx, parseImportFile, shotRows, toCsv } from "@/lib/export-utils";
import { getImageModelOptions, getVideoModelOptions } from "@/lib/model-capabilities";
import type { ProjectWorkspace } from "@/lib/workspace-types";
import type { Shot } from "@/lib/schemas";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "請求失敗");
  return payload as T;
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "story-project";
}

export function ShotsWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedShotId, setSelectedShotId] = useState("");
  const [bulkNegative, setBulkNegative] = useState("");
  const [bulkContinuity, setBulkContinuity] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadWorkspace() {
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    setShots(bundle.shots.toSorted((a, b) => a.order - b.order));
    setSelectedShotId((current) => current || bundle.shots[0]?.id || "");
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
        setShots(bundle.shots.toSorted((a, b) => a.order - b.order));
        setSelectedShotId((current) => current || bundle.shots[0]?.id || "");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取分鏡失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedShot = shots.find((shot) => shot.id === selectedShotId) ?? shots[0];
  const rows = useMemo(() => shotRows(shots), [shots]);
  const projectSlug = slugify(workspace?.project.name ?? "story-project");
  const allApproved = shots.length > 0 && shots.every((shot) => shot.approved);
  const imageModels = getImageModelOptions();
  const videoModels = getVideoModelOptions();

  function updateShot(shotId: string, patch: Partial<Shot>) {
    setShots((current) =>
      current.map((shot) =>
        shot.id === shotId
          ? { ...shot, ...patch, approved: false, stale: true, updatedAt: new Date().toISOString() }
          : shot,
      ),
    );
  }

  async function generateShots() {
    setIsBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fetchJson<{ shots: Shot[] }>(`/api/projects/${projectId}/shots/generate`, { method: "POST" });
      setShots(result.shots);
      setSelectedShotId(result.shots[0]?.id ?? "");
      setNotice(`已生成 ${result.shots.length} 個分鏡提示詞。`);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成分鏡失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveShots(approve = false) {
    setIsBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ shots: Shot[] }>(`/api/projects/${projectId}/shots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shots, approve }),
      });
      setShots(result.shots);
      setNotice(approve ? "分鏡提示詞已確認，圖片與影片狀態已設為 pending。" : "分鏡已保存。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存分鏡失敗");
    } finally {
      setIsBusy(false);
    }
  }

  function regenerateOne(shotId: string) {
    const stamp = new Date().toLocaleString("zh-TW");
    updateShot(shotId, {
      imagePromptZh: `${selectedShot?.imagePromptZh ?? ""}\n\n[REGENERATED ${stamp}] 強化角色一致性、構圖層次與光線方向。`,
      imagePromptEn: `${selectedShot?.imagePromptEn ?? ""}\n\n[REGENERATED ${stamp}] Strengthen character consistency, composition depth, and lighting direction.`,
      videoPromptZh: `${selectedShot?.videoPromptZh ?? ""}\n\n[REGENERATED ${stamp}] 動作方向更清楚，最後 0.8 秒穩定停住。`,
      videoPromptEn: `${selectedShot?.videoPromptEn ?? ""}\n\n[REGENERATED ${stamp}] Clarify motion direction and hold the final 0.8 seconds steady.`,
    });
    setNotice("已重新生成單一分鏡提示詞草稿，請保存。");
  }

  function applyBulk(patch: Partial<Shot>) {
    setShots((current) =>
      current.map((shot) => ({
        ...shot,
        ...patch,
        negativePrompt: patch.negativePrompt
          ? `${shot.negativePrompt}, ${patch.negativePrompt}`.replace(/^, /, "")
          : shot.negativePrompt,
        continuityRules: patch.continuityRules
          ? `${shot.continuityRules}\n${patch.continuityRules}`
          : shot.continuityRules,
        approved: false,
        stale: true,
        updatedAt: new Date().toISOString(),
      })),
    );
  }

  async function importShots(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const rows = await parseImportFile(file);
      const result = await fetchJson<{ shots: Shot[] }>(`/api/projects/${projectId}/shots/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      setShots(result.shots);
      setNotice("匯入完成，相關舊 asset 已標示為 prompt_outdated。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "匯入失敗");
    }
  }

  function downloadJson() {
    downloadBlob(`${projectSlug}_shots_prompts.json`, JSON.stringify({ shots, rows }, null, 2), "application/json;charset=utf-8");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">分鏡提示詞工作台</h1>
        <p className="mt-2 text-muted-foreground">從已確認劇本產生 Shot，分開管理圖片提示詞與影片提示詞。</p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "storyboard_ready"} current="shots" projectId={projectId} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <CheckIcon aria-hidden="true" />
          <AlertTitle>狀態更新</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Shot List</CardTitle>
            <CardDescription>{shots.length ? `${shots.length} 個分鏡` : "尚未生成分鏡"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {shots.map((shot) => (
              <Button
                key={shot.id}
                type="button"
                variant={shot.id === selectedShot?.id ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => setSelectedShotId(shot.id)}
              >
                #{shot.order} {shot.titleZh}
              </Button>
            ))}
            {!shots.length ? <p className="text-sm text-muted-foreground">請先按「生成全部分鏡」。</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>{selectedShot ? `${selectedShot.order}. ${selectedShot.titleZh}` : "分鏡編輯"}</CardTitle>
            <CardDescription>{selectedShot?.plotZh ?? "選擇一個 Shot 後編輯提示詞。"}</CardDescription>
            <CardAction>{selectedShot ? <StatusBadge status={Boolean(selectedShot.approved)} /> : null}</CardAction>
          </CardHeader>
          <CardContent>
            {selectedShot ? (
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>中文標題</FieldLabel>
                    <Input value={selectedShot.titleZh} onChange={(event) => updateShot(selectedShot.id, { titleZh: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>英文標題</FieldLabel>
                    <Input value={selectedShot.titleEn} onChange={(event) => updateShot(selectedShot.id, { titleEn: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>劇情說明 Zh</FieldLabel>
                    <Textarea rows={3} value={selectedShot.plotZh} onChange={(event) => updateShot(selectedShot.id, { plotZh: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>Plot En</FieldLabel>
                    <Textarea rows={3} value={selectedShot.plotEn} onChange={(event) => updateShot(selectedShot.id, { plotEn: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>角色清單</FieldLabel>
                    <Input value={selectedShot.characters.join(", ")} onChange={(event) => updateShot(selectedShot.id, { characters: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                  </Field>
                  <Field>
                    <FieldLabel>場景</FieldLabel>
                    <Input value={selectedShot.location} onChange={(event) => updateShot(selectedShot.id, { location: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>時間</FieldLabel>
                    <Input value={selectedShot.timeOfDay} onChange={(event) => updateShot(selectedShot.id, { timeOfDay: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>鏡頭語言</FieldLabel>
                    <Input value={selectedShot.camera} onChange={(event) => updateShot(selectedShot.id, { camera: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>動作方向</FieldLabel>
                    <Input value={selectedShot.movement} onChange={(event) => updateShot(selectedShot.id, { movement: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>情緒</FieldLabel>
                    <Input value={selectedShot.emotion} onChange={(event) => updateShot(selectedShot.id, { emotion: event.target.value })} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>中文圖片提示詞</FieldLabel>
                  <Textarea rows={5} value={selectedShot.imagePromptZh} onChange={(event) => updateShot(selectedShot.id, { imagePromptZh: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>English Image Prompt</FieldLabel>
                  <Textarea rows={5} value={selectedShot.imagePromptEn} onChange={(event) => updateShot(selectedShot.id, { imagePromptEn: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>中文影片提示詞</FieldLabel>
                  <Textarea rows={5} value={selectedShot.videoPromptZh} onChange={(event) => updateShot(selectedShot.id, { videoPromptZh: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>English Video Prompt</FieldLabel>
                  <Textarea rows={5} value={selectedShot.videoPromptEn} onChange={(event) => updateShot(selectedShot.id, { videoPromptEn: event.target.value })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Negative Prompt</FieldLabel>
                    <Textarea rows={3} value={selectedShot.negativePrompt} onChange={(event) => updateShot(selectedShot.id, { negativePrompt: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>Continuity Rules</FieldLabel>
                    <Textarea rows={3} value={selectedShot.continuityRules} onChange={(event) => updateShot(selectedShot.id, { continuityRules: event.target.value })} />
                  </Field>
                </div>
              </FieldGroup>
            ) : null}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>生成與確認</CardTitle>
              <CardDescription>正式劇本 approved 後才能生成。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button type="button" onClick={generateShots} disabled={isBusy}>
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                {shots.length ? "重新生成全部分鏡提示詞" : "生成全部分鏡提示詞"}
              </Button>
              <Button type="button" variant="outline" disabled={!selectedShot} onClick={() => selectedShot && regenerateOne(selectedShot.id)}>
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                重新生成單一分鏡提示詞
              </Button>
              <Button type="button" variant="outline" disabled={!shots.length || isBusy} onClick={() => saveShots(false)}>
                保存分鏡
              </Button>
              <Button type="button" disabled={!shots.length || isBusy} onClick={() => saveShots(true)} data-testid="approve-shots">
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
                確認分鏡提示詞
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>批次修改</CardTitle>
              <CardDescription>套用後需保存或確認。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Aspect Ratio</FieldLabel>
                  <select className="h-9 rounded-lg border bg-background px-3 text-sm" onChange={(event) => applyBulk({ aspectRatio: event.target.value as Shot["aspectRatio"] })} defaultValue="">
                    <option value="" disabled>選擇比例</option>
                    <option value="9:16">9:16</option>
                    <option value="16:9">16:9</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel>Image Model</FieldLabel>
                  <select className="h-9 rounded-lg border bg-background px-3 text-sm" onChange={(event) => applyBulk({ imageModel: event.target.value })} defaultValue="">
                    <option value="" disabled>選擇圖片模型</option>
                    {imageModels.map((model) => <option key={model.id} value={model.id}>{model.displayName ?? model.name ?? model.id}</option>)}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>Video Model</FieldLabel>
                  <select className="h-9 rounded-lg border bg-background px-3 text-sm" onChange={(event) => applyBulk({ videoModel: event.target.value })} defaultValue="">
                    <option value="" disabled>選擇影片模型</option>
                    {videoModels.map((model) => <option key={model.id} value={model.id}>{model.displayName ?? model.name ?? model.id}</option>)}
                  </select>
                </Field>
                <Field>
                  <FieldLabel>加入 Negative Prompt</FieldLabel>
                  <Input value={bulkNegative} onChange={(event) => setBulkNegative(event.target.value)} />
                  <Button type="button" variant="outline" disabled={!bulkNegative} onClick={() => applyBulk({ negativePrompt: bulkNegative })}>套用</Button>
                </Field>
                <Field>
                  <FieldLabel>加入 Continuity Rules</FieldLabel>
                  <Input value={bulkContinuity} onChange={(event) => setBulkContinuity(event.target.value)} />
                  <Button type="button" variant="outline" disabled={!bulkContinuity} onClick={() => applyBulk({ continuityRules: bulkContinuity })}>套用</Button>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>匯入 / 匯出</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Input type="file" accept=".json,.csv,.xlsx" onChange={(event) => importShots(event.target.files?.[0])} />
              <Button type="button" variant="outline" disabled={!shots.length} onClick={downloadJson}>
                <FileJsonIcon data-icon="inline-start" aria-hidden="true" />
                下載 Shots JSON
              </Button>
              <Button type="button" variant="outline" disabled={!shots.length} onClick={() => downloadBlob(`${projectSlug}_shots_prompts.csv`, toCsv(rows), "text/csv;charset=utf-8")}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                下載 Shots CSV
              </Button>
              <Button type="button" variant="outline" disabled={!shots.length} onClick={() => downloadXlsx(`${projectSlug}_shots_prompts.xlsx`, rows, "shots_prompts")}>
                <FileSpreadsheetIcon data-icon="inline-start" aria-hidden="true" />
                下載 Shots XLSX
              </Button>
              <Button type="button" variant="outline" disabled>
                <UploadIcon data-icon="inline-start" aria-hidden="true" />
                PDF / Word Coming soon
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            <Button render={allApproved ? <Link href={`/projects/${projectId}/characters`} /> : undefined} nativeButton={!allApproved} disabled={!allApproved}>
              進入角色資料庫
            </Button>
            <Button render={allApproved ? <Link href={`/projects/${projectId}/images`} /> : undefined} nativeButton={!allApproved} disabled={!allApproved} variant="outline">
              進入圖片生成
            </Button>
          </div>
        </aside>
      </div>

      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>分鏡表格</CardTitle>
          <CardDescription>Excel 欄位預覽。</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rows}
            columns={[
              { key: "shot_id", header: "shot_id" },
              { key: "segment_id", header: "segment_id" },
              { key: "shot_order", header: "shot_order" },
              { key: "shot_title_zh", header: "shot_title_zh" },
              { key: "image_prompt_en", header: "image_prompt_en" },
              { key: "video_prompt_en", header: "video_prompt_en" },
              { key: "aspect_ratio", header: "aspect_ratio" },
              { key: "image_model", header: "image_model" },
              { key: "video_model", header: "video_model" },
              { key: "status", header: "status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
