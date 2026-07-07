"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DownloadIcon,
  ImageIcon,
  RefreshCcwIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";

import { JobsTable } from "@/components/studio/jobs-table";
import { StatCard } from "@/components/studio/stat-card";
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
import { assetDownloadFiles, downloadBlob, downloadZip } from "@/lib/export-utils";
import { getImageModelOptions } from "@/lib/model-capabilities";
import type { Asset } from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "請求失敗");
  return payload as T;
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "story-project";
}

export function ImageGenerationWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [selectedShotId, setSelectedShotId] = useState("");
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [candidateCount, setCandidateCount] = useState(1);
  const [batchImageModel, setBatchImageModel] = useState("");
  const [batchAspectRatio, setBatchAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadWorkspace() {
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    const firstShot = bundle.shots.find((shot) => shot.approved) ?? bundle.shots[0];
    setSelectedShotId((current) => current || firstShot?.id || "");
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
        const firstShot = bundle.shots.find((shot) => shot.approved) ?? bundle.shots[0];
        setSelectedShotId((current) => current || firstShot?.id || "");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取圖片工作台失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const shots = useMemo(() => (workspace?.shots ?? []).filter((shot) => shot.approved).toSorted((a, b) => a.order - b.order), [workspace]);
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) ?? shots[0];
  const assets = workspace?.assets ?? [];
  const jobs = (workspace?.generationJobs ?? []).filter((job) => job.type === "image");
  const imageAssets = assets.filter((asset) => asset.type === "generated_image");
  const selectedShotAssets = imageAssets.filter((asset) => asset.shotId === selectedShot?.id).toSorted((a, b) => b.version - a.version);
  const selectedAsset = selectedShotAssets.find((asset) => asset.id === selectedAssetId) ?? selectedShotAssets.find((asset) => asset.id === selectedShot?.approvedImageAssetId) ?? selectedShotAssets[0];
  const candidateScores = selectedShotAssets.map((asset, index) => {
    const seed = asset.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const character = 70 + ((seed + index * 5) % 25);
    const environment = 68 + ((seed + index * 7) % 27);
    const alignment = 72 + ((seed + index * 11) % 22);
    const composition = 69 + ((seed + index * 13) % 24);
    const artifacts = 80 + ((seed + index * 17) % 18);
    const total = Math.round((character + environment + alignment + composition + artifacts) / 5);
    return { assetId: asset.id, total, character, environment, alignment, composition, artifacts };
  }).toSorted((a, b) => b.total - a.total);
  const bestPickId = candidateScores[0]?.assetId;
  const approvedImages = imageAssets.filter((asset) => asset.status === "approved");
  const selectedImageAssets = imageAssets.filter((asset) => asset.shotId && selectedShotIds.includes(asset.shotId));
  const imageModelOptions = getImageModelOptions();
  const model = imageModelOptions.find((item) => item.id === selectedShot?.imageModel);
  const readiness = (() => {
    if (!selectedShot) return { ready: false, messages: ["尚未選擇分鏡"] };
    const messages = [];
    if (!selectedShot.approved) messages.push("分鏡尚未確認");
    if (!selectedShot.imagePromptEn) messages.push("缺少英文圖片提示詞");
    if (!model) messages.push("圖片模型不存在");
    if (model && !model.aspectRatios.includes(selectedShot.aspectRatio)) messages.push("模型不支援目前比例");
    if (!selectedShot.negativePrompt) messages.push("缺少 negativePrompt");
    if (!selectedShot.continuityRules) messages.push("缺少 continuityRules");
    return { ready: messages.length === 0, messages };
  })();
  const projectSlug = slugify(workspace?.project.name ?? "story-project");
  const allHaveApprovedImage = shots.length > 0 && shots.every((shot) => Boolean(shot.approvedImageAssetId));

  async function postImageAction(body: Record<string, unknown>, successMessage: string) {
    setIsBusy(true);
    setError("");
    try {
      await fetchJson(`/api/projects/${projectId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(successMessage);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "圖片任務失敗");
    } finally {
      setIsBusy(false);
    }
  }

  function downloadAsset(asset: Asset | undefined, format: "png" | "jpg") {
    if (!asset) return;
    downloadBlob(asset.filename.replace(/\.[^.]+$/, `.${format}`), JSON.stringify({ asset, note: "Mock image asset. The SVG dataUrl is in asset.url." }, null, 2), format === "png" ? "image/png" : "image/jpeg");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">圖片生成工作台</h1>
        <p className="mt-2 text-muted-foreground">所有圖片生成都會建立 GenerationJob，成功後新增 Asset version。</p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "storyboard_ready"} current="images" projectId={projectId} />
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

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Approved Shots" value={String(shots.length)} description="可進入圖片生成的分鏡" icon={ImageIcon} />
        <StatCard title="Approved Images" value={String(approvedImages.length)} description="已選為正式圖片版本" icon={CheckIcon} />
        <StatCard title="All Versions" value={String(imageAssets.length)} description="不覆蓋舊圖，保留版本" icon={ArchiveIcon} />
        <StatCard title="Image Jobs" value={String(jobs.length)} description="GenerationJob type=image" icon={RefreshCcwIcon} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Shot List</CardTitle>
            <CardDescription>只顯示 approved shots。薄荷 checkbox 可批次操作。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="mb-2 grid gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedShotIds(shots.map((shot) => shot.id))}>全選</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedShotIds([])}>清除選取</Button>
            </div>
            {shots.map((shot) => (
              <div key={shot.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 ${shot.id === selectedShot?.id ? "dream-selected" : ""}`}>
                <input
                  className="mint-checkbox"
                  type="checkbox"
                  checked={selectedShotIds.includes(shot.id)}
                  onChange={(event) => setSelectedShotIds((current) => event.target.checked ? current.concat(shot.id) : current.filter((id) => id !== shot.id))}
                />
                <Button
                  type="button"
                  variant={shot.id === selectedShot?.id ? "secondary" : "ghost"}
                  className="min-w-0 flex-1 justify-start"
                  onClick={() => {
                    setSelectedShotId(shot.id);
                    setSelectedAssetId(shot.approvedImageAssetId ?? "");
                  }}
                >
                  #{shot.order} {shot.titleZh}
                </Button>
              </div>
            ))}
            {!shots.length ? <p className="text-sm text-muted-foreground">請先確認分鏡提示詞。</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>{selectedShot ? selectedShot.titleZh : "Image Preview"}</CardTitle>
            <CardDescription>{selectedShot?.plotZh ?? "選擇分鏡後預覽。"}</CardDescription>
            <CardAction>{selectedShot ? <StatusBadge status={selectedShot.imageStatus} /> : null}</CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex min-h-[24rem] items-center justify-center rounded-xl border bg-muted/40 p-4">
              {selectedAsset?.url ? (
                <img src={selectedAsset.url} alt={selectedAsset.filename} className="max-h-[34rem] rounded-lg object-contain shadow-sm" />
              ) : (
                <div className="text-center text-sm text-muted-foreground">尚未生成圖片。</div>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {selectedShotAssets.map((asset) => (
                <Button
                  key={asset.id}
                  type="button"
                  variant={asset.id === selectedAsset?.id ? "secondary" : "outline"}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setRenameValue(asset.filename);
                  }}
                >
                  v{asset.version} · {asset.status}{asset.id === bestPickId ? " · AI Best Pick" : ""} · {candidateScores.find((score) => score.assetId === asset.id)?.total ?? "--"}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>生成前檢查</CardTitle>
              <CardDescription>{model?.displayName ?? model?.name ?? selectedShot?.imageModel ?? "未選擇模型"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <StatusBadge status={readiness.ready ? "success" : "failed"} />
              {readiness.messages.length ? readiness.messages.map((message) => <p key={message} className="text-muted-foreground">{message}</p>) : <p className="text-muted-foreground">檢查通過，可以生成。</p>}
              <Field>
                <FieldLabel>候選圖數量 / shot</FieldLabel>
                <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))}>
                  <option value={1}>1 張</option>
                  <option value={2}>2 張</option>
                  <option value={4}>4 張</option>
                </select>
              </Field>
              <Button type="button" disabled={!selectedShot || !readiness.ready || isBusy} onClick={() => postImageAction({ action: "generate", shotIds: [selectedShot!.id], candidateCount }, "單張圖片已加入佇列最後方並 mock 生成候選圖。")}>
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                生成 / 重新生成單張（加入佇列最後方）
              </Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postImageAction({ action: "generate", shotIds: selectedShotIds, candidateCount }, "選取圖片已批次加入佇列最後方。")}>
                批次生成選取圖片
              </Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postImageAction({ action: "batch-approve-latest", shotIds: selectedShotIds }, "已批次標記各 shot 最新圖片版本為 approved。")}>
                批次標記 approved
              </Button>
              <Button type="button" variant="outline" disabled={!shots.length || isBusy} onClick={() => postImageAction({ action: "generate", allPending: true, candidateCount }, "全部 pending 圖片已批次 mock 生成。")}>
                批次生成全部 pending
              </Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postImageAction({ action: "delete-unapproved-versions", shotIds: selectedShotIds }, "已刪除選取 shots 的未核准圖片版本。")}>
                批次刪除未核准版本
              </Button>
              <Button type="button" variant="outline" onClick={() => postImageAction({ action: "cancel-pending" }, "已取消 pending / queued image jobs。")}>
                <XCircleIcon data-icon="inline-start" aria-hidden="true" />
                取消 pending jobs
              </Button>
              <div className="rounded-xl border bg-white/55 p-3">
                <FieldGroup>
                  <Field>
                    <FieldLabel>批次套用模型</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={batchImageModel || selectedShot?.imageModel || ""} onChange={(event) => setBatchImageModel(event.target.value)}>
                      {imageModelOptions.map((item) => <option key={item.id} value={item.id}>{item.displayName ?? item.name ?? item.id}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>批次套用比例</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={batchAspectRatio} onChange={(event) => setBatchAspectRatio(event.target.value as "9:16" | "16:9")}>
                      <option value="9:16">9:16</option>
                      <option value="16:9">16:9</option>
                    </select>
                  </Field>
                  <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postImageAction({ action: "apply-settings", shotIds: selectedShotIds, imageModel: batchImageModel || selectedShot?.imageModel, aspectRatio: batchAspectRatio }, "已批次套用圖片模型與比例，相關圖片狀態回到 pending。")}>
                    套用到選取圖片
                  </Button>
                </FieldGroup>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Prompt / Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Aspect Ratio</FieldLabel>
                  <Input readOnly value={selectedShot?.aspectRatio ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Image Model</FieldLabel>
                  <Input readOnly value={selectedShot?.imageModel ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Image Prompt En</FieldLabel>
                  <Textarea readOnly rows={5} value={selectedShot?.imagePromptEn ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Image Prompt Zh</FieldLabel>
                  <Textarea readOnly rows={4} value={selectedShot?.imagePromptZh ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Negative Prompt</FieldLabel>
                  <Textarea readOnly rows={3} value={selectedShot?.negativePrompt ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Continuity Rules</FieldLabel>
                  <Textarea readOnly rows={3} value={selectedShot?.continuityRules ?? ""} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>版本與下載</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {candidateScores.length ? (
                <div className="rounded-xl border bg-white/60 p-3 text-xs text-muted-foreground">
                  AI Best Pick: {bestPickId} · score {candidateScores[0]?.total}
                </div>
              ) : null}
              <Input value={renameValue || selectedAsset?.filename || ""} onChange={(event) => setRenameValue(event.target.value)} />
              <Button type="button" variant="outline" disabled={!selectedAsset || !renameValue} onClick={() => postImageAction({ action: "rename", assetId: selectedAsset!.id, filename: renameValue }, "圖片檔名已更新。")}>修改圖片檔名</Button>
              <Button type="button" disabled={!selectedShot || !selectedAsset} onClick={() => postImageAction({ action: "approve", shotId: selectedShot!.id, assetId: selectedAsset!.id }, "已設定 approved image。")}>設為 approved image</Button>
              <Button type="button" variant="outline" disabled={!selectedAsset} onClick={() => downloadAsset(selectedAsset, "png")}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                單張下載 PNG
              </Button>
              <Button type="button" variant="outline" disabled={!selectedAsset} onClick={() => downloadAsset(selectedAsset, "jpg")}>單張下載 JPG</Button>
              <Button type="button" variant="outline" disabled={!approvedImages.length} onClick={() => downloadZip(`${projectSlug}_approved_images.zip`, assetDownloadFiles(approvedImages, "approved"))}>下載 approved images ZIP</Button>
              <Button type="button" variant="outline" disabled={!imageAssets.length} onClick={() => downloadZip(`${projectSlug}_all_image_versions.zip`, assetDownloadFiles(imageAssets, "all_versions"))}>下載 all versions ZIP</Button>
              <Button type="button" variant="outline" disabled={!selectedImageAssets.length} onClick={() => downloadZip(`${projectSlug}_selected_images.zip`, assetDownloadFiles(selectedImageAssets, "selected"))}>批次下載選取圖片</Button>
              <Button render={allHaveApprovedImage ? <Link href={`/projects/${projectId}/videos`} /> : undefined} nativeButton={!allHaveApprovedImage} disabled={!allHaveApprovedImage}>
                <SendIcon data-icon="inline-start" aria-hidden="true" />
                送入影片生成
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Generation Queue</CardTitle>
          <CardDescription>Mock worker 會立即完成，但仍保留 job 紀錄。</CardDescription>
        </CardHeader>
        <CardContent>
          <JobsTable jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
