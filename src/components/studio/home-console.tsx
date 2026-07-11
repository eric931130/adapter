"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  DollarSignIcon,
  FileTextIcon,
  FolderIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import type { LocalDb } from "@/lib/local-db";
import type { GenerationJob, Project } from "@/lib/schemas";

const projectStatusLabels: Record<Project["status"], string> = {
  draft: "草稿",
  text_ready: "文本完成",
  storyboard_ready: "分鏡完成",
  image_ready: "圖片完成",
  video_ready: "影片完成",
  completed: "已完成",
};

const projectStatusProgress: Record<Project["status"], number> = {
  draft: 8,
  text_ready: 30,
  storyboard_ready: 55,
  image_ready: 78,
  video_ready: 92,
  completed: 100,
};

const jobStatusLabels: Record<GenerationJob["status"], string> = {
  pending: "等待中",
  queued: "排隊中",
  running: "執行中",
  success: "成功",
  failed: "失敗",
  expired: "已過期",
  cancelled: "已取消",
};

const jobTypeLabels: Record<GenerationJob["type"], string> = {
  text_analysis: "文本分析",
  prompt_generation: "提示詞生成",
  image: "圖片 API",
  video: "影片 API",
  transition: "轉場 API",
  export: "匯出",
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/70 bg-white/58 shadow-[0_22px_48px_rgba(56,139,219,0.15)] backdrop-blur-2xl ${className}`}>
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof FolderIcon;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#5f7f9d]">{title}</p>
          <p className="mt-2 text-3xl font-black text-[#0b315e]">{value}</p>
          <p className="mt-1 text-xs font-semibold text-[#6f8aa3]">{note}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-xl bg-[#e6f3ff] text-[#0078ff]">
          <Icon aria-hidden="true" className="size-5" />
        </div>
      </div>
    </Panel>
  );
}

function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-[#9cc4e8] bg-white/45 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-[#4e7294]">{text}</p>
      {action}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#cbddeb]">
      <span className="block h-full rounded-full bg-[#1689ff]" style={{ width: `${value}%` }} />
    </div>
  );
}

export function HomeConsole({ db }: { db: LocalDb }) {
  const recentProjects = useMemo(
    () => [...db.projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6),
    [db.projects],
  );

  const recentJobs = useMemo(
    () => [...db.generationJobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8),
    [db.generationJobs],
  );

  const totalCost = db.generationJobs.reduce((sum, job) => sum + (job.actualCost ?? job.estimatedCost ?? 0), 0);
  const runningJobs = db.generationJobs.filter((job) => job.status === "running" || job.status === "queued").length;
  const failedJobs = db.generationJobs.filter((job) => job.status === "failed").length;
  const avgCost = db.generationJobs.length ? totalCost / db.generationJobs.length : 0;

  const projectNameById = (projectId: string) =>
    db.projects.find((project) => project.id === projectId)?.name ?? "未命名任務";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-32px)] max-w-[1440px] gap-4">
      <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/55 p-6 shadow-[0_22px_48px_rgba(56,139,219,0.14)] backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#1477d9]">影片生成工具</p>
          <h1 className="mt-2 text-4xl font-black leading-tight text-[#0b315e]">從文本到分鏡、圖片、影片與費用紀錄</h1>
          <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[#315e86]">
            這裡是工作台，不是產品官網。所有入口都直接進入可操作流程，並即時顯示 API 呼叫量、失敗數與預估費用。
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/80 bg-[linear-gradient(180deg,#48b9ff,#007bff)] px-5 font-bold text-white shadow-[0_12px_28px_rgba(0,124,255,0.28)] transition hover:-translate-y-0.5"
        >
          <PlusIcon aria-hidden="true" className="size-5" />
          建立新任務
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="任務數" value={String(db.projects.length)} note="目前保存在工作區的任務" icon={FolderIcon} />
        <MetricCard title="API 呼叫紀錄" value={String(db.generationJobs.length)} note={`${runningJobs} 筆正在排隊或執行`} icon={ClockIcon} />
        <MetricCard title="即時預估費用" value={`$${totalCost.toFixed(2)}`} note={`平均每筆 $${avgCost.toFixed(2)}`} icon={DollarSignIcon} />
        <MetricCard title="需要處理" value={String(failedJobs)} note="失敗紀錄可到任務內重新排程" icon={AlertCircleIcon} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-[#0b315e]">近期任務</h2>
            <Link href="/projects/new" className="inline-flex items-center gap-1 text-sm font-bold text-[#1477d9] hover:underline">
              新增
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {recentProjects.length ? (
            <div className="grid gap-3">
              {recentProjects.map((project) => {
                const progress = projectStatusProgress[project.status] ?? 0;
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="grid gap-3 rounded-xl border border-white/70 bg-white/55 p-4 shadow-[0_12px_28px_rgba(56,139,219,0.1)] transition hover:-translate-y-0.5 hover:bg-white/75 md:grid-cols-[1fr_8rem]"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold text-[#123a64]">{project.name}</h3>
                      <p className="mt-1 line-clamp-1 text-sm font-medium text-[#6a86a1]">{project.description || "尚未填寫描述"}</p>
                      <div className="mt-3">
                        <ProgressBar value={progress} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 md:grid md:place-items-end">
                      <span className="rounded-full bg-[#e6f3ff] px-3 py-1 text-xs font-bold text-[#1477d9]">
                        {projectStatusLabels[project.status] ?? project.status}
                      </span>
                      <span className="text-xs font-semibold text-[#6a86a1]">{project.updatedAt.slice(0, 10)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              text="還沒有任務。建立一個任務後，就能開始貼上文本、切分段落並產生分鏡。"
              action={
                <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-xl bg-[#0078ff] px-4 py-2 text-sm font-bold text-white">
                  <PlusIcon aria-hidden="true" className="size-4" />
                  建立第一個任務
                </Link>
              }
            />
          )}
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-[#0b315e]">API 用量與費用</h2>
            <SparklesIcon aria-hidden="true" className="size-6 text-[#1689ff]" />
          </div>
          {recentJobs.length ? (
            <div className="grid gap-3">
              {recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/projects/${job.projectId}/jobs`}
                  className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border border-white/70 bg-white/55 p-3 shadow-[0_12px_28px_rgba(56,139,219,0.1)] transition hover:bg-white/75"
                >
                  <div className="grid size-11 place-items-center rounded-xl bg-[#e6f3ff] text-[#0078ff]">
                    {job.status === "success" ? <CheckCircle2Icon aria-hidden="true" className="size-5" /> : <FileTextIcon aria-hidden="true" className="size-5" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-extrabold text-[#123a64]">{jobTypeLabels[job.type] ?? job.type}</h3>
                    <p className="mt-1 truncate text-xs font-semibold text-[#7893aa]">{projectNameById(job.projectId)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#0b315e]">${(job.actualCost ?? job.estimatedCost ?? 0).toFixed(2)}</p>
                    <p className="text-xs font-bold text-[#607f9b]">{jobStatusLabels[job.status] ?? job.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="還沒有 API 呼叫紀錄。完成文本分析或生成任務後，這裡會顯示即時費用。" />
          )}
        </Panel>
      </section>
    </div>
  );
}
