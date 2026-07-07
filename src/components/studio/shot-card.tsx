"use client";

import { CameraIcon, RefreshCcwIcon, VideoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/studio/status-badge";
import type { Shot } from "@/lib/schemas";

export function ShotCard({
  shot,
  onImage,
  onVideo,
}: {
  shot: Shot;
  onImage?: (shotId: string) => void;
  onVideo?: (shotId: string) => void;
}) {
  return (
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>
          {shot.order}. {shot.titleZh}
        </CardTitle>
        <CardDescription>{shot.titleEn}</CardDescription>
        <CardAction>
          <StatusBadge status={shot.imageStatus} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 text-sm md:grid-cols-2">
          <div>
            <div className="mb-1 font-medium">Plot</div>
            <p className="text-muted-foreground">{shot.plotZh}</p>
          </div>
          <div>
            <div className="mb-1 font-medium">Camera</div>
            <p className="text-muted-foreground">
              {shot.camera} · {shot.movement}
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CameraIcon aria-hidden="true" />
              Image Prompt
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {shot.imagePromptEn}
            </p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <VideoIcon aria-hidden="true" />
              Video Prompt
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {shot.videoPromptEn}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Continuity: {shot.continuityRules}
        </p>
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={shot.videoStatus} />
          <span className="text-xs text-muted-foreground">{shot.aspectRatio}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onImage?.(shot.id)}
            data-testid={`generate-image-${shot.id}`}
          >
            <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
            生成圖片
          </Button>
          <Button
            size="sm"
            onClick={() => onVideo?.(shot.id)}
            data-testid={`generate-video-${shot.id}`}
          >
            <VideoIcon data-icon="inline-start" aria-hidden="true" />
            生成影片
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
