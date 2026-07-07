import type {
  Asset,
  Character,
  GenerationJob,
  Script,
  Segment,
  SegmentOutlineRow,
  SeoPackage,
  Shot,
} from "@/lib/schemas";

export function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export async function downloadXlsx(
  filename: string,
  rows: Array<Record<string, unknown>>,
  sheetName: string,
) {
  const xlsx = await import("xlsx");
  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  xlsx.writeFile(workbook, filename);
}

export async function downloadMultiSheetXlsx(
  filename: string,
  sheets: Array<{ rows: Array<Record<string, unknown>>; sheetName: string }>,
) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = xlsx.utils.json_to_sheet(sheet.rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheet.sheetName.slice(0, 31));
  }
  xlsx.writeFile(workbook, filename);
}

export async function parseImportFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "json") {
    const data = JSON.parse(await file.text());
    return Array.isArray(data) ? data : data.shots ?? data.rows ?? [];
  }
  if (extension === "csv") {
    return csvToRows(await file.text());
  }
  if (extension === "xlsx") {
    const xlsx = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return xlsx.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
  }
  throw new Error("僅支援 JSON / CSV / XLSX 匯入。");
}

function csvToRows(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

export async function downloadZip(
  filename: string,
  files: Array<{ path: string; content: string | Blob | ArrayBuffer }>,
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function scriptRows(scripts: Script[], segments: Segment[]) {
  const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
  return scripts.map((script) => {
    const segment = segmentMap.get(script.segmentId);
    return {
      segment_id: script.segmentId,
      segment_title_zh: segment?.titleZh ?? "",
      narration_zh: script.narrationZh,
      narration_en: script.narrationEn,
      character_action: script.characterAction,
      emotional_direction: script.emotionalDirection,
      visual_direction: script.visualDirection,
      suggested_shot_count: script.suggestedShotCount,
      user_shot_count: script.userShotCount ?? "",
      final_shot_count: Math.min(30, Math.max(1, script.userShotCount ?? script.suggestedShotCount)),
      difficulty: script.difficulty,
      generation_risk: script.generationRisk,
    };
  });
}

export function seoJsonPayload(seoPackage: SeoPackage, outlineRows: SegmentOutlineRow[]) {
  return JSON.stringify({ seoPackage, segmentOutline: outlineRows }, null, 2);
}

export function shotRows(shots: Shot[]) {
  return shots
    .toSorted((a, b) => a.order - b.order)
    .map((shot) => ({
      shot_id: shot.id,
      segment_id: shot.segmentId,
      shot_order: shot.order,
      shot_title_zh: shot.titleZh,
      shot_title_en: shot.titleEn,
      plot_zh: shot.plotZh,
      plot_en: shot.plotEn,
      characters: shot.characters.join(", "),
      location: shot.location,
      time_of_day: shot.timeOfDay,
      emotion: shot.emotion,
      image_prompt_zh: shot.imagePromptZh,
      image_prompt_en: shot.imagePromptEn,
      video_prompt_zh: shot.videoPromptZh,
      video_prompt_en: shot.videoPromptEn,
      negative_prompt: shot.negativePrompt,
      camera: shot.camera,
      movement: shot.movement,
      continuity_rules: shot.continuityRules,
      aspect_ratio: shot.aspectRatio,
      image_model: shot.imageModel,
      video_model: shot.videoModel,
      status: shot.approved ? "approved" : "draft",
    }));
}

export function characterRows(characters: Character[]) {
  return characters.map((character) => ({
    character_id: character.id,
    name_zh: character.nameZh,
    name_en: character.nameEn,
    gender: character.gender,
    age_range: character.ageRange,
    body_type: character.bodyType,
    face_features: character.faceFeatures,
    hair_features: character.hairFeatures,
    eye_features: character.eyeFeatures ?? "",
    outfit_features: character.outfitFeatures,
    color_palette: character.colorPalette,
    personality: character.personality,
    fixed_prompt_zh: character.fixedPromptZh,
    fixed_prompt_en: character.fixedPromptEn,
    negative_prompt: character.negativePrompt,
    consistency_notes: character.consistencyNotes,
    locked_reference_asset_id: character.lockedReferenceAssetId ?? "",
  }));
}

export function jobRows(jobs: GenerationJob[]) {
  return jobs.map((job) => ({
    job_id: job.id,
    type: job.type,
    provider: job.provider,
    model: job.model,
    mode: job.mode,
    shot_id: job.shotId ?? "",
    status: job.status,
    estimated_cost: job.estimatedCost,
    actual_cost: job.actualCost ?? "",
    retry_count: job.retryCount,
    created_at: job.createdAt,
    completed_at: job.completedAt ?? "",
    error_message: job.errorMessage ?? "",
  }));
}

export function assetDownloadFiles(assets: Asset[], folder: string) {
  return assets.map((asset) => ({
    path: `${folder}/${asset.filename}`,
    content: JSON.stringify(
      {
        id: asset.id,
        filename: asset.filename,
        url: asset.url,
        type: asset.type,
        version: asset.version,
        status: asset.status,
        promptSnapshot: asset.promptSnapshot,
      },
      null,
      2,
    ),
  }));
}
