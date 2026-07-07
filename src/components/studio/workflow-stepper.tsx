import Link from "next/link";
import { CheckIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const workflowGroups = [
  {
    title: "文本",
    description: "原稿分析到正式劇本",
    steps: [
      { key: "presets", label: "模板", href: "presets" },
      { key: "text", label: "文本", href: "text" },
      { key: "seo", label: "SEO", href: "seo" },
      { key: "script", label: "劇本", href: "script" },
    ],
  },
  {
    title: "分鏡",
    description: "提示詞與一致性資產",
    steps: [
      { key: "shots", label: "分鏡", href: "shots" },
      { key: "characters", label: "角色", href: "characters" },
      { key: "environments", label: "場景", href: "environments" },
      { key: "images", label: "圖片", href: "images" },
    ],
  },
  {
    title: "影片生成",
    description: "影片、轉場、時間線與匯出",
    steps: [
      { key: "videos", label: "影片", href: "videos" },
      { key: "transitions", label: "轉場", href: "transitions" },
      { key: "timeline", label: "時間線", href: "timeline" },
      { key: "exports", label: "匯出", href: "exports" },
    ],
  },
];

const workflow = workflowGroups.flatMap((group) => group.steps);

const stageIndex: Record<string, number> = {
  draft: 1,
  text_ready: 4,
  storyboard_ready: 7,
  image_ready: 8,
  video_ready: 10,
  completed: 12,
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
    <div className="glass-panel rounded-[30px] p-3">
      <div className="grid gap-3 xl:grid-cols-3">
        {workflowGroups.map((group) => {
          const activeGroup = group.steps.some((step) => step.key === current);
          return (
            <section
              key={group.title}
              className={cn(
                "rounded-[26px] border border-[var(--sky-border)] bg-white/48 p-3 transition",
                activeGroup && "dream-selected bg-white/76",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold tracking-[-0.02em]">{group.title}</p>
                  <p className="text-xs text-[var(--sky-text-muted)]">{group.description}</p>
                </div>
                <div className={cn("rounded-full px-3 py-1 text-xs font-bold", activeGroup ? "bg-[var(--sky-primary-soft)]" : "bg-white/70")}>
                  {activeGroup ? "目前階段" : "流程節點"}
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
                        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[22px] border border-[var(--sky-border)] bg-white/58 px-2 py-2 text-center text-xs font-semibold text-[var(--sky-text-muted)] transition",
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
