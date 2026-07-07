"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityIcon, CheckIcon, RefreshCcwIcon, SearchIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react";

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "請求失敗");
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
        setError(caught instanceof Error ? caught.message : "讀取任務中心失敗");
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
  const failedJobs = jobs.filter((job) => job.status === "failed");

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
      setError(caught instanceof Error ? caught.message : "任務操作失敗");
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
        <h1 className="text-3xl font-semibold tracking-tight">任務與成本紀錄</h1>
        <p className="mt-2 text-muted-foreground">追蹤 GenerationJob、錯誤、成本、版本狀態與全專案健康檢查。</p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "draft"} current="jobs" projectId={projectId} />
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
        <StatCard title="Health Score" value={health ? String(health.healthScore) : "-"} description="errors/warnings 扣分" icon={ShieldCheckIcon} />
        <StatCard title="Total Jobs" value={String(jobs.length)} description="所有 GenerationJob" icon={ActivityIcon} />
        <StatCard title="Failed" value={String(failedJobs.length)} description="可重新排隊" icon={XCircleIcon} />
        <StatCard title="Total Cost" value={`$${totalCost.toFixed(2)}`} description={`limit $${workspace?.project.costLimit.toFixed(2) ?? "0.00"}`} icon={SearchIcon} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>篩選</CardTitle>
              <CardDescription>type / provider / model / status / shot_id / date range。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
                      <option value="">全部</option>
                      <option value="text_analysis">text_analysis</option>
                      <option value="prompt_generation">prompt_generation</option>
                      <option value="image">image</option>
                      <option value="video">video</option>
                      <option value="export">export</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Provider</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}>
                      <option value="">全部</option>
                      <option value="openai">openai</option>
                      <option value="google">google</option>
                      <option value="xai">xai</option>
                      <option value="local">local</option>
                      <option value="mock">mock</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                      <option value="">全部</option>
                      <option value="pending">pending</option>
                      <option value="queued">queued</option>
                      <option value="running">running</option>
                      <option value="success">success</option>
                      <option value="failed">failed</option>
                      <option value="expired">expired</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Model</FieldLabel>
                    <Input value={filters.model} onChange={(event) => setFilters({ ...filters, model: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Shot ID</FieldLabel>
                    <Input value={filters.shotId} onChange={(event) => setFilters({ ...filters, shotId: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>From</FieldLabel>
                    <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>To</FieldLabel>
                    <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>任務中心</CardTitle>
              <CardDescription>{filteredJobs.length} 筆符合篩選。</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={jobRows(filteredJobs)}
                columns={[
                  { key: "job_id", header: "job_id", render: (row) => <Button type="button" variant="ghost" onClick={() => setSelectedJobId(String(row.job_id))}>{String(row.job_id)}</Button> },
                  { key: "type", header: "type" },
                  { key: "provider", header: "provider" },
                  { key: "model", header: "model" },
                  { key: "mode", header: "mode" },
                  { key: "shot_id", header: "shot_id" },
                  { key: "status", header: "status", render: (row) => <StatusBadge status={String(row.status)} /> },
                  { key: "estimated_cost", header: "estimated" },
                  { key: "actual_cost", header: "actual" },
                  { key: "retry_count", header: "retry" },
                  { key: "created_at", header: "created_at" },
                  { key: "completed_at", header: "completed_at" },
                  { key: "error_message", header: "error" },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>任務操作</CardTitle>
              <CardDescription>{selectedJob?.id ?? "尚未選擇任務"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={!selectedJob || selectedJob.status !== "failed" || isBusy} onClick={() => postJobAction({ action: "requeue", jobId: selectedJob!.id }, "failed job 已重新排隊。")}>
                <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                重新排隊 failed job
              </Button>
              <Button type="button" variant="outline" disabled={!selectedJob || !["pending", "queued"].includes(selectedJob.status) || isBusy} onClick={() => postJobAction({ action: "cancel", jobId: selectedJob!.id }, "pending job 已取消。")}>
                <XCircleIcon data-icon="inline-start" aria-hidden="true" />
                取消 pending job
              </Button>
              <Textarea readOnly rows={12} value={payloadText(selectedJob)} />
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>成本限制</CardTitle>
              <CardDescription>建立任務前會檢查 costLimit。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Input type="number" min={0} value={costLimit} onChange={(event) => setCostLimit(Number(event.target.value))} />
              <Button type="button" disabled={isBusy} onClick={() => postJobAction({ action: "update-cost-limit", costLimit }, "costLimit 已更新。")}>調整 costLimit</Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>全專案健康檢查</CardTitle>
              <CardDescription>指出缺漏、風險與建議。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button type="button" variant="outline" onClick={runHealthCheck}>
                <ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
                重新執行健康檢查
              </Button>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">Errors</div>
                {(health?.errors.length ? health.errors : ["沒有阻斷錯誤。"]).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">Warnings</div>
                {(health?.warnings.length ? health.warnings : ["沒有警告。"]).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">Suggestions</div>
                {(health?.suggestions.length ? health.suggestions : ["目前不需要額外建議。"]).map((item) => <p key={item} className="text-muted-foreground">{item}</p>)}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
