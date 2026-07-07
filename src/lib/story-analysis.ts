import type {
  Project,
  Segment,
  StoryAnalysisResult,
  StoryAnalysisSegment,
  TextWorkbenchSettings,
} from "@/lib/schemas";
import { nowIso } from "@/lib/local-db";

export type AnalyzeStoryInput = {
  project: Project;
  sourceText: string;
  settings: TextWorkbenchSettings;
};

const fallbackLocations = [
  "開場場景",
  "主角日常環境",
  "衝突發生地",
  "轉折場景",
  "高潮場景",
  "結局場景",
];

const emotionArc = ["好奇", "不安", "衝突", "低潮", "覺醒", "釋然"];

function chunkText(text: string, count: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const size = Math.max(60, Math.ceil(normalized.length / count));
  return Array.from({ length: count }, (_, index) => {
    const start = index * size;
    return normalized.slice(start, start + size).trim();
  }).map((chunk) => chunk || normalized.slice(0, 120) || "此段落等待補充故事內容。");
}

function inferCharacters(text: string) {
  const matches = Array.from(
    text.matchAll(/(?:主角|女孩|男孩|父親|母親|老師|學生|列車長|朋友|孩子|勇者|AI|機器人)/g),
  ).map((match) => match[0]);
  const unique = Array.from(new Set(matches));
  return unique.length ? unique.slice(0, 5) : ["主角", "關鍵配角"];
}

export function analyzeStory(input: AnalyzeStoryInput): StoryAnalysisResult {
  const segmentCount = input.settings.segmentCount || input.project.defaultSegmentCount || 5;
  const chunks = chunkText(input.sourceText, segmentCount);
  const characters = inferCharacters(input.sourceText);
  const theme = input.settings.storyTheme || input.project.name;

  const segments: StoryAnalysisSegment[] = chunks.map((chunk, index) => {
    const order = index + 1;
    const emotion = emotionArc[index % emotionArc.length];
    const location = fallbackLocations[index % fallbackLocations.length];
    return {
      order,
      titleZh: `${theme} ${order}`,
      titleEn: `Story Beat ${order}`,
      summaryZh: chunk.length > 120 ? `${chunk.slice(0, 120)}...` : chunk,
      summaryEn: `Mock English summary for beat ${order}: ${chunk.slice(0, 90)}`,
      storyPurpose:
        order === 1
          ? "建立世界觀、角色動機與開場鉤子。"
          : order === segmentCount
            ? "收束情緒弧線，提供可記憶的結尾。"
            : "推進衝突、揭露資訊並累積下一段期待。",
      emotion,
      location,
      characters,
      estimatedShots: Math.min(8, Math.max(3, Math.ceil(chunk.length / 80))),
    };
  });

  return {
    storyTheme: theme,
    logline: `${theme}：一個角色在壓力下做出選擇，並讓故事走向不可逆的轉折。`,
    mainCharacters: characters,
    conflict: "主角目標與外部阻力互相拉扯，形成逐段升高的戲劇張力。",
    worldSetting: input.settings.defaultStyle
      ? `以「${input.settings.defaultStyle}」作為視覺世界基準。`
      : "世界設定待使用者補充，mock 分析先以原稿描述推斷。",
    emotionalArc: "開場好奇 -> 中段壓力升高 -> 高潮選擇 -> 結尾釋放。",
    recommendedSegmentCount: segmentCount,
    riskWarnings: [
      "Mock 分析僅根據文字長度與設定拆段，正式版本應接 LLM。",
      ...(input.sourceText.length < 300 ? ["原稿偏短，片段摘要可能需要人工補強。"] : []),
    ],
    segments,
  };
}

export function analysisSegmentsToSegments(
  projectId: string,
  analysisSegments: StoryAnalysisSegment[],
): Segment[] {
  const timestamp = nowIso();
  return analysisSegments.map((segment) => ({
    id: `segment-${projectId}-${segment.order}-${Date.now()}`,
    projectId,
    order: segment.order,
    titleZh: segment.titleZh,
    titleEn: segment.titleEn,
    summaryZh: segment.summaryZh,
    summaryEn: segment.summaryEn,
    storyPurpose: segment.storyPurpose,
    emotion: segment.emotion,
    location: segment.location,
    characters: segment.characters,
    estimatedShots: segment.estimatedShots,
    userShotCount: segment.estimatedShots,
    approved: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}
