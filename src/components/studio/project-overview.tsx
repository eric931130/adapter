import {
  BadgeDollarSignIcon,
  ClapperboardIcon,
  FileTextIcon,
  ListChecksIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";

import { JobsTable } from "@/components/studio/jobs-table";
import { ShotCard } from "@/components/studio/shot-card";
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

export function ProjectOverview({ bundle }: { bundle: ReturnTypeOfProjectBundle }) {
  const approvedSegments = bundle.segments.filter((segment) => segment.approved).length;
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {bundle.project.name}
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {bundle.project.description}
            </p>
          </div>
          <StatusBadge status={bundle.project.status} />
        </div>
        <WorkflowStepper status={bundle.project.status} projectId={bundle.project.id} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1.15fr_1.15fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon aria-hidden="true" />
              1 文本製作
            </CardTitle>
            <CardDescription>原稿 → 故事分析 → SEO → 正式劇本</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl border bg-white/55 p-3">
              <div className="text-2xl font-semibold">{approvedSegments}/{bundle.segments.length}</div>
              <div className="text-sm text-muted-foreground">已確認劇情片段</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border bg-white/50 p-3">SEO：{bundle.seoPackage?.approved ? "已確認" : "待確認"}</div>
              <div className="rounded-2xl border bg-white/50 p-3">劇本：{bundle.scripts.filter((script) => script.approved).length}/{bundle.scripts.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClapperboardIcon aria-hidden="true" />
              2 分鏡資產
            </CardTitle>
            <CardDescription>Shots → Character Bible → Environment Bible → Images</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl border bg-white/55 p-3">
              <div className="text-2xl font-semibold">{approvedShots}/{bundle.shots.length}</div>
              <div className="text-sm text-muted-foreground">已確認分鏡提示詞</div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border bg-white/50 p-3">角色 {characterReady}/{bundle.characters.length}</div>
              <div className="rounded-2xl border bg-white/50 p-3">場景 {environmentReady}/{bundle.environments.length}</div>
              <div className="rounded-2xl border bg-white/50 p-3">圖片 {approvedImages}/{bundle.shots.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VideoIcon aria-hidden="true" />
              3 影片生成
            </CardTitle>
            <CardDescription>Video → Transition → Timeline → Export</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl border bg-white/55 p-3">
              <div className="text-2xl font-semibold">{approvedVideos}/{bundle.shots.length}</div>
              <div className="text-sm text-muted-foreground">已核准分鏡影片</div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border bg-white/50 p-3">轉場 {approvedTransitions}/{Math.max(0, bundle.shots.length - 1)}</div>
              <div className="rounded-2xl border bg-white/50 p-3">時間線 {bundle.timeline?.exportStatus ?? "draft"}</div>
              <div className="rounded-2xl border bg-white/50 p-3">素材 {bundle.assets.length}</div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <StatCard
            title="成本"
            value={`$${totalCost.toFixed(2)}`}
            description={`上限 $${bundle.project.costLimit.toFixed(2)}`}
            icon={BadgeDollarSignIcon}
          />
          <StatCard title="失敗任務" value={String(failedJobs)} description="到任務中心處理" icon={ListChecksIcon} />
          <StatCard title="下一步" value={bundle.timeline ? "匯出" : bundle.shots.length ? "生成" : "文本"} description={bundle.timeline ? "檢查 Export Center" : "補齊目前階段"} icon={SparklesIcon} />
        </div>
      </div>
      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Pipeline Guardrails</CardTitle>
          <CardDescription>
            修改前一階段後，後續產物會標示可能過期，方便使用者決定是否重新生成。
          </CardDescription>
          <CardAction>
            <StatusBadge status="queued" />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {["Adapter 架構", "本地 mock queue", "JSON/SQLite 可升級"].map((item) => (
            <div key={item} className="rounded-lg border bg-muted/40 p-3 text-sm">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">近期分鏡</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {bundle.shots.slice(0, 2).map((shot) => (
            <ShotCard key={shot.id} shot={shot} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">任務紀錄</h2>
        <JobsTable jobs={bundle.generationJobs} />
      </section>
    </div>
  );
}
