import Link from "next/link";
import { ArrowRightIcon, ClockIcon, FilmIcon, ImageIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressCloudBar } from "@/components/studio/dream-components";
import { StatusBadge } from "@/components/studio/status-badge";
import type { Project } from "@/lib/schemas";

const progressByStatus: Record<Project["status"], number> = {
  draft: 12,
  text_ready: 32,
  storyboard_ready: 52,
  image_ready: 72,
  video_ready: 88,
  completed: 100,
};

const currentStage: Record<Project["status"], string> = {
  draft: "文本分析",
  text_ready: "SEO / 劇本",
  storyboard_ready: "圖片生成",
  image_ready: "影片生成",
  video_ready: "匯出下載",
  completed: "已完成",
};

export function ProjectCard({
  project,
  imageCount = 0,
  videoCount = 0,
  failedJobs = 0,
  thumbnail,
}: {
  project: Project;
  imageCount?: number;
  videoCount?: number;
  failedJobs?: number;
  thumbnail?: string;
}) {
  const progress = progressByStatus[project.status];

  return (
    <article className="dream-card overflow-hidden">
      <div className="grid min-h-full lg:grid-cols-[13rem_1fr]">
        <div className="relative min-h-48 overflow-hidden bg-[linear-gradient(135deg,#65cfff,#bfe9ff_42%,#dcd6ff_72%,#ffffff)]">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={`${project.name} thumbnail`} className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0">
              <div className="absolute left-6 top-6 h-20 w-20 rounded-full bg-white/45 blur-sm" />
              <div className="absolute bottom-5 right-5 h-24 w-24 rounded-full bg-[var(--sky-mint)]/60 blur-md" />
              <div className="absolute inset-x-6 bottom-8 rounded-[28px] border border-white/70 bg-white/42 p-4 backdrop-blur">
                <p className="text-xs font-bold text-[var(--sky-text-main)]">Story Preview</p>
                <p className="mt-1 text-[11px] text-[var(--sky-text-muted)]">等待第一張 approved image</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold tracking-[-0.03em]">{project.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--sky-text-muted)]">
                {project.description}
              </p>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--sky-text-muted)]">
              <span>專案進度 · {currentStage[project.status]}</span>
              <span>{progress}%</span>
            </div>
            <ProgressCloudBar value={progress} />
          </div>

          <div className="grid gap-3 text-sm text-[var(--sky-text-muted)] sm:grid-cols-2 xl:grid-cols-4">
            <span className="flex items-center gap-2">
              <FilmIcon aria-hidden="true" />
              {project.type} · {project.defaultAspectRatio}
            </span>
            <span className="flex items-center gap-2">
              <ImageIcon aria-hidden="true" />
              圖片 {imageCount}
            </span>
            <span className="flex items-center gap-2">
              <FilmIcon aria-hidden="true" />
              影片 {videoCount}
            </span>
            <span className="flex items-center gap-2">
              <TriangleAlertIcon aria-hidden="true" />
              失敗 {failedJobs}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs text-[var(--sky-text-muted)]">
              <ClockIcon aria-hidden="true" />
              最後更新 {new Date(project.updatedAt).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <Button
              render={<Link href={`/projects/${project.id}`} />}
              size="sm"
              nativeButton={false}
              data-testid={`open-project-${project.id}`}
            >
              繼續製作
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
