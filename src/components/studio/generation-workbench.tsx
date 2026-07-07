"use client";

import { useMemo } from "react";
import { BadgeDollarSignIcon, ClockIcon, LayersIcon } from "lucide-react";

import { JobsTable } from "@/components/studio/jobs-table";
import { ShotCard } from "@/components/studio/shot-card";
import { StatCard } from "@/components/studio/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useStudioStore } from "@/store/studio-store";

export function GenerationWorkbench({
  projectId,
  kind,
}: {
  projectId: string;
  kind: "image" | "video";
}) {
  const allShots = useStudioStore((state) => state.shots);
  const allJobs = useStudioStore((state) => state.generationJobs);
  const enqueueImageJob = useStudioStore((state) => state.enqueueImageJob);
  const enqueueVideoJob = useStudioStore((state) => state.enqueueVideoJob);

  const shots = useMemo(
    () => allShots.filter((shot) => shot.projectId === projectId),
    [allShots, projectId],
  );
  const jobs = useMemo(
    () =>
      allJobs.filter((job) => job.projectId === projectId && job.type === kind),
    [allJobs, kind, projectId],
  );
  const queuedCount = useMemo(
    () =>
      jobs.filter((job) => ["pending", "queued", "running"].includes(job.status))
        .length,
    [jobs],
  );

  return (
    <div className="flex flex-col gap-6">
      <Alert className="bg-card/80 backdrop-blur">
        <LayersIcon aria-hidden="true" />
        <AlertTitle>
          {kind === "image" ? "圖片生成走 GenerationJob" : "影片生成走 GenerationJob"}
        </AlertTitle>
        <AlertDescription>
          目前使用 mock adapter。每次重新生成都會建立新任務與新 asset version，不覆蓋舊檔。
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Queued"
          value={String(queuedCount)}
          description="本地模擬佇列等待後續替換為 worker。"
          icon={ClockIcon}
        />
        <StatCard
          title="Runs"
          value={String(jobs.length)}
          description="所有 provider/model 由 adapter 統一封裝。"
          icon={LayersIcon}
        />
        <StatCard
          title="Cost"
          value="$0.00"
          description="Mock provider 不計費，保留成本欄位。"
          icon={BadgeDollarSignIcon}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {shots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            onImage={kind === "image" ? enqueueImageJob : undefined}
            onVideo={kind === "video" ? enqueueVideoJob : undefined}
          />
        ))}
      </div>
      <JobsTable jobs={jobs} />
    </div>
  );
}
