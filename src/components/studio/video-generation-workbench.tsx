"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DownloadIcon,
  RefreshCcwIcon,
  VideoIcon,
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
import { getVideoModelOptions } from "@/lib/model-capabilities";
import type { Asset } from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";

type VideoMode = "text-to-video" | "image-to-video" | "reference-to-video" | "first-last-frame" | "extend-video" | "edit-video";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "請求失敗");
  return payload as T;
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "story-project";
}

function durationOptions(durations: number[] | { min: number; max: number } | undefined) {
  if (!durations) return [];
  if (Array.isArray(durations)) return durations;
  const options = [];
  for (let value = durations.min; value <= durations.max; value += 1) options.push(value);
  return options;
}

export function VideoGenerationWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [selectedShotId, setSelectedShotId] = useState("");
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [mode, setMode] = useState<VideoMode>("image-to-video");
  const [modelId, setModelId] = useState("gemini-omni-flash-preview");
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState("720p");
  const [fps, setFps] = useState(24);
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [audioMode, setAudioMode] = useState<"none" | "model">("none");
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
        setError(caught instanceof Error ? caught.message : "讀取影片工作台失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const shots = useMemo(() => (workspace?.shots ?? []).filter((shot) => shot.approved).toSorted((a, b) => a.order - b.order), [workspace]);
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) ?? shots[0];
  const assets = workspace?.assets ?? [];
  const jobs = (workspace?.generationJobs ?? []).filter((job) => job.type === "video");
  const approvedImage = assets.find((asset) => asset.id === selectedShot?.approvedImageAssetId && asset.status === "approved");
  const videoAssets = assets.filter((asset) => asset.type === "generated_video");
  const approvedVideos = videoAssets.filter((asset) => asset.status === "approved");
  const selectedVideoAssets = videoAssets.filter((asset) => asset.shotId && selectedShotIds.includes(asset.shotId));
  const selectedShotAssets = videoAssets.filter((asset) => asset.shotId === selectedShot?.id).toSorted((a, b) => b.version - a.version);
  const selectedAsset = selectedShotAssets.find((asset) => asset.id === selectedAssetId) ?? selectedShotAssets.find((asset) => asset.id === selectedShot?.approvedVideoAssetId) ?? selectedShotAssets[0];
  const videoModels = getVideoModelOptions();
  const filteredModels = videoModels.filter((model) => {
    if (mode === "text-to-video") return model.supportsTextToVideo || model.modes.includes(mode);
    if (mode === "image-to-video") return model.supportsImageToVideo || model.modes.includes(mode);
    if (mode === "reference-to-video") return model.supportsReferenceImages || model.modes.includes(mode);
    return model.modes.includes(mode);
  });
  const selectedModel = filteredModels.find((model) => model.id === modelId) ?? filteredModels[0];
  const aspectRatio = selectedShot?.aspectRatio ?? workspace?.project.defaultAspectRatio ?? "9:16";
  const durations = durationOptions(selectedModel?.durations);
  const effectiveDuration = durations.includes(duration) ? duration : durations[0] ?? duration;
  const effectiveResolution = selectedModel?.resolutions?.includes(resolution) ? resolution : selectedModel?.resolutions?.[0] ?? "720p";
  const effectiveFps = selectedModel?.fps?.includes(fps) ? fps : selectedModel?.fps?.[0] ?? 24;
  const effectiveOutputFormat = selectedModel?.outputFormats?.includes(outputFormat) ? outputFormat : selectedModel?.outputFormats?.[0] ?? "mp4";
  const effectiveAudioMode = selectedModel?.supportsAudio ? audioMode : "none";

  const readiness = (() => {
    if (!selectedShot) return { ready: false, messages: ["尚未選擇分鏡"] };
    const messages = [];
    if (!selectedShot.approved) messages.push("分鏡尚未確認");
    if (!selectedShot.videoPromptEn) messages.push("缺少英文影片提示詞");
    if (!selectedModel) messages.push("目前模式沒有可用模型");
    if (selectedModel && !selectedModel.modes.includes(mode)) messages.push("模型不支援目前模式");
    if (selectedModel && !durations.includes(effectiveDuration)) messages.push("模型不支援目前秒數");
    if (selectedModel && !selectedModel.aspectRatios.includes(aspectRatio)) messages.push("模型不支援目前比例");
    if (mode === "image-to-video" && !approvedImage) messages.push("圖生影片需要 approved image");
    if (!/consistent|一致|保持|continuity/i.test(`${selectedShot.videoPromptEn} ${selectedShot.continuityRules}`)) messages.push("影片提示詞可能缺少 continuity rules");
    return { ready: messages.length === 0, messages };
  })();
  const projectSlug = slugify(workspace?.project.name ?? "story-project");

  async function postVideoAction(body: Record<string, unknown>, successMessage: string) {
    setIsBusy(true);
    setError("");
    try {
      await fetchJson(`/api/projects/${projectId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(successMessage);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "影片任務失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function postTimelineAction(body: Record<string, unknown>, successMessage: string) {
    setIsBusy(true);
    setError("");
    try {
      await fetchJson(`/api/projects/${projectId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(successMessage);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Timeline 操作失敗");
    } finally {
      setIsBusy(false);
    }
  }

  function settings() {
    return {
      mode,
      model: selectedModel?.id ?? modelId,
      duration: effectiveDuration,
      aspectRatio,
      resolution: effectiveResolution,
      fps: effectiveFps,
      outputFormat: effectiveOutputFormat,
      audioMode: effectiveAudioMode,
    };
  }

  function downloadAsset(asset: Asset | undefined) {
    if (!asset) return;
    downloadBlob(asset.filename, JSON.stringify({ asset, note: "影片素材中繼資料；接上正式影片服務後可替換為 MP4 檔案。" }, null, 2), "video/mp4");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">影片生成工作台</h1>
        <p className="mt-2 text-muted-foreground">預設使用圖生影片流程，所有任務都保留版本與 API 紀錄。</p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "image_ready"} current="videos" projectId={projectId} />
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
        <StatCard title="Approved Shots" value={String(shots.length)} description="可進入影片生成的分鏡" icon={VideoIcon} />
        <StatCard title="Approved Videos" value={String(approvedVideos.length)} description="已選為正式影片版本" icon={CheckIcon} />
        <StatCard title="All Versions" value={String(videoAssets.length)} description="不覆蓋舊影片" icon={ArchiveIcon} />
        <StatCard title="影片紀錄" value={String(jobs.length)} description="影片生成 API 呼叫" icon={RefreshCcwIcon} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Shot Video List</CardTitle>
            <CardDescription>顯示對應 approved image。藍色 checkbox 可批次操作。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="mb-2 grid gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedShotIds(shots.map((shot) => shot.id))}>全選</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedShotIds([])}>清除選取</Button>
            </div>
            {shots.map((shot) => (
              <div key={shot.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 ${shot.id === selectedShot?.id ? "dream-selected" : ""}`}>
                <input
                  className="sky-checkbox"
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
                    setSelectedAssetId(shot.approvedVideoAssetId ?? "");
                  }}
                >
                  #{shot.order} {shot.titleZh}
                </Button>
              </div>
            ))}
            {!shots.length ? <p className="text-sm text-muted-foreground">請先確認分鏡。</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>{selectedShot ? selectedShot.titleZh : "Video Preview"}</CardTitle>
            <CardDescription>{selectedShot?.plotZh ?? "選擇分鏡後預覽。"}</CardDescription>
            <CardAction>{selectedShot ? <StatusBadge status={selectedShot.videoStatus} /> : null}</CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-muted/40 p-3">
                <div className="mb-2 text-sm font-medium">對應圖片</div>
                {approvedImage?.url ? <img src={approvedImage.url} alt={approvedImage.filename} className="rounded-lg object-contain" /> : <p className="text-sm text-muted-foreground">沒有 approved image，image-to-video disabled。</p>}
              </div>
              <div className="rounded-xl border bg-muted/40 p-3">
                <div className="mb-2 text-sm font-medium">影片素材資料</div>
                {selectedAsset ? (
                  <div className="flex min-h-48 flex-col justify-center rounded-lg bg-background/70 p-4 text-sm">
                    <p className="font-medium">{selectedAsset.filename}</p>
                    <p className="text-muted-foreground">model: {selectedAsset.model}</p>
                    <p className="text-muted-foreground">version: {selectedAsset.version}</p>
                    <p className="text-muted-foreground">status: {selectedAsset.status}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">尚未生成影片。</p>
                )}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {selectedShotAssets.map((asset) => (
                <Button key={asset.id} type="button" variant={asset.id === selectedAsset?.id ? "secondary" : "outline"} onClick={() => { setSelectedAssetId(asset.id); setRenameValue(asset.filename); }}>
                  v{asset.version} · {asset.status}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>影片模式與模型</CardTitle>
              <CardDescription>{selectedModel?.displayName ?? selectedModel?.name ?? "無可用模型"}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>生成模式</FieldLabel>
                  <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={mode} onChange={(event) => setMode(event.target.value as VideoMode)}>
                    <option value="text-to-video">Text-to-Video</option>
                    <option value="image-to-video">Image-to-Video</option>
                    <option value="reference-to-video">Reference-to-Video</option>
                    <option value="first-last-frame">First-last-frame</option>
                    <option value="extend-video">Extend Video</option>
                    <option value="edit-video">Edit Video</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel>模型</FieldLabel>
                  <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={selectedModel?.id ?? ""} onChange={(event) => setModelId(event.target.value)} disabled={!filteredModels.length}>
                    {filteredModels.map((model) => <option key={model.id} value={model.id}>{model.displayName ?? model.name ?? model.id}</option>)}
                  </select>
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>秒數</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={effectiveDuration} onChange={(event) => setDuration(Number(event.target.value))}>
                      {durations.map((item) => <option key={item} value={item}>{item}s</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>比例</FieldLabel>
                    <Input readOnly value={aspectRatio} />
                  </Field>
                  <Field>
                    <FieldLabel>解析度</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={effectiveResolution} onChange={(event) => setResolution(event.target.value)}>
                      {(selectedModel?.resolutions ?? ["720p"]).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>FPS</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={effectiveFps} onChange={(event) => setFps(Number(event.target.value))}>
                      {(selectedModel?.fps ?? [24]).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>格式</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={effectiveOutputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
                      {(selectedModel?.outputFormats ?? ["mp4"]).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Audio</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={effectiveAudioMode} onChange={(event) => setAudioMode(event.target.value as "none" | "model")} disabled={!selectedModel?.supportsAudio}>
                      <option value="none">none</option>
                      <option value="model">model</option>
                    </select>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>生成前檢查</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <StatusBadge status={readiness.ready ? "success" : "failed"} />
              {readiness.messages.length ? readiness.messages.map((message) => <p key={message} className="text-muted-foreground">{message}</p>) : <p className="text-muted-foreground">檢查通過，可以生成。</p>}
              <Button type="button" disabled={!selectedShot || !readiness.ready || isBusy} onClick={() => postVideoAction({ action: "generate", shotIds: [selectedShot!.id], settings: settings() }, "單支影片已加入佇列並建立生成紀錄。")}>
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                生成 / 重新生成單支影片（加入佇列最後方）
              </Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postVideoAction({ action: "generate", shotIds: selectedShotIds, settings: settings() }, "選取影片已批次加入佇列最後方。")}>
                批次生成選中影片
              </Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postVideoAction({ action: "batch-approve-latest", shotIds: selectedShotIds }, "已批次標記各 shot 最新影片版本為 approved。")}>
                批次標記 approved
              </Button>
              <Button type="button" variant="outline" disabled={!shots.length || isBusy} onClick={() => postVideoAction({ action: "generate", allPending: true, settings: settings() }, "全部待處理影片已批次建立生成紀錄。")}>
                批次生成全部 pending
              </Button>
              <Button type="button" variant="outline" onClick={() => postVideoAction({ action: "cancel-pending" }, "已取消 pending / queued video jobs。")}>
                <XCircleIcon data-icon="inline-start" aria-hidden="true" />
                取消 pending jobs
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>影片提示詞</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Video Prompt En</FieldLabel>
                  <Textarea readOnly rows={5} value={selectedShot?.videoPromptEn ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Video Prompt Zh</FieldLabel>
                  <Textarea readOnly rows={4} value={selectedShot?.videoPromptZh ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Movement / Camera</FieldLabel>
                  <Input readOnly value={`${selectedShot?.movement ?? ""} / ${selectedShot?.camera ?? ""}`} />
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
              <Input value={renameValue || selectedAsset?.filename || ""} onChange={(event) => setRenameValue(event.target.value)} />
              <Button type="button" variant="outline" disabled={!selectedAsset || !renameValue} onClick={() => postVideoAction({ action: "rename", assetId: selectedAsset!.id, filename: renameValue }, "影片檔名已更新。")}>修改影片檔名</Button>
              <Button type="button" disabled={!selectedShot || !selectedAsset} onClick={() => postVideoAction({ action: "approve", shotId: selectedShot!.id, assetId: selectedAsset!.id }, "已設定 approved video。")}>設為 approved video</Button>
              <Button type="button" variant="outline" disabled={!selectedAsset} onClick={() => downloadAsset(selectedAsset)}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                單支 MP4 下載
              </Button>
              <Button type="button" variant="outline" disabled={!approvedVideos.length} onClick={() => downloadZip(`${projectSlug}_approved_videos.zip`, assetDownloadFiles(approvedVideos, "approved"))}>下載 approved videos ZIP</Button>
              <Button type="button" variant="outline" disabled={!videoAssets.length} onClick={() => downloadZip(`${projectSlug}_all_video_versions.zip`, assetDownloadFiles(videoAssets, "all_versions"))}>下載 all versions ZIP</Button>
              <Button type="button" variant="outline" disabled={!selectedVideoAssets.length} onClick={() => downloadZip(`${projectSlug}_selected_videos.zip`, assetDownloadFiles(selectedVideoAssets, "selected"))}>批次下載選中影片</Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length} onClick={() => postVideoAction({ action: "generate", shotIds: selectedShotIds, settings: settings() }, "選取影片已批次重新生成並排到最後。")}>批次重新生成選中影片</Button>
              <Button type="button" variant="outline" disabled={!selectedShotIds.length || isBusy} onClick={() => postTimelineAction({ action: "auto-build" }, "已依已確認影片建立時間軸排列。")}>批次加入時間軸</Button>
              <Button type="button" variant="outline" disabled={!approvedVideos.length || isBusy} onClick={() => postTimelineAction({ action: "mock-export" }, "已建立已確認影片的合併輸出紀錄。")}>建立合併輸出紀錄</Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Video Generation Queue</CardTitle>
          <CardDescription>Grok adapter 未來可把 pending/done/expired/failed 映射到內部狀態。</CardDescription>
        </CardHeader>
        <CardContent>
          <JobsTable jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
