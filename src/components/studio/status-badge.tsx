import { Badge } from "@/components/ui/badge";
import type { GenerationJobStatus, ProjectStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Status = ProjectStatus | GenerationJobStatus | string | boolean;

const labels: Record<string, string> = {
  draft: "草稿",
  text_ready: "文本完成",
  storyboard_ready: "分鏡完成",
  image_ready: "圖片完成",
  video_ready: "影片完成",
  completed: "已完成",
  pending: "待處理",
  queued: "佇列中",
  running: "生成中",
  success: "成功",
  failed: "失敗",
  cancelled: "已取消",
  expired: "已過期",
  approved: "已核准",
  rejected: "已退回",
  generated: "已生成",
  uploaded: "已上傳",
  stale: "需更新",
  prompt_outdated: "提示過期",
  exported: "已匯出",
  true: "已核准",
  false: "待確認",
};

function classFor(status: string) {
  if (["success", "approved", "completed", "true", "generated", "uploaded"].includes(status)) {
    return "border-[#a9eee5] bg-[var(--sky-mint)] text-[#1f665e]";
  }
  if (["failed", "rejected", "false"].includes(status)) {
    return "border-[#ffd1e8] bg-[var(--sky-pink-soft)] text-[#9b315f]";
  }
  if (status === "running") {
    return "running-shimmer border-[#9ce2ff] bg-gradient-to-r from-[var(--sky-primary-soft)] via-white to-[var(--sky-lavender)] text-[var(--sky-text-main)]";
  }
  if (status === "queued") {
    return "border-[#d7d0ff] bg-[#eeeaff] text-[#5c558f]";
  }
  if (["stale", "prompt_outdated", "expired"].includes(status)) {
    return "border-[#ffe0b6] bg-[#fff1d9] text-[#9a6532]";
  }
  if (status === "exported") {
    return "border-[#d7d0ff] bg-[var(--sky-lavender)] text-[#514b7a]";
  }
  return "border-[var(--sky-border)] bg-[#e8f6ff] text-[var(--sky-text-muted)]";
}

export function StatusBadge({ status }: { status: Status }) {
  const key = String(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "relative rounded-full px-3 py-1 text-[11px] font-bold shadow-sm",
        classFor(key),
      )}
    >
      {labels[key] ?? key}
    </Badge>
  );
}
