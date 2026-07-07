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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { StatCard } from "@/components/studio/stat-card";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import {
  downloadBlob,
  downloadXlsx,
  scriptRows,
  toCsv,
} from "@/lib/export-utils";
import type { Script, ScriptDifficulty, Segment } from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";
import {
  BadgeDollarSignIcon,
  ClapperboardIcon,
  FilmIcon,
  ImageIcon,
  LayersIcon,
} from "lucide-react";

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

function finalShotCount(script: Script) {
  return Math.min(30, Math.max(1, script.userShotCount ?? script.suggestedShotCount));
}

function riskBadges(script: Script, segment?: Segment) {
  const risks = [];
  if ((segment?.characters.length ?? 0) >= 3) risks.push("角色多");
  if (/城市|戰場|列車|宇宙|森林|學校|宮殿|街道/.test(segment?.location ?? "")) risks.push("場景複雜");
  if (/追|逃|戰|跑|跳|爆|衝|打|飛/.test(script.characterAction + script.visualDirection)) risks.push("動作複雜");
  if ((segment?.characters.length ?? 0) >= 2 || script.generationRisk.includes("一致性")) risks.push("角色一致性高風險");
  return risks.length ? risks : ["低風險"];
}

export function ScriptWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadWorkspace() {
    setIsLoading(true);
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    setScripts(bundle.scripts);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
        setScripts(bundle.scripts);
        setIsLoading(false);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取正式劇本工作台失敗");
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
  const segmentMap = useMemo(
    () => new Map(approvedSegments.map((segment) => [segment.id, segment])),
    [approvedSegments],
  );
  const rows = useMemo(() => scriptRows(scripts, approvedSegments), [scripts, approvedSegments]);
  const projectSlug = slugify(workspace?.project.name ?? "story-project");
  const stats = useMemo(() => {
    const suggested = scripts.reduce((sum, script) => sum + script.suggestedShotCount, 0);
    const final = scripts.reduce((sum, script) => sum + finalShotCount(script), 0);
    return {
      segments: approvedSegments.length,
      suggested,
      final,
      images: final,
      videos: final,
    };
  }, [approvedSegments.length, scripts]);
  const allApproved = scripts.length > 0 && scripts.every((script) => script.approved);

  async function generate() {
    setError("");
    setNotice("");
    setIsGenerating(true);
    try {
      const result = await fetchJson<{ scripts: Script[] }>(
        `/api/projects/${projectId}/scripts/generate`,
        { method: "POST" },
      );
      setScripts(result.scripts);
      setNotice("正式劇本已生成。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成正式劇本失敗");
    } finally {
      setIsGenerating(false);
    }
  }

  async function save(approve = false) {
    setError("");
    try {
      const result = await fetchJson<{ scripts: Script[] }>(
        `/api/projects/${projectId}/scripts`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scripts, approve }),
        },
      );
      setScripts(result.scripts);
      setNotice(approve ? "正式劇本與分鏡數已確認，可以進入分鏡提示詞工作台。" : "正式劇本已保存。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存正式劇本失敗");
    }
  }

  function updateScript(index: number, patch: Partial<Script>) {
    setScripts((current) =>
      current.map((script, itemIndex) =>
        itemIndex === index ? { ...script, ...patch, approved: false } : script,
      ),
    );
  }

  function applyShotCount(mode: "ai" | 3 | 5) {
    setScripts((current) =>
      current.map((script) => ({
        ...script,
        userShotCount: mode === "ai" ? script.suggestedShotCount : mode,
        approved: false,
      })),
    );
  }

  function downloadJson() {
    downloadBlob(
      `${projectSlug}_scripts.json`,
      JSON.stringify({ scripts, rows }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function downloadCsv() {
    downloadBlob(
      `${projectSlug}_scripts.csv`,
      toCsv(rows),
      "text/csv;charset=utf-8",
    );
  }

  async function downloadScriptXlsx() {
    await downloadXlsx(`${projectSlug}_scripts.xlsx`, rows, "scripts");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">正式劇本工作台</h1>
        <p className="mt-2 text-muted-foreground">
          根據已確認 Segment 與 SEO Package 產生可生成分鏡的正式劇本資料。
        </p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "text_ready"} current="script" projectId={projectId} />
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>劇本生成</CardTitle>
              <CardDescription>
                需要 approved segments 與已確認 SEO 包裝。每個 Segment 會對應一份 Script。
              </CardDescription>
              <CardAction>{workspace?.seoPackage ? <StatusBadge status={workspace.seoPackage.approved} /> : null}</CardAction>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button" onClick={generate} disabled={isGenerating} data-testid="generate-scripts">
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                {isGenerating ? "生成中..." : "生成正式劇本"}
              </Button>
              <Button type="button" variant="outline" onClick={() => applyShotCount(3)} disabled={!scripts.length}>
                每段固定 3 格
              </Button>
              <Button type="button" variant="outline" onClick={() => applyShotCount(5)} disabled={!scripts.length}>
                每段固定 5 格
              </Button>
              <Button type="button" variant="outline" onClick={() => applyShotCount("ai")} disabled={!scripts.length}>
                使用 AI 建議
              </Button>
            </CardContent>
          </Card>
          <Accordion multiple defaultValue={scripts.map((script) => script.id)} className="rounded-xl border bg-card/80 px-4 backdrop-blur">
            {scripts.map((script, index) => {
              const segment = segmentMap.get(script.segmentId);
              const risks = riskBadges(script, segment);
              return (
                <AccordionItem key={script.id} value={script.id}>
                  <AccordionTrigger>
                    <div className="flex flex-wrap items-center gap-3">
                      <span>{segment?.order ?? index + 1}. {segment?.titleZh ?? script.segmentId}</span>
                      <StatusBadge status={script.approved} />
                      {risks.map((risk) => (
                        <Badge key={risk} variant={risk === "低風險" ? "secondary" : "outline"}>
                          {risk}
                        </Badge>
                      ))}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="grid gap-4">
                    <FieldGroup>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel>中文旁白</FieldLabel>
                          <Textarea data-testid={`script-narration-zh-${index}`} rows={4} value={script.narrationZh} onChange={(event) => updateScript(index, { narrationZh: event.target.value })} />
                        </Field>
                        <Field>
                          <FieldLabel>英文旁白</FieldLabel>
                          <Textarea rows={4} value={script.narrationEn} onChange={(event) => updateScript(index, { narrationEn: event.target.value })} />
                        </Field>
                      </div>
                      <Field>
                        <FieldLabel>角色行動</FieldLabel>
                        <Textarea rows={3} value={script.characterAction} onChange={(event) => updateScript(index, { characterAction: event.target.value })} />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel>情緒方向</FieldLabel>
                          <Input value={script.emotionalDirection} onChange={(event) => updateScript(index, { emotionalDirection: event.target.value })} />
                        </Field>
                        <Field>
                          <FieldLabel>視覺方向</FieldLabel>
                          <Input value={script.visualDirection} onChange={(event) => updateScript(index, { visualDirection: event.target.value })} />
                        </Field>
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <Field>
                          <FieldLabel>AI 建議分鏡數</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={script.suggestedShotCount}
                            onChange={(event) => updateScript(index, { suggestedShotCount: Number(event.target.value) })}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>使用者分鏡數</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={script.userShotCount ?? ""}
                            onChange={(event) => updateScript(index, { userShotCount: Number(event.target.value) })}
                          />
                        </Field>
                        <Field>
                          <FieldLabel>生成難度</FieldLabel>
                          <select
                            className="h-9 rounded-lg border bg-background px-3 text-sm"
                            value={script.difficulty}
                            onChange={(event) => updateScript(index, { difficulty: event.target.value as ScriptDifficulty })}
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>
                        </Field>
                        <Field>
                          <FieldLabel>最終分鏡數</FieldLabel>
                          <Input readOnly value={finalShotCount(script)} />
                        </Field>
                      </div>
                      <Field>
                        <FieldLabel>風險備註</FieldLabel>
                        <Textarea rows={3} value={script.generationRisk} onChange={(event) => updateScript(index, { generationRisk: event.target.value })} />
                      </Field>
                    </FieldGroup>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
        <aside className="flex flex-col gap-4">
          <div className="grid gap-4">
            <StatCard title="總片段數" value={String(stats.segments)} description="已確認的文本片段。" icon={LayersIcon} />
            <StatCard title="總建議分鏡數" value={String(stats.suggested)} description="AI suggestedShotCount 加總。" icon={ClapperboardIcon} />
            <StatCard title="確認後總分鏡數" value={String(stats.final)} description="userShotCount 優先，限制 1-30。" icon={BadgeDollarSignIcon} />
            <StatCard title="預估圖片生成數量" value={String(stats.images)} description="每格分鏡至少一張圖。" icon={ImageIcon} />
            <StatCard title="預估影片生成數量" value={String(stats.videos)} description="每格分鏡至少一段影片。" icon={FilmIcon} />
          </div>
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>劇本輸出</CardTitle>
              <CardDescription>支援 JSON / CSV / XLSX。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button type="button" variant="outline" disabled={!scripts.length} onClick={downloadJson}>
                <FileJsonIcon data-icon="inline-start" aria-hidden="true" />
                下載 Script JSON
              </Button>
              <Button type="button" variant="outline" disabled={!scripts.length} onClick={downloadCsv}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                下載 Script CSV
              </Button>
              <Button type="button" variant="outline" disabled={!scripts.length} onClick={downloadScriptXlsx}>
                <FileSpreadsheetIcon data-icon="inline-start" aria-hidden="true" />
                下載 Script XLSX
              </Button>
            </CardContent>
          </Card>
          <Button type="button" variant="outline" disabled={!scripts.length} onClick={() => save(false)}>
            保存正式劇本
          </Button>
          <Button type="button" disabled={!scripts.length || isLoading} onClick={() => save(true)} data-testid="approve-scripts">
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
            確認正式劇本與分鏡數
          </Button>
          <Button
            render={allApproved ? <Link href={`/projects/${projectId}/shots`} /> : undefined}
            nativeButton={!allApproved}
            disabled={!allApproved}
          >
            進入分鏡提示詞工作台
          </Button>
        </aside>
      </div>
    </div>
  );
}
