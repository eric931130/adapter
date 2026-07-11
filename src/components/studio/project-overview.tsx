import Link from "next/link";
import {
  BadgeDollarSignIcon,
  ClapperboardIcon,
  FileTextIcon,
  ImageIcon,
  ListChecksIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";

import { JobsTable } from "@/components/studio/jobs-table";
import { StatCard } from "@/components/studio/stat-card";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReturnTypeOfProjectBundle } from "@/lib/types";

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0078ff] px-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(0,120,255,0.22)] transition hover:-translate-y-0.5"
    >
      {children}
    </Link>
  );
}

export function ProjectOverview({ bundle }: { bundle: ReturnTypeOfProjectBundle }) {
  const projectUrl = `/projects/${bundle.project.id}`;
  const approvedSegments = bundle.segments.filter((segment) => segment.approved).length;
  const approvedScripts = bundle.scripts.filter((script) => script.approved).length;
  const approvedShots = bundle.shots.filter((shot) => shot.approved).length;
  const characterReady = bundle.characters.filter((character) => character.fixedPromptEn && character.lockedReferenceAssetId).length;
  const environmentReady = bundle.environments.filter((environment) => environment.fixedPromptEn && environment.referenceAssetIds.length).length;
  const approvedImages = bundle.assets.filter((asset) => asset.type === "generated_image" && asset.status === "approved").length;
  const approvedVideos = bundle.assets.filter((asset) => asset.type === "generated_video" && asset.status === "approved").length;
  const approvedTransitions = bundle.transitions.filter((transition) => transition.status === "approved").length;
  const failedJobs = bundle.generationJobs.filter((job) => job.status === "failed").length;
  const totalCost = bundle.generationJobs.reduce(
    (sum, job) => sum + (job.actualCost ?? job.estimatedCost),
    0,
  );
  const nextHref = bundle.timeline
    ? `${projectUrl}/exports`
    : bundle.shots.length
      ? `${projectUrl}/images`
      : `${projectUrl}/text`;
  const nextLabel = bundle.timeline ? "前往匯出" : bundle.shots.length ? "繼續生成" : "開始處理文本";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {bundle.project.name}
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {bundle.project.description || "尚未填寫任務說明。"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={bundle.project.status} />
            <ActionLink href={nextHref}>{nextLabel}</ActionLink>
          </div>
        </div>
        <WorkflowStepper status={bundle.project.status} projectId={bundle.project.id} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1.15fr_1.15fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon aria-hidden="true" />
              1. 文本與腳本
            </CardTitle>
            <CardDescription>匯入文本、拆段、產生 SEO 與腳本。</CardDescription>
            <CardAction><ActionLink href={`${projectUrl}/text`}>前往</ActionLink></CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border bg-white/55 p-3">
              <div className="text-2xl font-semibold">{approvedSegments}/{bundle.segments.length}</div>
              <div className="text-sm text-muted-foreground">已確認段落</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border bg-white/50 p-3">SEO：{bundle.seoPackage?.approved ? "已確認" : "未確認"}</div>
              <div className="rounded-xl border bg-white/50 p-3">腳本：{approvedScripts}/{bundle.scripts.length}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClapperboardIcon aria-hidden="true" />
              2. 分鏡與素材
            </CardTitle>
            <CardDescription>分鏡、角色一致性、場景一致性與圖片。</CardDescription>
            <CardAction><ActionLink href={`${projectUrl}/shots`}>前往</ActionLink></CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border bg-white/55 p-3">
              <div className="text-2xl font-semibold">{approvedShots}/{bundle.shots.length}</div>
              <div className="text-sm text-muted-foreground">已確認分鏡</div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border bg-white/50 p-3">角色 {characterReady}/{bundle.characters.length}</div>
              <div className="rounded-xl border bg-white/50 p-3">場景 {environmentReady}/{bundle.environments.length}</div>
              <div className="rounded-xl border bg-white/50 p-3">圖片 {approvedImages}/{bundle.shots.length}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VideoIcon aria-hidden="true" />
              3. 影片與匯出
            </CardTitle>
            <CardDescription>生成影片、建立轉場、整理時間軸與匯出檔案。</CardDescription>
            <CardAction><ActionLink href={`${projectUrl}/videos`}>前往</ActionLink></CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border bg-white/55 p-3">
              <div className="text-2xl font-semibold">{approvedVideos}/{bundle.shots.length}</div>
              <div className="text-sm text-muted-foreground">已確認影片</div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border bg-white/50 p-3">轉場 {approvedTransitions}/{Math.max(0, bundle.shots.length - 1)}</div>
              <div className="rounded-xl border bg-white/50 p-3">時間軸 {bundle.timeline?.exportStatus ?? "未建立"}</div>
              <div className="rounded-xl border bg-white/50 p-3">素材 {bundle.assets.length}</div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <StatCard
            title="即時費用"
            value={`$${totalCost.toFixed(2)}`}
            description={`提醒上限 $${bundle.project.costLimit.toFixed(2)}`}
            icon={BadgeDollarSignIcon}
          />
          <StatCard title="失敗紀錄" value={String(failedJobs)} description="可到用量頁重新排程" icon={ListChecksIcon} />
          <StatCard title="下一步" value={nextLabel} description="依目前任務進度判斷" icon={SparklesIcon} />
        </div>
      </div>

      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>工具檢查</CardTitle>
          <CardDescription>
            這裡只列出會影響後續操作的必要檢查，避免放沒有功能的展示內容。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Link href={`${projectUrl}/jobs`} className="rounded-lg border bg-muted/40 p-3 text-sm font-medium hover:bg-muted/70">
            API 用量與費用紀錄
          </Link>
          <Link href={`${projectUrl}/exports`} className="rounded-lg border bg-muted/40 p-3 text-sm font-medium hover:bg-muted/70">
            匯出資料與成本報表
          </Link>
          <Link href={`${projectUrl}/text`} className="rounded-lg border bg-muted/40 p-3 text-sm font-medium hover:bg-muted/70">
            回到文本工作台
          </Link>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">API 用量紀錄</h2>
          <Link href={`${projectUrl}/jobs`} className="inline-flex items-center gap-2 text-sm font-bold text-[#0078ff] hover:underline">
            查看完整紀錄
            <ImageIcon aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <JobsTable jobs={bundle.generationJobs.slice(0, 8)} />
      </section>
    </div>
  );
}
