"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  FileUpIcon,
  PlusIcon,
  RefreshCcwIcon,
  Trash2Icon,
} from "lucide-react";

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectWorkspace } from "@/lib/workspace-types";
import type { Segment, TextWorkbenchSettings } from "@/lib/schemas";
import { segmentSchema, textWorkbenchSettingsSchema } from "@/lib/schemas";

const defaultSettings: TextWorkbenchSettings = {
  storyTheme: "懸疑成長故事",
  videoType: "shorts",
  targetAudience: "喜歡劇情短影音與 AI 影音創作的觀眾",
  defaultLanguage: "zh_tw",
  segmentCount: 5,
  defaultStyle: "cinematic, clean character continuity, teal and blue highlights",
  notes: "",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "請求失敗");
  }
  return payload as T;
}

function makeEmptySegment(projectId: string, order: number): Segment {
  const timestamp = new Date().toISOString();
  return {
    id: `segment-${projectId}-manual-${Date.now()}`,
    projectId,
    order,
    titleZh: `新增片段 ${order}`,
    titleEn: `Manual Segment ${order}`,
    summaryZh: "請輸入片段摘要。",
    summaryEn: "Please add the English summary.",
    storyPurpose: "補充故事推進目的。",
    emotion: "待設定",
    location: "待設定",
    characters: ["主角"],
    estimatedShots: 3,
    userShotCount: 3,
    approved: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function TextWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [settings, setSettings] = useState<TextWorkbenchSettings>(defaultSettings);
  const [sourceText, setSourceText] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadWorkspace() {
    setIsLoading(true);
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    setSegments(bundle.segments);
    setSettings(bundle.textSettings ?? {
      ...defaultSettings,
      segmentCount: bundle.project.defaultSegmentCount || 5,
      defaultStyle: bundle.project.defaultStyle || defaultSettings.defaultStyle,
    });
    const latestDoc = bundle.sourceDocuments[0];
    if (latestDoc?.parsedText && latestDoc.status === "parsed") {
      setSourceText(latestDoc.parsedText);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
        setSegments(bundle.segments);
        setSettings(bundle.textSettings ?? {
          ...defaultSettings,
          segmentCount: bundle.project.defaultSegmentCount || 5,
          defaultStyle: bundle.project.defaultStyle || defaultSettings.defaultStyle,
        });
        const latestDoc = bundle.sourceDocuments[0];
        if (latestDoc?.parsedText && latestDoc.status === "parsed") {
          setSourceText(latestDoc.parsedText);
        }
        setIsLoading(false);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取文本工作台失敗");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const allApproved = segments.length > 0 && segments.every((segment) => segment.approved);
  const canAnalyze = sourceText.trim().length > 0 && !isAnalyzing;

  async function saveSourceDocument(filename = "pasted-story.md", rawText = sourceText) {
    const fileType = filename.toLowerCase().endsWith(".txt") ? "txt" : "md";
    await fetchJson(`/api/projects/${projectId}/source-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, fileType, rawText }),
    });
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    setError("");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "md", "docx", "pdf"].includes(extension)) {
      setError("僅支援 .txt、.md、.docx、.pdf。");
      return;
    }
    if (extension === "txt" || extension === "md") {
      const text = await file.text();
      setSourceText(text);
      await fetchJson(`/api/projects/${projectId}/source-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileType: extension, rawText: text }),
      });
      setNotice(`${file.name} 已解析並保存。`);
      await loadWorkspace();
      return;
    }
    await fetchJson(`/api/projects/${projectId}/source-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, fileType: extension, rawText: "" }),
    });
    setNotice(`${file.name} 已建立上傳紀錄；完整解析器之後串接。`);
    await loadWorkspace();
  }

  async function handleAnalyze() {
    setError("");
    setNotice("");
    const parsedSettings = textWorkbenchSettingsSchema.safeParse(settings);
    if (!parsedSettings.success) {
      setError(parsedSettings.error.issues[0]?.message ?? "專案設定不完整");
      return;
    }
    if (!sourceText.trim()) {
      setError("請先貼上故事原稿或上傳 .txt / .md 檔案。");
      return;
    }
    setIsAnalyzing(true);
    try {
      await saveSourceDocument();
      const result = await fetchJson<{ segments: Segment[] }>(
        `/api/projects/${projectId}/analyze-story`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceText, settings: parsedSettings.data }),
        },
      );
      setSegments(result.segments);
      setNotice(`AI mock 分析完成，已產生 ${result.segments.length} 個劇情片段。`);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析失敗");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function saveSegments(nextSegments = segments) {
    setError("");
    setIsSaving(true);
    try {
      const parsed = segmentSchema.array().safeParse(nextSegments);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "片段資料不完整");
      }
      const result = await fetchJson<{ segments: Segment[] }>(
        `/api/projects/${projectId}/segments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: parsed.data }),
        },
      );
      setSegments(result.segments);
      setNotice("片段已保存。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存片段失敗");
    } finally {
      setIsSaving(false);
    }
  }

  async function approveSegments() {
    await saveSegments(segments);
    try {
      await fetchJson(`/api/projects/${projectId}/segments/approve`, { method: "POST" });
      setNotice("片段已確認並鎖定，可以進入 SEO 劇情包裝。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "確認片段失敗");
    }
  }

  function updateSegment(index: number, patch: Partial<Segment>) {
    setSegments((current) =>
      current.map((segment, itemIndex) =>
        itemIndex === index ? { ...segment, ...patch, approved: false } : segment,
      ),
    );
  }

  function moveSegment(index: number, direction: -1 | 1) {
    setSegments((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy.map((segment, itemIndex) => ({
        ...segment,
        order: itemIndex + 1,
        approved: false,
      }));
    });
  }

  const sourceDocuments = workspace?.sourceDocuments ?? [];
  const analysis = workspace?.storyAnalysis;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">文本工作台</h1>
        <p className="mt-2 text-muted-foreground">
          貼上或上傳故事原稿，使用 mock AI 分析故事結構並拆成可確認的劇情片段。
        </p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "draft"} current="text" projectId={projectId} />
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
        <div className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>原稿輸入</CardTitle>
              <CardDescription>
                .txt / .md 會直接解析；.docx / .pdf 先建立上傳紀錄與 placeholder parsing。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="source-text">貼上故事原稿</FieldLabel>
                  <Textarea
                    id="source-text"
                    rows={12}
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder="在這裡貼上故事原稿..."
                  />
                  <FieldDescription>
                    若上傳 .docx / .pdf，MVP 仍需要另外貼上可分析文字。
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="source-file">上傳檔案</FieldLabel>
                  <Input
                    id="source-file"
                    type="file"
                    accept=".txt,.md,.docx,.pdf"
                    onChange={(event) => handleFileUpload(event.target.files?.[0])}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>專案設定</CardTitle>
              <CardDescription>這些欄位會傳入 mock `analyzeStory(input)`。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>故事主題</FieldLabel>
                  <Input
                    value={settings.storyTheme}
                    onChange={(event) => setSettings({ ...settings, storyTheme: event.target.value })}
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>影片類型</FieldLabel>
                    <select
                      className="h-9 rounded-lg border bg-background px-3 text-sm"
                      value={settings.videoType}
                      onChange={(event) => setSettings({ ...settings, videoType: event.target.value as TextWorkbenchSettings["videoType"] })}
                    >
                      <option value="youtube_long">YouTube 長片</option>
                      <option value="shorts">Shorts</option>
                      <option value="children_story">兒童故事</option>
                      <option value="ad">廣告</option>
                      <option value="course">教學影片</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>預設語言</FieldLabel>
                    <select
                      className="h-9 rounded-lg border bg-background px-3 text-sm"
                      value={settings.defaultLanguage}
                      onChange={(event) => setSettings({ ...settings, defaultLanguage: event.target.value as TextWorkbenchSettings["defaultLanguage"] })}
                    >
                      <option value="zh_tw">繁中</option>
                      <option value="en">英文</option>
                      <option value="bilingual">中英雙語</option>
                    </select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel>目標觀眾</FieldLabel>
                  <Input
                    value={settings.targetAudience}
                    onChange={(event) => setSettings({ ...settings, targetAudience: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel>預設分段數：{settings.segmentCount}</FieldLabel>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={1}
                      max={12}
                      step={1}
                      value={[settings.segmentCount]}
                      onValueChange={(value) => {
                        const nextValue = Array.isArray(value) ? value[0] : value;
                        setSettings({ ...settings, segmentCount: Number(nextValue ?? 5) });
                      }}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      min={1}
                      max={20}
                      value={settings.segmentCount}
                      onChange={(event) => setSettings({ ...settings, segmentCount: Number(event.target.value) })}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel>預設畫風</FieldLabel>
                  <Input
                    value={settings.defaultStyle}
                    onChange={(event) => setSettings({ ...settings, defaultStyle: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel>備註</FieldLabel>
                  <Textarea
                    rows={4}
                    value={settings.notes ?? ""}
                    onChange={(event) => setSettings({ ...settings, notes: event.target.value })}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {isLoading ? "載入中..." : `已保存 ${sourceDocuments.length} 份 source document`}
              </span>
              <Button type="button" disabled={!canAnalyze} onClick={handleAnalyze} data-testid="analyze-story">
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                {isAnalyzing ? "分析中..." : "AI 分析故事"}
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>AI 故事分析</CardTitle>
              <CardDescription>
                {analysis ? analysis.logline : "尚未分析。按下 AI 分析故事後會顯示故事結構。"}
              </CardDescription>
              <CardAction>{workspace ? <StatusBadge status={workspace.project.status} /> : null}</CardAction>
            </CardHeader>
            {analysis ? (
              <CardContent className="grid gap-3 md:grid-cols-2">
                <InfoBlock title="主要角色" value={analysis.mainCharacters.join("、")} />
                <InfoBlock title="核心衝突" value={analysis.conflict} />
                <InfoBlock title="世界設定" value={analysis.worldSetting} />
                <InfoBlock title="情緒弧線" value={analysis.emotionalArc} />
                <InfoBlock title="風險提醒" value={analysis.riskWarnings.join("；")} />
                <InfoBlock title="建議分段" value={String(analysis.recommendedSegmentCount)} />
              </CardContent>
            ) : null}
          </Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">片段確認</h2>
              <p className="text-sm text-muted-foreground">
                Segment approved 為 true 後才能進入 SEO 階段。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSegments((current) => [...current, makeEmptySegment(projectId, current.length + 1)])}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              新增片段
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {segments.map((segment, index) => (
              <Card key={segment.id} className="bg-card/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>#{index + 1} {segment.titleZh}</CardTitle>
                  <CardDescription>{segment.storyPurpose}</CardDescription>
                  <CardAction>
                    <StatusBadge status={segment.approved} />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>片段標題</FieldLabel>
                      <Input data-testid={`segment-title-${index}`} value={segment.titleZh} onChange={(event) => updateSegment(index, { titleZh: event.target.value })} />
                    </Field>
                    <Field>
                      <FieldLabel>英文標題</FieldLabel>
                      <Input value={segment.titleEn} onChange={(event) => updateSegment(index, { titleEn: event.target.value })} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>中文摘要</FieldLabel>
                    <Textarea rows={3} value={segment.summaryZh} onChange={(event) => updateSegment(index, { summaryZh: event.target.value })} />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Field>
                      <FieldLabel>情緒</FieldLabel>
                      <Input value={segment.emotion} onChange={(event) => updateSegment(index, { emotion: event.target.value })} />
                    </Field>
                    <Field>
                      <FieldLabel>地點</FieldLabel>
                      <Input value={segment.location} onChange={(event) => updateSegment(index, { location: event.target.value })} />
                    </Field>
                    <Field>
                      <FieldLabel>角色</FieldLabel>
                      <Input
                        value={segment.characters.join(", ")}
                        onChange={(event) => updateSegment(index, { characters: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>AI 建議分鏡數</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={segment.estimatedShots}
                        onChange={(event) => updateSegment(index, { estimatedShots: Number(event.target.value), userShotCount: Number(event.target.value) })}
                      />
                      <FieldError errors={segment.estimatedShots < 1 ? [{ message: "分鏡數不能小於 1" }] : undefined} />
                    </Field>
                  </div>
                </CardContent>
                <CardFooter className="justify-between gap-3">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => moveSegment(index, -1)} disabled={index === 0}>
                      <ArrowUpIcon data-icon="inline-start" aria-hidden="true" />
                      上移
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => moveSegment(index, 1)} disabled={index === segments.length - 1}>
                      <ArrowDownIcon data-icon="inline-start" aria-hidden="true" />
                      下移
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setSegments((current) => current.filter((item) => item.id !== segment.id).map((item, itemIndex) => ({ ...item, order: itemIndex + 1, approved: false })))}
                  >
                    <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                    刪除
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={!segments.length || isSaving} onClick={() => saveSegments()}>
          <FileUpIcon data-icon="inline-start" aria-hidden="true" />
          {isSaving ? "保存中..." : "保存片段"}
        </Button>
        <Button type="button" disabled={!segments.length || isSaving} onClick={approveSegments} data-testid="approve-segments">
          <CheckIcon data-icon="inline-start" aria-hidden="true" />
          確認並鎖定片段
        </Button>
        <Button
          render={allApproved ? <Link href={`/projects/${projectId}/seo`} /> : undefined}
          nativeButton={!allApproved}
          disabled={!allApproved}
        >
          進入 SEO 劇情包裝
        </Button>
      </div>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}
