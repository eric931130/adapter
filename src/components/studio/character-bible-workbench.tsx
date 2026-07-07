"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  ImagePlusIcon,
  PlusIcon,
  RefreshCcwIcon,
  Trash2Icon,
} from "lucide-react";

import { DataTable } from "@/components/studio/data-table";
import { StatusBadge } from "@/components/studio/status-badge";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { characterRows, downloadBlob, downloadXlsx, toCsv } from "@/lib/export-utils";
import type { Asset, Character, Shot } from "@/lib/schemas";
import type { ProjectWorkspace } from "@/lib/workspace-types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "請求失敗");
  return payload as T;
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "story-project";
}

function emptyCharacter(projectId: string): Character {
  const timestamp = new Date().toISOString();
  const id = `character-${projectId}-manual-${Date.now()}`;
  return {
    id,
    projectId,
    nameZh: "新角色",
    nameEn: "New Character",
    gender: "unspecified",
    ageRange: "to be defined",
    bodyType: "to be defined",
    faceFeatures: "to be defined",
    hairFeatures: "to be defined",
    eyeFeatures: "to be defined",
    outfitFeatures: "to be defined",
    colorPalette: "to be defined",
    personality: "to be defined",
    fixedPromptZh: "請描述角色固定外觀。",
    fixedPromptEn: "Describe the fixed character appearance.",
    negativePrompt: "wrong outfit, inconsistent face, extra character",
    consistencyNotes: "Keep face, outfit, palette, and props consistent.",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function characterMatchesShot(character: Character, shot: Shot) {
  const names = [character.id, character.nameZh, character.nameEn].map((name) => name.toLowerCase());
  return shot.characters.some((name) => names.includes(name.toLowerCase()));
}

export function CharacterBibleWorkbench({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function loadWorkspace() {
    const bundle = await fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`);
    setWorkspace(bundle);
    setCharacters(bundle.characters);
    setAssets(bundle.assets);
    setShots(bundle.shots);
    setSelectedId((current) => current || bundle.characters[0]?.id || "");
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ProjectWorkspace>(`/api/projects/${projectId}/workspace`)
      .then((bundle) => {
        if (cancelled) return;
        setWorkspace(bundle);
        setCharacters(bundle.characters);
        setAssets(bundle.assets);
        setShots(bundle.shots);
        setSelectedId((current) => current || bundle.characters[0]?.id || "");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "讀取角色資料庫失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selected = characters.find((character) => character.id === selectedId) ?? characters[0];
  const projectSlug = slugify(workspace?.project.name ?? "story-project");
  const rows = useMemo(() => characterRows(characters), [characters]);
  const referenceAssets = assets.filter((asset) => asset.characterId === selected?.id && asset.type === "reference_image");
  const affectedShots = selected ? shots.filter((shot) => characterMatchesShot(selected, shot)) : [];
  const issues = useMemo(() => {
    return shots.flatMap((shot) =>
      shot.characters.flatMap((name) => {
        const character = characters.find((item) =>
          [item.id, item.nameZh, item.nameEn].some((value) => value.toLowerCase() === name.toLowerCase()),
        );
        if (!character) return [{ shotId: shot.id, characterName: name, message: "角色名稱不存在", severity: "error" }];
        const refs = assets.filter((asset) => asset.characterId === character.id && asset.type === "reference_image");
        const messages = [];
        if (!character.fixedPromptEn || !character.fixedPromptZh) messages.push("角色提示詞缺失");
        if (!refs.length) messages.push("缺少參考圖");
        if (character.lockedReferenceAssetId && !refs.some((asset) => asset.id === character.lockedReferenceAssetId)) messages.push("鎖定參考圖不存在");
        return messages.map((message) => ({ shotId: shot.id, characterName: character.nameZh || character.nameEn, message, severity: message.includes("缺少參考圖") ? "warning" : "error" }));
      }),
    );
  }, [assets, characters, shots]);

  function updateSelected(patch: Partial<Character>) {
    if (!selected) return;
    setCharacters((current) =>
      current.map((character) =>
        character.id === selected.id
          ? { ...character, ...patch, updatedAt: new Date().toISOString() }
          : character,
      ),
    );
  }

  async function saveCharacters(nextCharacters = characters) {
    setIsBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ characters: Character[] }>(`/api/projects/${projectId}/characters`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: nextCharacters }),
      });
      setCharacters(result.characters);
      setNotice("Character Bible 已保存。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存角色失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function extractCharacters() {
    setIsBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ characters: Character[] }>(`/api/projects/${projectId}/characters/extract`, { method: "POST" });
      setCharacters(result.characters);
      setNotice("已從分鏡自動偵測角色草稿。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "偵測角色失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function applyBible() {
    setIsBusy(true);
    setError("");
    try {
      await saveCharacters(characters);
      await fetchJson(`/api/projects/${projectId}/characters/apply`, { method: "POST" });
      setNotice("已將角色一致性區塊套用到所有分鏡提示詞。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "套用 Character Bible 失敗");
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadReference(file: File | undefined) {
    if (!file || !selected) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setIsBusy(true);
    setError("");
    try {
      await fetchJson(`/api/projects/${projectId}/characters/reference-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selected.id, filename: file.name, dataUrl, lock: true }),
      });
      setNotice("參考圖已上傳並鎖定。");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "上傳參考圖失敗");
    } finally {
      setIsBusy(false);
    }
  }

  function addCharacter() {
    const character = emptyCharacter(projectId);
    setCharacters((current) => [...current, character]);
    setSelectedId(character.id);
  }

  function duplicateCharacter() {
    if (!selected) return;
    const copy = {
      ...selected,
      id: `${selected.id}-copy-${Date.now()}`,
      nameZh: `${selected.nameZh} Copy`,
      nameEn: `${selected.nameEn} Copy`,
      lockedReferenceAssetId: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCharacters((current) => [...current, copy]);
    setSelectedId(copy.id);
  }

  function deleteCharacter() {
    if (!selected) return;
    const next = characters.filter((character) => character.id !== selected.id);
    setCharacters(next);
    setSelectedId(next[0]?.id ?? "");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">角色資料庫 Character Bible</h1>
        <p className="mt-2 text-muted-foreground">管理角色固定外觀、參考圖、提示詞與一致性檢查。</p>
      </div>
      <WorkflowStepper status={workspace?.project.status ?? "storyboard_ready"} current="characters" projectId={projectId} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <CheckIcon aria-hidden="true" />
          <AlertTitle>狀態更新</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>角色列表</CardTitle>
            <CardDescription>{characters.length} 個角色</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button type="button" onClick={extractCharacters} disabled={isBusy || !shots.length}>
              <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
              從分鏡自動偵測角色
            </Button>
            <Button type="button" variant="outline" onClick={addCharacter}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              新增角色
            </Button>
            {characters.map((character) => (
              <Button
                key={character.id}
                type="button"
                variant={character.id === selected?.id ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => setSelectedId(character.id)}
              >
                {character.nameZh || character.nameEn}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>{selected ? `${selected.nameZh} / ${selected.nameEn}` : "角色編輯"}</CardTitle>
            <CardDescription>{selected?.personality ?? "選擇角色後編輯。"}</CardDescription>
            <CardAction>{selected ? <StatusBadge status={Boolean(selected.lockedReferenceAssetId)} /> : null}</CardAction>
          </CardHeader>
          <CardContent>
            {selected ? (
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>中文名</FieldLabel>
                    <Input value={selected.nameZh} onChange={(event) => updateSelected({ nameZh: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>英文名</FieldLabel>
                    <Input value={selected.nameEn} onChange={(event) => updateSelected({ nameEn: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <Field>
                    <FieldLabel>性別</FieldLabel>
                    <Input value={selected.gender} onChange={(event) => updateSelected({ gender: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>年齡</FieldLabel>
                    <Input value={selected.ageRange} onChange={(event) => updateSelected({ ageRange: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>體型</FieldLabel>
                    <Input value={selected.bodyType} onChange={(event) => updateSelected({ bodyType: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>色彩</FieldLabel>
                    <Input value={selected.colorPalette} onChange={(event) => updateSelected({ colorPalette: event.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>臉部特徵</FieldLabel>
                    <Textarea rows={3} value={selected.faceFeatures} onChange={(event) => updateSelected({ faceFeatures: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>髮型特徵</FieldLabel>
                    <Textarea rows={3} value={selected.hairFeatures} onChange={(event) => updateSelected({ hairFeatures: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>眼睛特徵</FieldLabel>
                    <Textarea rows={3} value={selected.eyeFeatures ?? ""} onChange={(event) => updateSelected({ eyeFeatures: event.target.value })} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>服裝特徵</FieldLabel>
                  <Textarea rows={3} value={selected.outfitFeatures} onChange={(event) => updateSelected({ outfitFeatures: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>個性</FieldLabel>
                  <Textarea rows={3} value={selected.personality} onChange={(event) => updateSelected({ personality: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>固定提示詞 Zh</FieldLabel>
                  <Textarea rows={4} value={selected.fixedPromptZh} onChange={(event) => updateSelected({ fixedPromptZh: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>Fixed Prompt En</FieldLabel>
                  <Textarea rows={4} value={selected.fixedPromptEn} onChange={(event) => updateSelected({ fixedPromptEn: event.target.value })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Negative Prompt</FieldLabel>
                    <Textarea rows={3} value={selected.negativePrompt} onChange={(event) => updateSelected({ negativePrompt: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>Consistency Notes</FieldLabel>
                    <Textarea rows={3} value={selected.consistencyNotes} onChange={(event) => updateSelected({ consistencyNotes: event.target.value })} />
                  </Field>
                </div>
              </FieldGroup>
            ) : null}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>參考圖</CardTitle>
              <CardDescription>上傳後會建立 reference_image Asset。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input type="file" accept="image/*" onChange={(event) => uploadReference(event.target.files?.[0])} disabled={!selected || isBusy} />
              {referenceAssets.map((asset) => (
                <div key={asset.id} className="rounded-lg border bg-muted/40 p-3">
                  {asset.url ? <img src={asset.url} alt={asset.filename} className="mb-2 aspect-video rounded-md object-cover" /> : null}
                  <div className="text-sm font-medium">{asset.filename}</div>
                  <div className="text-xs text-muted-foreground">v{asset.version} · {asset.status}</div>
                </div>
              ))}
              {!referenceAssets.length ? <p className="text-sm text-muted-foreground">尚未上傳參考圖。</p> : null}
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>操作</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={!selected} onClick={duplicateCharacter}>
                <CopyIcon data-icon="inline-start" aria-hidden="true" />
                複製角色
              </Button>
              <Button type="button" variant="destructive" disabled={!selected} onClick={deleteCharacter}>
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                刪除角色
              </Button>
              <Button type="button" variant="outline" disabled={!characters.length || isBusy} onClick={() => saveCharacters()}>
                保存 Character Bible
              </Button>
              <Button type="button" disabled={!characters.length || isBusy} onClick={applyBible}>
                <ImagePlusIcon data-icon="inline-start" aria-hidden="true" />
                套用到所有分鏡提示詞
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>匯出</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={!characters.length} onClick={() => downloadBlob(`${projectSlug}_character_bible.json`, JSON.stringify({ characters }, null, 2), "application/json;charset=utf-8")}>
                <FileJsonIcon data-icon="inline-start" aria-hidden="true" />
                Character Bible JSON
              </Button>
              <Button type="button" variant="outline" disabled={!characters.length} onClick={() => downloadBlob(`${projectSlug}_character_bible.csv`, toCsv(rows), "text/csv;charset=utf-8")}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                Character Bible CSV
              </Button>
              <Button type="button" variant="outline" disabled={!characters.length} onClick={() => downloadXlsx(`${projectSlug}_character_bible.xlsx`, rows, "character_bible")}>
                <FileSpreadsheetIcon data-icon="inline-start" aria-hidden="true" />
                Character Bible XLSX
              </Button>
            </CardContent>
          </Card>

          <Button render={<Link href={`/projects/${projectId}/images`} />} nativeButton={false}>
            進入圖片生成
          </Button>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>一致性檢查</CardTitle>
            <CardDescription>缺少角色資料、參考圖或固定提示詞會出現在這裡。</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={issues}
              columns={[
                { key: "shotId", header: "shot_id" },
                { key: "characterName", header: "character" },
                { key: "severity", header: "severity" },
                { key: "message", header: "message" },
              ]}
              emptyMessage="目前沒有一致性警告。"
            />
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>受影響分鏡</CardTitle>
            <CardDescription>目前選取角色出現的 Shot。</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={affectedShots.map((shot) => ({ shot_id: shot.id, title: shot.titleZh, characters: shot.characters.join(", "), prompt_status: shot.stale ? "stale" : "current" }))}
              columns={[
                { key: "shot_id", header: "shot_id" },
                { key: "title", header: "title" },
                { key: "characters", header: "characters" },
                { key: "prompt_status", header: "prompt_status" },
              ]}
              emptyMessage="此角色尚未出現在分鏡中。"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
