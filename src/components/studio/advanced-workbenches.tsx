"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  DownloadIcon,
  GalleryHorizontalEndIcon,
  HistoryIcon,
  KeyRoundIcon,
  LayersIcon,
  SaveIcon,
  SparklesIcon,
  StarIcon,
  UploadIcon,
  WandSparklesIcon,
  WaypointsIcon,
} from "lucide-react";

import { DataTable } from "@/components/studio/data-table";
import { StatCard } from "@/components/studio/stat-card";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { assetDownloadFiles, downloadBlob, downloadXlsx, downloadZip, toCsv } from "@/lib/export-utils";
import { modelCapabilities } from "@/lib/model-capabilities";
import type { Environment, Preset, ProviderSetting, Timeline, TimelineItem, TimelineTrack, Transition } from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.userMessage ?? payload.error ?? "請求失敗");
  return payload as T;
}

function timeStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "story-project";
}

function useWorkspace(projectId: string) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadWorkspace() {
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
  }

  async function run(action: () => Promise<void>, success: string) {
    setIsBusy(true);
    setError("");
    try {
      await action();
      setNotice(success);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失敗");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (!cancelled) setWorkspace(bundle);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "讀取工作台失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { workspace, error, notice, isBusy, setNotice, run, loadWorkspace };
}

function WorkbenchFrame({
  projectId,
  title,
  description,
  current,
  workspace,
  error,
  notice,
  children,
}: {
  projectId: string;
  title: string;
  description: string;
  current?: string;
  workspace: ProjectWorkspace | null;
  error: string;
  notice: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-main)]">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      {current ? <WorkflowStepper status={workspace?.project.status ?? "draft"} current={current} projectId={projectId} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert className="border-[var(--color-border)] bg-[var(--color-success-soft)]/55">
          <CheckIcon aria-hidden="true" />
          <AlertTitle>狀態更新</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {workspace ? children : <Card><CardContent className="p-6 text-sm text-muted-foreground">載入 {projectId} 中...</CardContent></Card>}
    </div>
  );
}

export function PresetsWorkbench({ projectId }: { projectId: string }) {
  const { workspace, error, notice, isBusy, run } = useWorkspace(projectId);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const presets = workspace?.presets ?? [];
  const selected = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0];

  async function savePresetDraft() {
    if (!workspace) return;
    const now = new Date().toISOString();
    const preset: Preset = {
      id: `preset-custom-${Date.now()}`,
      name: "自訂夢幻工作流模板",
      description: "從目前專案新增的 prompt/model/template 設定。",
      type: "prompt_style",
      settings: {
        defaultStyle: workspace.project.defaultStyle,
        imageModel: workspace.project.defaultImageModel,
        videoModel: workspace.project.defaultVideoModel,
        aspectRatio: workspace.project.defaultAspectRatio,
      },
      createdAt: now,
      updatedAt: now,
    };
    await fetchJson(`/api/projects/${projectId}/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", presets: presets.concat(preset) }),
    });
  }

  return (
    <WorkbenchFrame projectId={projectId} title="Preset 模板系統" description="建立、匯入、匯出並套用故事風格、提示詞、角色、影片與匯出模板。" current="presets" workspace={workspace} error={error} notice={notice}>
      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>內建與自訂模板</CardTitle>
            <CardDescription>七個內建 preset 已由 mock DB 提供。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {presets.map((preset) => (
              <Button key={preset.id} type="button" variant={preset.id === selected?.id ? "secondary" : "ghost"} className="justify-start" onClick={() => setSelectedPresetId(preset.id)}>
                <WandSparklesIcon data-icon="inline-start" aria-hidden="true" />
                {preset.name}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card className="dream-selected">
          <CardHeader>
            <CardTitle>{selected?.name ?? "選擇模板"}</CardTitle>
            <CardDescription>{selected?.description ?? "套用到專案或全部分鏡。"}</CardDescription>
            <CardAction>{selected ? <StatusBadge status="approved" /> : null}</CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTable
              rows={selected ? Object.entries(selected.settings).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(", ") : JSON.stringify(value) })) : []}
              columns={[
                { key: "key", header: "setting" },
                { key: "value", header: "value" },
              ]}
            />
            <div className="grid gap-2 md:grid-cols-3">
              <Button disabled={!selected || isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/presets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply-project", presetId: selected!.id }) }), "Preset 已套用到專案設定。")}>套用到專案</Button>
              <Button variant="outline" disabled={!selected || isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/presets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply-shots", presetId: selected!.id }) }), "Preset 已套用到全部分鏡。")}>套用到全部分鏡</Button>
              <Button variant="outline" disabled={!selected} onClick={() => downloadBlob(`${slugify(workspace!.project.name)}_preset_${timeStamp()}.json`, JSON.stringify(selected, null, 2), "application/json;charset=utf-8")}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                匯出 preset JSON
              </Button>
            </div>
          </CardContent>
        </Card>
        <aside className="flex flex-col gap-4">
          <StatCard title="Presets" value={String(presets.length)} description="story / prompt / character / video / export" icon={SparklesIcon} />
          <Card>
            <CardHeader>
              <CardTitle>建立 / 匯入</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button disabled={isBusy || !workspace} onClick={() => run(savePresetDraft, "已新增自訂 preset。")}>
                <SaveIcon data-icon="inline-start" aria-hidden="true" />
                從專案建立模板
              </Button>
              <Button variant="outline" onClick={() => document.getElementById("preset-import")?.click()}>
                <UploadIcon data-icon="inline-start" aria-hidden="true" />
                匯入 preset JSON
              </Button>
              <input
                id="preset-import"
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  run(async () => {
                    const imported = JSON.parse(await file.text());
                    await fetchJson(`/api/projects/${projectId}/presets`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "import", presets: Array.isArray(imported) ? imported : [imported] }),
                    });
                  }, "Preset JSON 已匯入。");
                }}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </WorkbenchFrame>
  );
}

export function EnvironmentBibleWorkbench({ projectId }: { projectId: string }) {
  const { workspace, error, notice, isBusy, run } = useWorkspace(projectId);
  const [selectedId, setSelectedId] = useState("");
  const environments = workspace?.environments ?? [];
  const selected = environments.find((item) => item.id === selectedId) ?? environments[0];
  const [draft, setDraft] = useState<Environment | null>(null);
  const activeDraft = draft?.id === selected?.id ? draft : selected ?? null;

  const issues = useMemo(() => {
    if (!workspace) return [];
    return workspace.shots.flatMap((shot) => {
      const env = environments.find((item) => [item.nameZh, item.nameEn].some((name) => name.toLowerCase() === shot.location.toLowerCase()));
      const row = [];
      if (!env) row.push({ shot: shot.id, location: shot.location, issue: "場景名稱不存在" });
      if (env && !env.fixedPromptEn) row.push({ shot: shot.id, location: shot.location, issue: "缺少英文固定提示詞" });
      if (env && !env.referenceAssetIds.length) row.push({ shot: shot.id, location: shot.location, issue: "缺少場景參考圖" });
      return row;
    });
  }, [environments, workspace]);

  async function saveDraft() {
    if (!activeDraft) return;
    const next = environments.map((item) => item.id === activeDraft.id ? activeDraft : item);
    await fetchJson(`/api/projects/${projectId}/environments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environments: next }),
    });
  }

  async function uploadEnvironmentReference(file: File) {
    if (!activeDraft) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("讀取場景參考圖失敗"));
      reader.readAsDataURL(file);
    });
    await fetchJson(`/api/projects/${projectId}/environments/reference-assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environmentId: activeDraft.id, filename: file.name, dataUrl }),
    });
  }

  return (
    <WorkbenchFrame projectId={projectId} title="Environment Bible 場景一致性資料庫" description="像 Character Bible 一樣管理場景固定提示詞、色調、光線、參考圖與漂移檢查。" current="environments" workspace={workspace} error={error} notice={notice}>
      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>場景列表</CardTitle>
            <CardDescription>可從 shots 自動抽取。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button disabled={isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/environments/extract`, { method: "POST" }), "已從分鏡抽取場景草稿。")}>自動抽取場景</Button>
            {environments.map((environment) => (
              <Button key={environment.id} variant={environment.id === selected?.id ? "secondary" : "ghost"} className="justify-start" onClick={() => { setSelectedId(environment.id); setDraft(environment); }}>
                <LayersIcon data-icon="inline-start" aria-hidden="true" />
                {environment.nameZh || environment.nameEn}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card className={activeDraft ? "dream-selected" : ""}>
          <CardHeader>
            <CardTitle>{activeDraft?.nameZh ?? "選擇場景"}</CardTitle>
            <CardDescription>固定場景提示詞會以附加區塊合併到分鏡 prompt。</CardDescription>
          </CardHeader>
          <CardContent>
            {activeDraft ? (
              <FieldGroup>
                {(["nameZh", "nameEn", "visualStyle", "colorPalette", "lighting"] as const).map((key) => (
                  <Field key={key}>
                    <FieldLabel>{key}</FieldLabel>
                    <Input value={activeDraft[key]} onChange={(event) => setDraft({ ...activeDraft, [key]: event.target.value })} />
                  </Field>
                ))}
                <Field>
                  <FieldLabel>descriptionZh</FieldLabel>
                  <Textarea rows={3} value={activeDraft.descriptionZh} onChange={(event) => setDraft({ ...activeDraft, descriptionZh: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>fixedPromptEn</FieldLabel>
                  <Textarea rows={5} value={activeDraft.fixedPromptEn} onChange={(event) => setDraft({ ...activeDraft, fixedPromptEn: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>consistencyNotes</FieldLabel>
                  <Textarea rows={4} value={activeDraft.consistencyNotes} onChange={(event) => setDraft({ ...activeDraft, consistencyNotes: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>Reference Images</FieldLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      run(() => uploadEnvironmentReference(file), "場景參考圖已上傳並連結到 Environment Bible。");
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {activeDraft.referenceAssetIds.length ? activeDraft.referenceAssetIds.join(", ") : "尚未上傳場景參考圖。"}
                  </p>
                </Field>
                <Button disabled={isBusy} onClick={() => run(saveDraft, "Environment Bible 已保存。")}>保存場景資料</Button>
              </FieldGroup>
            ) : <p className="text-sm text-muted-foreground">尚未建立場景資料。</p>}
          </CardContent>
        </Card>
        <aside className="flex flex-col gap-4">
          <StatCard title="Environments" value={String(environments.length)} description="場景資料卡" icon={LayersIcon} />
          <StatCard title="Drift Warnings" value={String(issues.length)} description="缺少資料或參考圖" icon={HistoryIcon} />
          <Button disabled={isBusy || !environments.length} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/environments/apply`, { method: "POST" }), "場景一致性已套用到所有相關 shot。")}>套用到所有相關 Shot</Button>
          <Button variant="outline" disabled={!environments.length} onClick={() => downloadXlsx(`${slugify(workspace!.project.name)}_environment_bible_${timeStamp()}.xlsx`, environments as unknown as Array<Record<string, unknown>>, "environments")}>匯出 Environment XLSX</Button>
          <Card>
            <CardHeader>
              <CardTitle>一致性檢查</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable rows={issues.slice(0, 8)} columns={[{ key: "shot", header: "shot" }, { key: "location", header: "location" }, { key: "issue", header: "issue" }]} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </WorkbenchFrame>
  );
}

export function TransitionsWorkbench({ projectId }: { projectId: string }) {
  const { workspace, error, notice, isBusy, run } = useWorkspace(projectId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transitionDrafts, setTransitionDrafts] = useState<Transition[] | null>(null);
  const transitions = workspace?.transitions ?? [];
  const displayedTransitions = transitionDrafts ?? transitions;
  const assets = workspace?.assets ?? [];
  const videoModels = modelCapabilities.videoModels.filter((model) => model.modes.includes("transition-video"));
  const rows = displayedTransitions.map((transition) => ({
    id: transition.id,
    from: transition.fromShotId,
    to: transition.toShotId,
    model: transition.videoModel,
    duration: transition.durationSeconds,
    status: transition.status,
  }));

  return (
    <WorkbenchFrame projectId={projectId} title="Transition Video：Shot A → Shot B" description="用相鄰 approved images 建立轉場 prompt，生成 transition clip 並加入 timeline。" current="transitions" workspace={workspace} error={error} notice={notice}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>轉場清單</CardTitle>
            <CardDescription>自動建立 Shot 1 → Shot 2、Shot 2 → Shot 3。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/transitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-adjacent" }) }), "已建立相鄰轉場草稿。")}>建立相鄰轉場</Button>
              <Button variant="outline" disabled={!displayedTransitions.length || isBusy} onClick={() => setTransitionDrafts(displayedTransitions)}>
                編輯 prompts
              </Button>
              <Button variant="outline" disabled={!transitionDrafts || isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/transitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", transitions: displayedTransitions }) }), "轉場 prompt / 模型設定已保存。")}>
                保存轉場設定
              </Button>
              <Button variant="outline" disabled={!selectedIds.length || isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/transitions/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transitionIds: selectedIds }) }), "已生成選取轉場影片紀錄。")}>生成選取轉場</Button>
              <Button variant="outline" disabled={isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/transitions/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allPending: true }) }), "已生成全部等待中的轉場紀錄。")}>生成全部待處理轉場</Button>
            </div>
            <div className="grid gap-3">
              {displayedTransitions.map((transition) => {
                const asset = assets.find((item) => item.id === transition.approvedVideoAssetId);
                const selected = selectedIds.includes(transition.id);
                const updateTransition = (patch: Partial<Transition>) => {
                  setTransitionDrafts((current) =>
                    (current ?? displayedTransitions).map((item) =>
                      item.id === transition.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
                    ),
                  );
                };
                return (
                  <div key={transition.id} className={`rounded-2xl border bg-white/55 p-4 ${selected ? "dream-selected" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm font-medium">
                        <input className="sky-checkbox" type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? current.concat(transition.id) : current.filter((id) => id !== transition.id))} />
                        {transition.fromShotId} → {transition.toShotId}
                      </label>
                      <StatusBadge status={transition.status} />
                    </div>
                    {transitionDrafts ? (
                      <div className="mt-3 grid gap-3">
                        <Textarea rows={4} value={transition.transitionPromptEn} onChange={(event) => updateTransition({ transitionPromptEn: event.target.value })} />
                        <Textarea rows={3} value={transition.transitionPromptZh} onChange={(event) => updateTransition({ transitionPromptZh: event.target.value })} />
                        <div className="grid gap-2 md:grid-cols-3">
                          <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={transition.videoModel} onChange={(event) => updateTransition({ videoModel: event.target.value })}>
                            {videoModels.map((model) => <option key={model.id} value={model.id}>{model.displayName ?? model.name ?? model.id}</option>)}
                          </select>
                          <Input value={transition.cameraMotion} onChange={(event) => updateTransition({ cameraMotion: event.target.value })} />
                          <Input type="number" min={1} max={12} value={transition.durationSeconds} onChange={(event) => updateTransition({ durationSeconds: Number(event.target.value) })} />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">{transition.transitionPromptEn}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{transition.videoModel} · {transition.durationSeconds}s · {asset?.filename ?? "尚無已確認片段"}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <aside className="flex flex-col gap-4">
          <StatCard title="Transitions" value={String(displayedTransitions.length)} description="Shot A → Shot B clips" icon={WaypointsIcon} />
          <StatCard title="Approved Clips" value={String(displayedTransitions.filter((item) => item.status === "approved").length)} description="ready for timeline" icon={CheckIcon} />
          <Card>
            <CardHeader><CardTitle>表格預覽</CardTitle></CardHeader>
            <CardContent><DataTable rows={rows} columns={[{ key: "id", header: "id" }, { key: "from", header: "from" }, { key: "to", header: "to" }, { key: "status", header: "status" }]} /></CardContent>
          </Card>
        </aside>
      </div>
    </WorkbenchFrame>
  );
}

export function GalleryWorkbench({ projectId }: { projectId: string }) {
  const { workspace, error, notice, isBusy, run } = useWorkspace(projectId);
  const [filter, setFilter] = useState("all");
  const [galleryQuery, setGalleryQuery] = useState("");
  const assets = workspace?.assets ?? [];
  const gallery = workspace?.galleryItems ?? [];
  const rows = gallery
    .filter((item) => filter === "all" || item.type === filter || (filter === "favorite" && item.favorite))
    .map((item) => {
      const asset = assets.find((candidate) => candidate.id === item.assetId);
      return { ...item, filename: asset?.filename ?? "", model: asset?.model ?? "", status: asset?.status ?? "" };
    })
    .filter((item) => !galleryQuery || JSON.stringify(item).toLowerCase().includes(galleryQuery.toLowerCase()));

  return (
    <WorkbenchFrame projectId={projectId} title="素材庫" description="集中管理參考圖、生成圖片、影片、轉場影片與匯出檔案。" current="gallery" workspace={workspace} error={error} notice={notice}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>素材瀑布流</CardTitle>
            <CardDescription>依類型、收藏、標籤與模型篩選，查看素材來源與提示詞摘要。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "全部"],
                ["image", "圖片"],
                ["video", "影片"],
                ["reference", "參考圖"],
                ["export", "匯出"],
                ["favorite", "收藏"],
              ].map(([value, label]) => (
                <Button key={value} variant={filter === value ? "secondary" : "outline"} onClick={() => setFilter(value)}>{label}</Button>
              ))}
              <Button disabled={isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/gallery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) }), "Gallery index 已同步。")}>同步素材庫</Button>
            </div>
            <Input placeholder="搜尋分鏡、角色、場景、模型、狀態、標籤或提示詞" value={galleryQuery} onChange={(event) => setGalleryQuery(event.target.value)} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((item) => {
                const asset = assets.find((candidate) => candidate.id === item.assetId);
                return (
                  <Card key={item.id} className={item.favorite ? "dream-selected" : ""}>
                    <CardHeader>
                      <CardTitle className="text-base">{item.filename || item.assetId}</CardTitle>
                      <CardDescription>{item.type} · {item.model}</CardDescription>
                      <CardAction><StatusBadge status={item.status || "pending"} /></CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {asset?.url && asset.type === "generated_image" ? <img src={asset.url} alt={asset.filename} className="rounded-xl border" /> : <div className="rounded-xl border bg-white/50 p-5 text-sm text-muted-foreground">{asset?.promptSnapshot?.slice(0, 160) || "尚無提示詞摘要"}</div>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => run(() => fetchJson(`/api/projects/${projectId}/gallery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favorite", galleryItemId: item.id, favorite: !item.favorite }) }), item.favorite ? "已取消收藏。" : "已加入收藏。")}>
                          <StarIcon data-icon="inline-start" aria-hidden="true" />
                          {item.favorite ? "取消收藏" : "加入收藏"}
                        </Button>
                        {asset ? <Button size="sm" variant="outline" onClick={() => downloadBlob(asset.filename, JSON.stringify(asset, null, 2), "application/json;charset=utf-8")}>下載</Button> : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <aside className="flex flex-col gap-4">
          <StatCard title="素材數" value={String(gallery.length)} description="由任務素材同步" icon={GalleryHorizontalEndIcon} />
          <StatCard title="收藏數" value={String(gallery.filter((item) => item.favorite).length)} description="手動標記的素材" icon={StarIcon} />
          <Button variant="outline" disabled={!assets.length} onClick={() => downloadZip(`${slugify(workspace!.project.name)}_gallery_${timeStamp()}.zip`, assetDownloadFiles(assets, "gallery"))}>下載素材 ZIP</Button>
        </aside>
      </div>
    </WorkbenchFrame>
  );
}

export function LogsDashboardWorkbench({ projectId }: { projectId: string }) {
  const { workspace, error, notice, isBusy, run } = useWorkspace(projectId);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const logs = workspace?.studioLogs ?? [];
  const rows = logs
    .filter((log) => stage === "all" || log.stage === stage)
    .filter((log) => !query || JSON.stringify(log).toLowerCase().includes(query.toLowerCase()))
    .toReversed()
    .map((log) => ({
      time: log.time,
      stage: log.stage,
      action: log.action,
      model: log.model ?? "",
      input_summary: log.inputSummary,
      output_summary: log.outputSummary,
      status: log.status,
      error: log.error ?? "",
      cost: log.cost,
      duration: log.durationMs,
    }));
  const stages = ["all", ...Array.from(new Set(logs.map((log) => log.stage)))];

  return (
    <WorkbenchFrame projectId={projectId} title="操作紀錄" description="追蹤文本、腳本、分鏡、圖片、影片、轉場、匯出、API 錯誤與模型切換紀錄。" current="logs" workspace={workspace} error={error} notice={notice}>
      <Card>
        <CardHeader>
          <CardTitle>紀錄</CardTitle>
          <CardDescription>支援搜尋、篩選、匯出 CSV/XLSX 與清除。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_16rem_auto_auto_auto]">
            <Input placeholder="搜尋動作、模型或錯誤..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={stage} onChange={(event) => setStage(event.target.value)}>
              {stages.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Button variant="outline" disabled={!rows.length} onClick={() => downloadBlob(`${slugify(workspace!.project.name)}_logs_${timeStamp()}.csv`, toCsv(rows), "text/csv;charset=utf-8")}>CSV</Button>
            <Button variant="outline" disabled={!rows.length} onClick={() => downloadXlsx(`${slugify(workspace!.project.name)}_logs_${timeStamp()}.xlsx`, rows, "logs")}>XLSX</Button>
            <Button variant="outline" disabled={isBusy || !logs.length} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/logs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) }), "Logs 已清除。")}>清除 logs</Button>
          </div>
          <DataTable rows={rows} columns={[
            { key: "time", header: "時間" },
            { key: "stage", header: "階段" },
            { key: "action", header: "動作" },
            { key: "model", header: "模型" },
            { key: "status", header: "狀態" },
            { key: "cost", header: "費用" },
            { key: "duration", header: "耗時" },
          ]} />
        </CardContent>
      </Card>
    </WorkbenchFrame>
  );
}

export function TimelineEditorWorkbench({ projectId }: { projectId: string }) {
  const { workspace, error, notice, isBusy, run } = useWorkspace(projectId);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const currentTimeline = timeline ?? workspace?.timeline ?? null;

  function moveItem(trackId: string, itemId: string, direction: -1 | 1) {
    if (!currentTimeline) return;
    setTimeline({
      ...currentTimeline,
      tracks: currentTimeline.tracks.map((track) => {
        if (track.id !== trackId) return track;
        const items = [...track.items];
        const index = items.findIndex((item) => item.id === itemId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return track;
        [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
        return { ...track, items };
      }),
    });
  }

  function updateItem(trackId: string, itemId: string, patch: Partial<TimelineItem>) {
    if (!currentTimeline) return;
    setTimeline({
      ...currentTimeline,
      tracks: currentTimeline.tracks.map((track) =>
        track.id === trackId
          ? { ...track, items: track.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) }
          : track,
      ),
    });
  }

  async function saveTimeline() {
    if (!currentTimeline) return;
    await fetchJson(`/api/projects/${projectId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", timeline: currentTimeline }),
    });
  }

  return (
    <WorkbenchFrame projectId={projectId} title="時間軸編輯" description="依分鏡順序排列影片與轉場，支援簡易排序、起訖時間與合併輸出紀錄。" current="timeline" workspace={workspace} error={error} notice={notice}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>軌道</CardTitle>
            <CardDescription>影片、轉場、音訊與字幕軌道。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button disabled={isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/timeline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "auto-build" }) }), "時間軸已依分鏡順序自動排列。")}>自動排列</Button>
              <Button variant="outline" disabled={!currentTimeline || isBusy} onClick={() => run(saveTimeline, "時間軸已保存。")}>保存排序</Button>
              <Button variant="outline" disabled={!currentTimeline || isBusy} onClick={() => run(() => fetchJson(`/api/projects/${projectId}/timeline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mock-export" }) }), "已建立合併輸出紀錄。")}>建立合併輸出紀錄</Button>
            </div>
            {(currentTimeline?.tracks ?? []).map((track: TimelineTrack) => (
              <div key={track.id} className="rounded-2xl border bg-white/55 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{track.type} track</h3>
                  <span className="text-sm text-muted-foreground">{track.items.length} items</span>
                </div>
                <div className="flex flex-col gap-2">
                  {track.items.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-xl border bg-background/70 p-3 md:grid-cols-[1fr_6rem_6rem_auto_auto]">
                      <span className="text-sm">{item.shotId ?? item.transitionId ?? item.assetId}</span>
                      <Input type="number" value={item.startTime} onChange={(event) => updateItem(track.id, item.id, { startTime: Number(event.target.value) })} />
                      <Input type="number" value={item.endTime} onChange={(event) => updateItem(track.id, item.id, { endTime: Number(event.target.value) })} />
                      <Button size="sm" variant="outline" onClick={() => moveItem(track.id, item.id, -1)}>上移</Button>
                      <Button size="sm" variant="outline" onClick={() => moveItem(track.id, item.id, 1)}>下移</Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!currentTimeline ? <p className="text-sm text-muted-foreground">尚未建立 timeline，請先自動排列。</p> : null}
          </CardContent>
        </Card>
        <aside className="flex flex-col gap-4">
          <StatCard title="總長度" value={`${currentTimeline?.durationSeconds ?? 0}s`} description="依目前時間軸計算" icon={LayersIcon} />
          <StatCard title="匯出狀態" value={currentTimeline?.exportStatus ?? "draft"} description="目前輸出紀錄狀態" icon={DownloadIcon} />
          <Card>
            <CardHeader><CardTitle>時間軸摘要</CardTitle></CardHeader>
            <CardContent className="rounded-2xl border bg-white/55 p-5 text-sm text-muted-foreground">
              這裡依軌道順序整理已確認影片與轉場片段。若尚未接上播放器，僅顯示序列資料與輸出狀態。
            </CardContent>
          </Card>
        </aside>
      </div>
    </WorkbenchFrame>
  );
}

export function ModelSettingsWorkbench() {
  const [settings, setSettings] = useState<ProviderSetting[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function load() {
    const payload = await fetchJson<{ settings: ProviderSetting[] }>("/api/settings/models");
    setSettings(payload.settings);
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ settings: ProviderSetting[] }>("/api/settings/models")
      .then((payload) => {
        if (!cancelled) setSettings(payload.settings);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "讀取模型設定失敗");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<void>, success: string) {
    setIsBusy(true);
    setError("");
    try {
      await action();
      setNotice(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失敗");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">API 與模型設定</h1>
        <p className="mt-2 text-muted-foreground">管理 OpenAI、Gemini、Vertex AI、xAI 與本機 ComfyUI 端點；這裡只保存遮罩後的金鑰欄位。</p>
      </div>
      {error ? <Alert variant="destructive"><AlertTitle>錯誤</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {notice ? <Alert><CheckIcon aria-hidden="true" /><AlertTitle>狀態更新</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>API 金鑰與端點</CardTitle>
            <CardDescription>請填入服務商金鑰或本機端點。此工具不需要登入、註冊或積分設定。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {settings.map((setting, index) => (
              <div key={setting.id} className="grid gap-3 rounded-2xl border bg-white/55 p-4 md:grid-cols-[10rem_1fr_7rem_8rem_auto]">
                <div className="font-medium">{setting.provider}</div>
                <Input
                  placeholder="sk-... / endpoint"
                  value={setting.maskedKey ?? ""}
                  onChange={(event) => setSettings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, maskedKey: event.target.value } : item))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input className="sky-checkbox" type="checkbox" checked={setting.enabled} onChange={(event) => setSettings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} />
                  啟用
                </label>
                <Input type="number" value={setting.priority} onChange={(event) => setSettings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, priority: Number(event.target.value) } : item))} />
                <Button variant="outline" disabled={isBusy} onClick={() => run(() => fetchJson("/api/settings/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", provider: setting.provider }) }), `${setting.provider} 連線測試完成。`)}>
                  測試
                </Button>
              </div>
            ))}
            <Button disabled={isBusy} onClick={() => run(() => fetchJson("/api/settings/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", settings }) }), "API 設定已保存。")}>
              <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
              保存模型設定
            </Button>
          </CardContent>
        </Card>
        <aside className="flex flex-col gap-4">
          <StatCard title="圖片模型" value={String(modelCapabilities.imageModels.length)} description="目前可選圖片模型" icon={SparklesIcon} />
          <StatCard title="影片模型" value={String(modelCapabilities.videoModels.length)} description="目前可選影片模型" icon={WaypointsIcon} />
          <Card>
            <CardHeader><CardTitle>模型切換規則</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              當主要模型失敗時，系統會重試一次，再依設定切換到備援模型。所有切換都會寫入操作紀錄。
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
