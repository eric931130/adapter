"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, PlusIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getImageModelOptions, getVideoModelOptions } from "@/lib/model-capabilities";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("短影音生成任務");
  const [description, setDescription] = useState("貼上故事、企劃或腳本後，依序產生分段、分鏡、圖片提示詞與影片生成紀錄。");
  const [segmentCount, setSegmentCount] = useState(5);
  const [costLimit, setCostLimit] = useState(80);
  const [imageModel, setImageModel] = useState("mock-image-cinematic-v1");
  const [videoModel, setVideoModel] = useState("mock-image-to-video-v1");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const imageModels = getImageModelOptions();
  const videoModels = getVideoModelOptions();

  async function createProject() {
    setError("");
    if (!name.trim()) {
      setError("請輸入任務名稱。");
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          type: "shorts",
          defaultAspectRatio: "9:16",
          defaultLanguage: "zh",
          defaultStyle: "cinematic, clean character continuity",
          defaultSegmentCount: segmentCount,
          defaultImageModel: imageModel,
          defaultVideoModel: videoModel,
          costLimit,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "建立任務失敗。");
      router.push(`/projects/${payload.projectId}/text`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "建立任務失敗。");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>建立新任務</CardTitle>
          <CardDescription>
            建立後會直接進入文本工作台。系統只保存任務資料、生成紀錄與 API 費用，不需要登入、註冊或積分。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>建立失敗</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="project-name">任務名稱</FieldLabel>
              <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-description">任務說明</FieldLabel>
              <Textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>預設段落數</FieldLabel>
                <Input type="number" value={segmentCount} min={1} max={20} onChange={(event) => setSegmentCount(Number(event.target.value))} />
              </Field>
              <Field>
                <FieldLabel>費用提醒上限 USD</FieldLabel>
                <Input type="number" value={costLimit} min={0} onChange={(event) => setCostLimit(Number(event.target.value))} />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>圖片模型</FieldLabel>
                <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
                  {imageModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel>影片模型</FieldLabel>
                <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={videoModel} onChange={(event) => setVideoModel(event.target.value)}>
                  {videoModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button
              type="button"
              className="w-fit"
              onClick={createProject}
              disabled={isCreating}
              data-testid="create-project-submit"
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {isCreating ? "建立中..." : "建立並進入文本工作台"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Alert className="bg-card/80 backdrop-blur">
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>費用提醒</AlertTitle>
          <AlertDescription>
            費用上限是提醒與防呆設定，不是積分。實際支出仍以你設定的 API 服務商帳單為準。
          </AlertDescription>
        </Alert>
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>{name || "新任務"}</CardTitle>
            <CardDescription>任務設定摘要</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>影片比例：9:16</p>
            <p>語言：繁體中文</p>
            <p>預設段落：{segmentCount} 段</p>
            <p>費用提醒：${costLimit.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
