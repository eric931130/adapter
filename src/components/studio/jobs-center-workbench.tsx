"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityIcon, AlertCircleIcon, CheckIcon, DollarSignIcon, RefreshCcwIcon, SearchIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react";

import { DataTable } from "@/components/studio/data-table";
import { StatCard } from "@/components/studio/stat-card";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { jobRows } from "@/lib/export-utils";
import type { GenerationJob } from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";

type HealthResult = {
  healthScore: number;
  errors: string[];
  warnings: string[];
  suggestions: string[];
};

const typeLabels: Record<string, string> = {
  text_analysis: "文本分析",
  prompt_generation: "提示詞生成",
  image: "圖片生成",
  video: "影片生成",
  transition: "轉場生成",
  export: "匯出",
};

const statusOptions = [
  ["", "全部"],
  ["pending", "等待中"],
  ["queued", "排隊中"],
  ["running", "執行中"],
  ["success", "成功"],
  ["failed", "失敗"],
  ["expired", "已過期"],
  ["cancelled", "已取消"],
] as const;

const typeOptions = [
  ["", "全部"],
  ["text_analysis", "文本分析"],
  ["prompt_generation", "提示詞生成"],
  ["image", "圖片生成"],
  ["video", "影片生成"],
  ["transition", "轉場生成"],
  ["export", "匯出"],
] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.userMessage ?? payload.error ?? "操作失敗。");
  return payload as T;
}

export function JobsCenterWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [filters, setFilters] = useState({ type: "", provider: "", model: "", status: "", shotId: "", from: "", to: "" });
  const [selectedJobId, setSelectedJobId] = useState("");
  const [costLimit, setCostLimit] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadWorkspace() {
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    setCostLimit(bundle.project.costLimit);
  }

  async function runHealthCheck() {
    const result = await fetchJson<HealthResult>(`/api/projects/${projectId}/health`);
    setHealth(result);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`),
      fetchJson<HealthResult>(`/api/projects/${projectId}/health`),
    ])
      .then(([bundle, result]) => {
        if (cancelled) return;
        setWorkspace(bundle);
        setCostLimit(bundle.project.costLimit);
        setHealth(result);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取用量紀錄失敗。");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const jobs = workspace?.generationJobs ?? [];
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (filters.type && job.type !== filters.type) return false;
      if (filters.provider && job.provider !== filters.provider) return false;
      if (filters.model && !job.model.toLowerCase().includes(filters.model.toLowerCase())) return false;
      if (filters.status && job.status !== filters.status) return false;
      if (filters.shotId && !(job.shotId ?? "").toLowerCase().includes(filters.shotId.toLowerCase())) return false;
      if (filters.from && new Date(job.createdAt) < new Date(filters.from)) return false;
      if (filters.to && new Date(job.createdAt) > new Date(filters.to)) return false;
      return true;
    });
  }, [filters, jobs]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? filteredJobs[0];
  const totalCost = jobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
  const filteredCost = filteredJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost), 0);
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const runningJobs = jobs.filter((job) => ["pending", "queued", "running"].includes(job.status));

  async function postJobAction(body: Record<string, unknown>, successMessage: string) {
    setIsBusy(true);
    setError("");
    try {
      await fetchJson(`/api/projects/${projectId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(successMessage);
      await loadWorkspace();
      await runHealthCheck();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新紀錄失敗。");
    } finally {
      setIsBusy(false);
    }
  }

  function payloadText(job: GenerationJob | undefined) {
    if (!job) return "";
    return JSON.stringify(
      {
        inputPayload: job.inputPayload,
        outputPayload: job.outputPayload ?? null,
        errorMessage: job.errorMessage ?? null,
      },
      null,
      2,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">API 用量與即時費用</h1>
        <p className="mt-2 text-muted-foreground">
          追蹤每次文本、圖片、影片、轉場與匯出工作。這裡顯示的是成本紀錄，不是積分或會員方案。
        </p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "draft"} current="jobs" projectId={projectId} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>發生錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <CheckIcon aria-hidden="true" />
          <AlertTitle>已更新</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="總費用" value={`$${totalCost.toFixed(2)}`} description={`提醒上限 $${workspace?.project.costLimit.toFixed(2) ?? "0.00"}`} icon={DollarSignIcon} />
        <StatCard title="篩選後費用" value={`$${filteredCost.toFixed(2)}`} description={`${filteredJobs.length} 筆符合條件`} icon={SearchIcon} />
        <StatCard title="進行中" value={String(runningJobs.length)} description="等待、排隊或執行中的紀錄" icon={ActivityIcon} />
        <StatCard title="失敗" value={String(failedJobs.length)} description="可選取後重新排程" icon={AlertCircleIcon} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>篩選紀錄</CardTitle>
              <CardDescription>依類型、服務商、模型、狀態、分鏡與日期查看費用。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field>
                    <FieldLabel>類型</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
                      {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>服務商</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}>
                      <option value="">全部</option>
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                      <option value="xai">xAI</option>
                      <option value="local">本機</option>
                      <option value="mock">模擬</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>狀態</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                      {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>模型</FieldLabel>
                    <Input value={filters.model} onChange={(event) => setFilters({ ...filters, model: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel>分鏡 ID</FieldLabel>
                    <Input value={filters.shotId} onChange={(event) => setFilters({ ...filters, shotId: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>起始日期</FieldLabel>
                    <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>結束日期</FieldLabel>
                    <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>API 呼叫明細</CardTitle>
              <CardDescription>{filteredJobs.length} 筆紀錄，費用合計 ${filteredCost.toFixed(2)}</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={jobRows(filteredJobs).map((row) => ({ ...row, type_label: typeLabels[String(row.type)] ?? row.type }))}
                columns={[
                  { key: "job_id", header: "紀錄", render: (row) => <Button type="button" variant="ghost" onClick={() => setSelectedJobId(String(row.job_id))}>{String(row.job_id)}</Button> },
                  { key: "type_label", header: "類型" },
                  { key: "provider", header: "服務商" },
                  { key: "model", header: "模型" },
                  { key: "mode", header: "模式" },
                  { key: "shot_id", header: "分鏡" },
                  { key: "status", header: "狀態", render: (row) => <StatusBadge status={String(row.status)} /> },
                  { key: "estimated_cost", header: "預估" },
                  { key: "actual_cost", header: "實際" },
                  { key: "retry_count", header: "重試" },
                  { key: "created_at", header: "建立時間" },
                  { key: "completed_at", header: "完成時間" },
                  { key: "error_message", header: "錯誤" },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>選取紀錄</CardTitle>
              <CardDescription>{selectedJob?.id ?? "尚未選取紀錄"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={!selectedJob || selectedJob.status !== "failed" || isBusy} onClick={() => postJobAction({ action: "requeue", jobId: selectedJob!.id }, "失敗紀錄已重新排程。")}>
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                重新排程失敗紀錄
              </Button>
              <Button type="button" variant="outline" disabled={!selectedJob || !["pending", "queued"].includes(selectedJob.status) || isBusy} onClick={() => postJobAction({ action: "cancel", jobId: selectedJob!.id }, "等待中的紀錄已取消。")}>
                <XCircleIcon data-icon="inline-start" aria-hidden="true" />
                取消等待中的紀錄
              </Button>
              <Textarea readOnly rows={12} value={payloadText(selectedJob)} />
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>費用提醒上限</CardTitle>
              <CardDescription>用來避免生成成本超出預期，不是積分額度。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Input type="number" min={0} value={costLimit} onChange={(event) => setCostLimit(Number(event.target.value))} />
              <Button type="button" disabled={isBusy} onClick={() => postJobAction({ action: "update-cost-limit", costLimit }, "費用提醒上限已更新。")}>更新費用上限</Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>任務健康檢查</CardTitle>
              <CardDescription>檢查缺少素材、失敗紀錄與費用超標。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button type="button" variant="outline" onClick={runHealthCheck}>
                <ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
                重新檢查
              </Button>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">錯誤</div>
                {(health?.errors.length ? health.errors : ["目前沒有錯誤。"]).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">提醒</div>
                {(health?.warnings.length ? health.warnings : ["目前沒有提醒。"]).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">建議</div>
                {(health?.suggestions.length ? health.suggestions : ["目前沒有額外建議。"]).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
