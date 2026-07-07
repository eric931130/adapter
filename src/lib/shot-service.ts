import type { Project, Script, Segment, Shot, ShotPromptRow } from "@/lib/schemas";
import { nowIso } from "@/lib/local-db";

export function getFinalShotCount(script: Script) {
  return Math.min(30, Math.max(1, script.userShotCount ?? script.suggestedShotCount));
}

function splitSegmentText(text: string, count: number, index: number) {
  const clean = text.trim();
  if (!clean) return "";
  const chunkSize = Math.ceil(clean.length / count);
  return clean.slice(index * chunkSize, (index + 1) * chunkSize).trim() || clean;
}

function timeOfDayFor(order: number) {
  return ["dawn", "morning", "afternoon", "golden hour", "night", "midnight"][(order - 1) % 6];
}

function cameraFor(order: number) {
  return ["wide establishing shot", "medium shot", "close-up", "over-the-shoulder shot", "low angle", "tracking shot"][(order - 1) % 6];
}

function movementFor(order: number) {
  return ["slow dolly in", "gentle pan right", "locked-off frame", "handheld micro drift", "push-in then hold", "tracking left to right"][(order - 1) % 6];
}

function imagePrompt(project: Project, segment: Segment, script: Script, shotPlot: string, language: "zh" | "en") {
  if (language === "zh") {
    return [
      `${project.defaultStyle} 畫風。`,
      `角色外觀與角色服裝保持一致：${segment.characters.join("、")}。`,
      `角色表情符合情緒：${segment.emotion}。`,
      `場景背景：${segment.location}，${shotPlot}`,
      "光線清楚、色調穩定、構圖有明確前景中景背景。",
      "鏡頭距離與焦段依照分鏡設計，不要加入任何文字或字幕。",
      "禁止多餘肢體、禁止角色分裂、禁止錯誤服裝、禁止背景漂移。",
      `視覺方向：${script.visualDirection}`,
    ].join(" ");
  }

  return [
    `${project.defaultStyle} visual style.`,
    `Keep character appearance and outfit consistent for: ${segment.characters.join(", ")}.`,
    `Facial expressions must match the emotion: ${segment.emotion}.`,
    `Scene background: ${segment.location}. Shot plot: ${shotPlot}`,
    "Clear lighting, stable color palette, deliberate composition with foreground, midground, and background.",
    "Use the specified shot distance and lens language. No text, no captions, no watermarks.",
    "No extra limbs, no duplicated/split characters, no wrong outfits, no drifting background.",
    `Visual direction: ${script.visualDirection}`,
  ].join(" ");
}

function videoPrompt(segment: Segment, script: Script, shotPlot: string, movement: string, language: "zh" | "en") {
  if (language === "zh") {
    return [
      "使用對應分鏡圖片作為首幀。",
      `角色動作：${script.characterAction}`,
      `鏡頭運動：${movement}。動作方向要清楚，情緒從 ${segment.emotion} 自然變化。`,
      `分鏡劇情：${shotPlot}`,
      "背景保持一致，角色服裝保持一致，臉部保持一致。",
      "不要加字幕，不要加對話，除非 script 指定。",
      "最後 0.8 秒畫面穩定停住，方便剪輯。",
      "不要改變角色數量，不要讓角色走錯方向。",
    ].join(" ");
  }

  return [
    "Use the matching storyboard image as the first frame.",
    `Character action: ${script.characterAction}`,
    `Camera movement: ${movement}. Keep action direction clear and let the emotion evolve from ${segment.emotion}.`,
    `Shot plot: ${shotPlot}`,
    "Keep the background consistent, keep character outfits consistent, and keep faces consistent.",
    "Do not add subtitles. Do not add dialogue unless the script explicitly requests it.",
    "Hold the final frame steady for the last 0.8 seconds for editing.",
    "Do not change the number of characters. Do not make characters move in the wrong direction.",
  ].join(" ");
}

export function generateShots(project: Project, segments: Segment[], scripts: Script[]): Shot[] {
  const timestamp = nowIso();
  const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
  let globalOrder = 0;

  return scripts
    .filter((script) => script.approved)
    .flatMap((script) => {
      const segment = segmentMap.get(script.segmentId);
      if (!segment) return [];
      const finalCount = getFinalShotCount(script);

      return Array.from({ length: finalCount }, (_, index) => {
        globalOrder += 1;
        const localOrder = index + 1;
        const plotZh =
          splitSegmentText(script.narrationZh || segment.summaryZh, finalCount, index) ||
          `${segment.summaryZh}（分鏡 ${localOrder}）`;
        const plotEn =
          splitSegmentText(script.narrationEn || segment.summaryEn, finalCount, index) ||
          `${segment.summaryEn} (shot ${localOrder})`;
        const camera = cameraFor(globalOrder);
        const movement = movementFor(globalOrder);

        return {
          id: `shot-${project.id}-${segment.id}-${String(localOrder).padStart(2, "0")}`,
          projectId: project.id,
          segmentId: segment.id,
          order: globalOrder,
          titleZh: `${segment.titleZh} ${localOrder}`,
          titleEn: `${segment.titleEn} ${localOrder}`,
          plotZh,
          plotEn,
          characters: segment.characters,
          location: segment.location,
          timeOfDay: timeOfDayFor(globalOrder),
          emotion: segment.emotion,
          camera,
          movement,
          imagePromptZh: imagePrompt(project, segment, script, plotZh, "zh"),
          imagePromptEn: imagePrompt(project, segment, script, plotEn, "en"),
          videoPromptZh: videoPrompt(segment, script, plotZh, movement, "zh"),
          videoPromptEn: videoPrompt(segment, script, plotEn, movement, "en"),
          negativePrompt:
            "text, subtitles, watermark, logo, extra limbs, duplicated character, split character, wrong outfit, drifting background",
          continuityRules:
            `Maintain ${segment.characters.join(", ")} identity, wardrobe, props, background geography, lighting direction, and color palette across the segment.`,
          aspectRatio: project.defaultAspectRatio,
          imageModel: project.defaultImageModel,
          videoModel: project.defaultVideoModel,
          imageStatus: "pending",
          videoStatus: "pending",
          approved: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        } satisfies Shot;
      });
    });
}

export function shotRows(shots: Shot[]): ShotPromptRow[] {
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

export function rowToShot(existing: Shot, row: Record<string, unknown>): Shot {
  return {
    ...existing,
    order: Number(row.shot_order ?? existing.order),
    titleZh: String(row.shot_title_zh ?? existing.titleZh),
    titleEn: String(row.shot_title_en ?? existing.titleEn),
    plotZh: String(row.plot_zh ?? existing.plotZh),
    plotEn: String(row.plot_en ?? existing.plotEn),
    characters: String(row.characters ?? existing.characters.join(","))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    location: String(row.location ?? existing.location),
    timeOfDay: String(row.time_of_day ?? existing.timeOfDay),
    emotion: String(row.emotion ?? existing.emotion),
    imagePromptZh: String(row.image_prompt_zh ?? existing.imagePromptZh),
    imagePromptEn: String(row.image_prompt_en ?? existing.imagePromptEn),
    videoPromptZh: String(row.video_prompt_zh ?? existing.videoPromptZh),
    videoPromptEn: String(row.video_prompt_en ?? existing.videoPromptEn),
    negativePrompt: String(row.negative_prompt ?? existing.negativePrompt),
    camera: String(row.camera ?? existing.camera),
    movement: String(row.movement ?? existing.movement),
    continuityRules: String(row.continuity_rules ?? existing.continuityRules),
    aspectRatio: row.aspect_ratio === "16:9" ? "16:9" : "9:16",
    imageModel: String(row.image_model ?? existing.imageModel),
    videoModel: String(row.video_model ?? existing.videoModel),
    approved: false,
    stale: true,
    updatedAt: nowIso(),
  };
}
