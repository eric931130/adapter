import Link from "next/link";
import { CheckIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const workflowGroups = [
  {
    title: "文本整理",
    description: "匯入、分析、SEO 與腳本",
    steps: [
      { key: "text", label: "文本", href: "text" },
      { key: "seo", label: "SEO", href: "seo" },
      { key: "script", label: "腳本", href: "script" },
    ],
  },
  {
    title: "分鏡素材",
    description: "分鏡、角色、場景與圖片",
    steps: [
      { key: "shots", label: "分鏡", href: "shots" },
      { key: "characters", label: "角色", href: "characters" },
      { key: "environments", label: "場景", href: "environments" },
      { key: "images", label: "圖片", href: "images" },
    ],
  },
  {
    title: "影片輸出",
    description: "影片、轉場、時間軸與匯出",
    steps: [
      { key: "videos", label: "影片", href: "videos" },
      { key: "transitions", label: "轉場", href: "transitions" },
      { key: "timeline", label: "時間軸", href: "timeline" },
      { key: "exports", label: "匯出", href: "exports" },
    ],
  },
];

const workflow = workflowGroups.flatMap((group) => group.steps);

const stageIndex: Record<string, number> = {
  draft: 0,
  text_ready: 3,
  storyboard_ready: 7,
  image_ready: 8,
  video_ready: 10,
  completed: 11,
};

export function WorkflowStepper({
  status,
  current,
  projectId,
}: {
  status: string;
  current?: string;
  projectId?: string;
}) {
  const completedIndex = stageIndex[status] ?? 0;

  return (
    <div className="glass-panel rounded-3xl p-3">
      <div className="grid gap-3 xl:grid-cols-3">
        {workflowGroups.map((group) => {
          const activeGroup = group.steps.some((step) => step.key === current);
          return (
            <section
              key={group.title}
              className={cn(
                "rounded-2xl border border-[var(--sky-border)] bg-white/48 p-3 transition",
                activeGroup && "dream-selected bg-white/76",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold">{group.title}</p>
                  <p className="text-xs text-[var(--sky-text-muted)]">{group.description}</p>
                </div>
                <div className={cn("rounded-full px-3 py-1 text-xs font-bold", activeGroup ? "bg-[var(--sky-primary-soft)]" : "bg-white/70")}>
                  {activeGroup ? "目前步驟" : "可前往"}
                </div>
              </div>
              <ol className="grid grid-cols-4 gap-2">
                {group.steps.map((step) => {
                  const index = workflow.findIndex((item) => item.key === step.key);
                  const done = index < completedIndex;
                  const active = current === step.key;
                  const content = (
                    <span
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--sky-border)] bg-white/58 px-2 py-2 text-center text-xs font-semibold text-[var(--sky-text-muted)] transition hover:bg-white/80",
                        done && "border-[#a9eee5] bg-[var(--sky-mint)] text-[#1f665e]",
                        active && "border-[#65cfff] bg-white text-[var(--sky-text-main)] ring-2 ring-[rgba(101,207,255,0.24)]",
                      )}
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-white/78 text-[11px] font-extrabold shadow-sm">
                        {done ? <CheckIcon aria-hidden="true" /> : active ? <SparklesIcon aria-hidden="true" /> : index + 1}
                      </span>
                      <span>{step.label}</span>
                    </span>
                  );

                  return (
                    <li key={step.key}>
                      {projectId ? (
                        <Link href={`/projects/${projectId}/${step.href}`}>{content}</Link>
                      ) : content}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
