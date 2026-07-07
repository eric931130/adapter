"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
} from "lucide-react";

import { DataTable } from "@/components/studio/data-table";
import { JobsTable } from "@/components/studio/jobs-table";
import { StatCard } from "@/components/studio/stat-card";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assetDownloadFiles,
  characterRows,
  downloadBlob,
  downloadMultiSheetXlsx,
  downloadXlsx,
  downloadZip,
  jobRows,
  scriptRows,
  seoJsonPayload,
  shotRows,
  toCsv,
} from "@/lib/export-utils";
import { modelCapabilities } from "@/lib/model-capabilities";
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

function timeStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function ExportsWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadWorkspace() {
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取匯出中心失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project = workspace?.project;
  const projectSlug = slugify(project?.name ?? "story-project");
  const stamp = timeStamp();
  const approvedSegments = (workspace?.segments ?? []).filter((segment) => segment.approved).toSorted((a, b) => a.order - b.order);
  const segmentOutlineRows = approvedSegments.map((segment) => ({
    segment_id: segment.id,
    segment_order: segment.order,
    segment_title_zh: segment.titleZh,
    segment_title_en: segment.titleEn,
    story_purpose: segment.storyPurpose,
    summary_zh: segment.summaryZh,
    summary_en: segment.summaryEn,
    emotion: segment.emotion,
    location: segment.location,
    characters: segment.characters.join(", "),
    estimated_shots: segment.estimatedShots,
    seo_hook: workspace?.seoPackage?.youtubeHookZh ?? "",
    notes: "",
  }));
  const seoRows = workspace?.seoPackage
    ? Object.entries(workspace.seoPackage).map(([key, value]) => ({ field: key, value: Array.isArray(value) ? value.join(" | ") : String(value) }))
    : [];
  const scripts = workspace?.scripts ?? [];
  const shots = workspace?.shots ?? [];
  const characters = workspace?.characters ?? [];
  const assets = workspace?.assets ?? [];
  const jobs = workspace?.generationJobs ?? [];
  const scriptExportRows = scriptRows(scripts, approvedSegments);
  const shotExportRows = shotRows(shots);
  const characterExportRows = characterRows(characters);
  const generationJobRows = jobRows(jobs);
  const environmentRows = (workspace?.environments ?? []).map((environment) => ({ ...environment, referenceAssetIds: environment.referenceAssetIds.join(", ") }));
  const galleryRows = (workspace?.galleryItems ?? []).map((item) => ({ ...item, tags: item.tags.join(", "), linkedShotIds: item.linkedShotIds.join(", ") }));
  const transitionRows = (workspace?.transitions ?? []).map((transition) => ({ ...transition }));
  const logRows = (workspace?.studioLogs ?? []).map((log) => ({ ...log }));
  const costSummary = useMemo(() => {
    const imageJobs = jobs.filter((job) => job.type === "image");
    const videoJobs = jobs.filter((job) => job.type === "video");
    const imageCost = imageJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
    const videoCost = videoJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
    const totalCost = jobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
    return {
      totalJobs: jobs.length,
      successJobs: jobs.filter((job) => job.status === "success").length,
      failedJobs: jobs.filter((job) => job.status === "failed").length,
      imageCost,
      videoCost,
      totalCost,
      averageImageCost: imageJobs.length ? imageCost / imageJobs.length : 0,
      averageVideoCost: videoJobs.length ? videoCost / videoJobs.length : 0,
    };
  }, [jobs]);
  const costRows = generationJobRows.map((row) => ({
    job_id: row.job_id,
    project_id: projectId,
    shot_id: row.shot_id,
    type: row.type,
    provider: row.provider,
    model: row.model,
    mode: row.mode,
    status: row.status,
    estimated_cost: row.estimated_cost,
    actual_cost: row.actual_cost,
    retry_count: row.retry_count,
    created_at: row.created_at,
    completed_at: row.completed_at,
    error_message: row.error_message,
  }));
  const approvedImages = assets.filter((asset) => asset.type === "generated_image" && asset.status === "approved");
  const allImages = assets.filter((asset) => asset.type === "generated_image");
  const approvedVideos = assets.filter((asset) => asset.type === "generated_video" && asset.status === "approved");
  const allVideos = assets.filter((asset) => asset.type === "generated_video");

  async function recordExport(exportType: string, extension: string) {
    if (!project) return;
    setIsBusy(true);
    setError("");
    try {
      await fetchJson(`/api/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType, extension }),
      });
      setNotice(`已建立 ${exportType} 匯出任務紀錄。`);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "建立匯出任務失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function downloadWithJob(exportType: string, extension: string, handler: () => void | Promise<void>) {
    await handler();
    await recordExport(exportType, extension);
  }

  async function fullProjectZip() {
    await downloadZip(`${projectSlug}_full_project_export_${stamp}.zip`, [
      { path: "project.json", content: JSON.stringify(project, null, 2) },
      { path: "model_capabilities_snapshot.json", content: JSON.stringify(modelCapabilities, null, 2) },
      { path: "presets/presets.json", content: JSON.stringify(workspace?.presets ?? [], null, 2) },
      { path: "source_documents/source_documents.json", content: JSON.stringify(workspace?.sourceDocuments ?? [], null, 2) },
      { path: "seo/seo_package.json", content: workspace?.seoPackage ? seoJsonPayload(workspace.seoPackage, segmentOutlineRows) : "{}" },
      { path: "seo/seo_package.csv", content: toCsv(seoRows) },
      { path: "scripts/scripts.csv", content: toCsv(scriptExportRows) },
      { path: "shots/shots_prompts.csv", content: toCsv(shotExportRows) },
      { path: "characters/character_bible.json", content: JSON.stringify({ characters }, null, 2) },
      { path: "characters/character_bible.csv", content: toCsv(characterExportRows) },
      { path: "environments/environment_bible.json", content: JSON.stringify(workspace?.environments ?? [], null, 2) },
      { path: "environments/environment_bible.csv", content: toCsv(environmentRows) },
      { path: "gallery/gallery_index.json", content: JSON.stringify(workspace?.galleryItems ?? [], null, 2) },
      { path: "gallery/gallery_index.csv", content: toCsv(galleryRows) },
      ...assetDownloadFiles(approvedImages, "images/approved"),
      ...assetDownloadFiles(allImages, "images/all_versions"),
      ...assetDownloadFiles(approvedVideos, "videos/approved"),
      ...assetDownloadFiles(allVideos, "videos/all_versions"),
      { path: "transitions/transitions.json", content: JSON.stringify(workspace?.transitions ?? [], null, 2) },
      { path: "transitions/transitions.csv", content: toCsv(transitionRows) },
      { path: "timeline/timeline.json", content: JSON.stringify(workspace?.timeline ?? null, null, 2) },
      { path: "logs/logs.csv", content: toCsv(logRows) },
      { path: "reports/generation_jobs.csv", content: toCsv(generationJobRows) },
      { path: "reports/cost_report.csv", content: toCsv(costRows) },
    ]);
    await recordExport("full_project_export", "zip");
  }

  async function importProjectPackage(file: File) {
    let packagePayload: Record<string, unknown>;
    if (file.name.endsWith(".zip")) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      packagePayload = {};
      await Promise.all(Object.entries(zip.files).map(async ([path, entry]) => {
        if (entry.dir) return;
        if (!path.endsWith(".json")) return;
        packagePayload[path] = await entry.async("string");
      }));
    } else {
      packagePayload = JSON.parse(await file.text());
    }
    await fetchJson(`/api/projects/${projectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: packagePayload }),
    });
    setNotice("Project package 已解析並匯入主要 JSON 資料，asset index 已重建。");
    await loadWorkspace();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">匯出下載中心</h1>
        <p className="mt-2 text-muted-foreground">下載 SEO、Excel、角色資料庫、圖片、影片、成本報告與完整專案包。</p>
      </div>
      <WorkflowStepper status={project?.status ?? "video_ready"} current="exports" projectId={projectId} />
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

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>匯出選項</CardTitle>
            <CardDescription>檔名使用 project_slug + export_type + 時間。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button type="button" variant="outline" disabled={!workspace?.seoPackage} onClick={() => downloadWithJob("seo_package", "json", () => downloadBlob(`${projectSlug}_seo_package_${stamp}.json`, workspace?.seoPackage ? seoJsonPayload(workspace.seoPackage, segmentOutlineRows) : "{}", "application/json;charset=utf-8"))}>
              <FileJsonIcon data-icon="inline-start" aria-hidden="true" />
              SEO Package JSON
            </Button>
            <Button type="button" variant="outline" disabled={!seoRows.length} onClick={() => downloadWithJob("seo_package", "xlsx", () => downloadXlsx(`${projectSlug}_seo_package_${stamp}.xlsx`, seoRows, "seo_package"))}>SEO Package XLSX</Button>
            <Button type="button" variant="outline" disabled={!segmentOutlineRows.length} onClick={() => downloadWithJob("segment_outline", "xlsx", () => downloadXlsx(`${projectSlug}_segment_outline_${stamp}.xlsx`, segmentOutlineRows, "segment_outline"))}>Segment Outline XLSX</Button>
            <Button type="button" variant="outline" disabled={!scriptExportRows.length} onClick={() => downloadWithJob("scripts", "xlsx", () => downloadXlsx(`${projectSlug}_scripts_${stamp}.xlsx`, scriptExportRows, "scripts"))}>Script XLSX</Button>
            <Button type="button" variant="outline" disabled={!shotExportRows.length} onClick={() => downloadWithJob("shots_prompts", "xlsx", () => downloadXlsx(`${projectSlug}_shots_prompts_${stamp}.xlsx`, shotExportRows, "shots_prompts"))}>Shot Prompt XLSX</Button>
            <Button type="button" variant="outline" disabled={!characterExportRows.length} onClick={() => downloadWithJob("character_bible", "xlsx", () => downloadXlsx(`${projectSlug}_character_bible_${stamp}.xlsx`, characterExportRows, "character_bible"))}>Character Bible XLSX</Button>
            <Button type="button" variant="outline" disabled={!characterExportRows.length} onClick={() => downloadWithJob("character_bible", "json", () => downloadBlob(`${projectSlug}_character_bible_${stamp}.json`, JSON.stringify({ characters }, null, 2), "application/json;charset=utf-8"))}>Character Bible JSON</Button>
            <Button type="button" variant="outline" disabled={!approvedImages.length} onClick={() => downloadWithJob("approved_images", "zip", () => downloadZip(`${projectSlug}_approved_images_${stamp}.zip`, assetDownloadFiles(approvedImages, "approved")))}>Approved Images ZIP</Button>
            <Button type="button" variant="outline" disabled={!allImages.length} onClick={() => downloadWithJob("all_image_versions", "zip", () => downloadZip(`${projectSlug}_all_image_versions_${stamp}.zip`, assetDownloadFiles(allImages, "all_versions")))}>All Image Versions ZIP</Button>
            <Button type="button" variant="outline" disabled={!approvedVideos.length} onClick={() => downloadWithJob("approved_videos", "zip", () => downloadZip(`${projectSlug}_approved_videos_${stamp}.zip`, assetDownloadFiles(approvedVideos, "approved")))}>Approved Videos ZIP</Button>
            <Button type="button" variant="outline" disabled={!allVideos.length} onClick={() => downloadWithJob("all_video_versions", "zip", () => downloadZip(`${projectSlug}_all_video_versions_${stamp}.zip`, assetDownloadFiles(allVideos, "all_versions")))}>All Video Versions ZIP</Button>
            <Button type="button" variant="outline" disabled={!generationJobRows.length} onClick={() => downloadWithJob("generation_jobs", "xlsx", () => downloadXlsx(`${projectSlug}_generation_jobs_${stamp}.xlsx`, generationJobRows, "generation_jobs"))}>Generation Jobs XLSX</Button>
            <Button type="button" variant="outline" disabled={!costRows.length} onClick={() => downloadWithJob("cost_report", "xlsx", () => downloadMultiSheetXlsx(`${projectSlug}_cost_report_${stamp}.xlsx`, [{ rows: [costSummary], sheetName: "summary" }, { rows: costRows, sheetName: "cost_report" }]))}>Cost Report XLSX</Button>
            <Button type="button" disabled={isBusy || !workspace} onClick={fullProjectZip}>
              <FileArchiveIcon data-icon="inline-start" aria-hidden="true" />
              Full Project Export ZIP
            </Button>
            <Button type="button" variant="outline" onClick={() => document.getElementById("project-import")?.click()}>
              Project ZIP / JSON 匯入
            </Button>
            <input
              id="project-import"
              className="hidden"
              type="file"
              accept=".json,.zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                importProjectPackage(file).catch((caught) => setError(caught instanceof Error ? caught.message : "匯入失敗"));
              }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="Segments" value={String(approvedSegments.length)} description="approved segment outline" icon={FileSpreadsheetIcon} />
            <StatCard title="Shots" value={String(shots.length)} description="shot prompt rows" icon={ArchiveIcon} />
            <StatCard title="Assets" value={String(assets.length)} description="images, videos, references, exports" icon={DownloadIcon} />
            <StatCard title="Approved Images" value={String(approvedImages.length)} description="ready for packaging" icon={CheckIcon} />
            <StatCard title="Approved Videos" value={String(approvedVideos.length)} description="ready for packaging" icon={CheckIcon} />
            <StatCard title="Export Jobs" value={String(jobs.filter((job) => job.type === "export").length)} description="export task records" icon={FileArchiveIcon} />
          </div>
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>匯出紀錄</CardTitle>
              <CardDescription>Export 也會建立 GenerationJob。</CardDescription>
            </CardHeader>
            <CardContent>
              <JobsTable jobs={jobs.filter((job) => job.type === "export")} />
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>成本報告摘要</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p>總任務數：{costSummary.totalJobs}</p>
              <p>成功任務數：{costSummary.successJobs}</p>
              <p>失敗任務數：{costSummary.failedJobs}</p>
              <p>圖片生成總成本：${costSummary.imageCost.toFixed(2)}</p>
              <p>影片生成總成本：${costSummary.videoCost.toFixed(2)}</p>
              <p>總成本：${costSummary.totalCost.toFixed(2)}</p>
              <p>平均每張圖片成本：${costSummary.averageImageCost.toFixed(2)}</p>
              <p>平均每支影片成本：${costSummary.averageVideoCost.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>成本表預覽</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={costRows.slice(0, 8)}
                columns={[
                  { key: "job_id", header: "job_id" },
                  { key: "type", header: "type" },
                  { key: "model", header: "model" },
                  { key: "status", header: "status" },
                  { key: "actual_cost", header: "cost" },
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
