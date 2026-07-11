"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  RefreshCcwIcon,
} from "lucide-react";

import { DataTable, type DataColumn } from "@/components/studio/data-table";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadBlob,
  downloadXlsx,
  seoJsonPayload,
  toCsv,
} from "@/lib/export-utils";
import type {
  Segment,
  SegmentOutlineRow,
  SeoPackage,
} from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "請求失敗");
  return payload as T;
}

function slugify(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "story-project"
  );
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[]) {
  return value.join("\n");
}

function createRows(segments: Segment[], seoPackage: SeoPackage | null): SegmentOutlineRow[] {
  return segments.map((segment) => ({
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
    estimated_shots: segment.userShotCount ?? segment.estimatedShots,
    seo_hook:
      seoPackage?.shortsCutPoints[segment.order - 1] ??
      seoPackage?.youtubeHookZh ??
      "",
    notes: segment.approved ? "approved" : "needs approval",
  }));
}

const outlineColumns: Array<DataColumn<SegmentOutlineRow & Record<string, unknown>>> = [
  { key: "segment_order", header: "order" },
  { key: "segment_title_zh", header: "title zh" },
  { key: "story_purpose", header: "purpose" },
  { key: "emotion", header: "emotion" },
  { key: "location", header: "location" },
  { key: "estimated_shots", header: "shots" },
  { key: "seo_hook", header: "seo hook" },
];

export function SeoWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [seoPackage, setSeoPackage] = useState<SeoPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadWorkspace() {
    setIsLoading(true);
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    setSeoPackage(bundle.seoPackage);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
        setSeoPackage(bundle.seoPackage);
        setIsLoading(false);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取 SEO 工作台失敗");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const approvedSegments = useMemo(
    () => (workspace?.segments ?? []).filter((segment) => segment.approved),
    [workspace?.segments],
  );
  const outlineRows = useMemo(
    () => createRows(approvedSegments, seoPackage),
    [approvedSegments, seoPackage],
  );
  const canContinue = Boolean(seoPackage?.approved);
  const projectSlug = slugify(workspace?.project.name ?? "story-project");

  async function generateSeo() {
    setError("");
    setNotice("");
    if (!approvedSegments.length) {
      setError("沒有 approved segments，請先回文本工作台確認片段。");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await fetchJson<{ seoPackage: SeoPackage }>(
        `/api/projects/${projectId}/seo/generate`,
        { method: "POST" },
      );
      setSeoPackage(result.seoPackage);
      setNotice("SEO 包裝已生成。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成 SEO 包裝失敗");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveSeo(approve = false) {
    if (!seoPackage) return;
    setError("");
    try {
      const result = await fetchJson<{ seoPackage: SeoPackage }>(
        `/api/projects/${projectId}/seo`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seoPackage, approve }),
        },
      );
      setSeoPackage(result.seoPackage);
      setNotice(approve ? "SEO 包裝已確認，可以進入正式劇本工作台。" : "SEO 包裝已保存。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存 SEO 包裝失敗");
    }
  }

  function patchSeo(patch: Partial<SeoPackage>) {
    setSeoPackage((current) => (current ? { ...current, ...patch, approved: false } : current));
  }

  function downloadJson() {
    if (!seoPackage) return;
    downloadBlob(
      `${projectSlug}_seo_package.json`,
      seoJsonPayload(seoPackage, outlineRows),
      "application/json;charset=utf-8",
    );
  }

  function downloadCsv() {
    downloadBlob(
      `${projectSlug}_segment_outline.csv`,
      toCsv(outlineRows as unknown as Array<Record<string, unknown>>),
      "text/csv;charset=utf-8",
    );
  }

  async function handleDownloadXlsx() {
    await downloadXlsx(
      `${projectSlug}_segment_outline.xlsx`,
      outlineRows as unknown as Array<Record<string, unknown>>,
      "segment_outline",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">SEO 劇情包裝工作台</h1>
        <p className="mt-2 text-muted-foreground">
          根據已確認 Segment 生成 YouTube / Shorts / 搜尋曝光所需的標題、Hook、描述與匯出表格。
        </p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "draft"} current="seo" projectId={projectId} />
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>SEO 分數</CardTitle>
              <CardDescription>
                分數會依片段數與包裝完整度估算。
              </CardDescription>
              <CardAction>{seoPackage ? <StatusBadge status={seoPackage.approved} /> : null}</CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-end justify-between gap-3">
                <div className="text-4xl font-semibold">{seoPackage?.score ?? 0}</div>
                <div className="text-sm text-muted-foreground">
                  Approved segments: {approvedSegments.length}
                </div>
              </div>
              <Progress value={seoPackage?.score ?? 0} />
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {isLoading ? "載入中..." : "生成前需先確認文本片段。"}
              </span>
              <Button type="button" onClick={generateSeo} disabled={isGenerating || !approvedSegments.length} data-testid="generate-seo">
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                {isGenerating ? "生成中..." : "生成 SEO 包裝"}
              </Button>
            </CardFooter>
          </Card>
          {seoPackage ? (
            <Card className="bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>SEO 內容表單</CardTitle>
                <CardDescription>可編輯主標題、描述、關鍵字、Hook、封面建議與 Shorts 剪輯點。</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>主標題 Zh</FieldLabel>
                      <Input data-testid="seo-title-zh" value={seoPackage.seoTitleZh} onChange={(event) => patchSeo({ seoTitleZh: event.target.value })} />
                    </Field>
                    <Field>
                      <FieldLabel>主標題 En</FieldLabel>
                      <Input value={seoPackage.seoTitleEn} onChange={(event) => patchSeo({ seoTitleEn: event.target.value })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Hook Zh</FieldLabel>
                      <Textarea rows={3} value={seoPackage.youtubeHookZh} onChange={(event) => patchSeo({ youtubeHookZh: event.target.value })} />
                    </Field>
                    <Field>
                      <FieldLabel>Hook En</FieldLabel>
                      <Textarea rows={3} value={seoPackage.youtubeHookEn} onChange={(event) => patchSeo({ youtubeHookEn: event.target.value })} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>影片描述 Zh</FieldLabel>
                    <Textarea rows={4} value={seoPackage.longDescriptionZh} onChange={(event) => patchSeo({ longDescriptionZh: event.target.value })} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>備用標題 Zh（一行一個）</FieldLabel>
                      <Textarea rows={5} value={arrayToLines(seoPackage.alternativeTitlesZh)} onChange={(event) => patchSeo({ alternativeTitlesZh: linesToArray(event.target.value) })} />
                    </Field>
                    <Field>
                      <FieldLabel>關鍵字 Zh（一行一個）</FieldLabel>
                      <Textarea rows={5} value={arrayToLines(seoPackage.keywordsZh)} onChange={(event) => patchSeo({ keywordsZh: linesToArray(event.target.value) })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>封面建議（一行一個）</FieldLabel>
                      <Textarea rows={5} value={arrayToLines(seoPackage.thumbnailIdeas)} onChange={(event) => patchSeo({ thumbnailIdeas: linesToArray(event.target.value) })} />
                    </Field>
                    <Field>
                      <FieldLabel>Shorts 剪輯點（一行一個）</FieldLabel>
                      <Textarea rows={5} value={arrayToLines(seoPackage.shortsCutPoints)} onChange={(event) => patchSeo({ shortsCutPoints: linesToArray(event.target.value) })} />
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => saveSeo(false)}>
                  保存 SEO 包裝
                </Button>
                <Button type="button" onClick={() => saveSeo(true)} data-testid="approve-seo">
                  <CheckIcon data-icon="inline-start" aria-hidden="true" />
                  確認 SEO 包裝
                </Button>
              </CardFooter>
            </Card>
          ) : null}
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">片段大綱表格</h2>
            <DataTable
              columns={outlineColumns}
              rows={outlineRows as Array<SegmentOutlineRow & Record<string, unknown>>}
              emptyMessage="尚無 approved segments。"
            />
          </section>
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>匯出區</CardTitle>
              <CardDescription>檔名使用 `{projectSlug}_...` 規則。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button type="button" variant="outline" disabled={!seoPackage} onClick={downloadJson}>
                <FileJsonIcon data-icon="inline-start" aria-hidden="true" />
                下載 SEO JSON
              </Button>
              <Button type="button" variant="outline" disabled={!outlineRows.length} onClick={downloadCsv}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                下載片段大綱 CSV
              </Button>
              <Button type="button" variant="outline" disabled={!outlineRows.length} onClick={handleDownloadXlsx}>
                <FileSpreadsheetIcon data-icon="inline-start" aria-hidden="true" />
                下載片段大綱 XLSX
              </Button>
              <Button type="button" variant="outline" onClick={() => setNotice("PDF 匯出 Coming soon。")}>
                PDF Coming soon
              </Button>
              <Button type="button" variant="outline" onClick={() => setNotice("Word 匯出 Coming soon。")}>
                Word Coming soon
              </Button>
            </CardContent>
          </Card>
          <Button
            render={canContinue ? <Link href={`/projects/${projectId}/script`} /> : undefined}
            nativeButton={!canContinue}
            disabled={!canContinue}
          >
            進入正式劇本工作台
          </Button>
        </aside>
      </div>
    </div>
  );
}
