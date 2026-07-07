import type {
  Project,
  Segment,
  SegmentOutlineRow,
  SeoPackage,
} from "@/lib/schemas";
import { nowIso, slugifyProjectName } from "@/lib/local-db";

export function generateSeoPackage(project: Project, segments: Segment[]): SeoPackage {
  const first = segments[0];
  const hook = first
    ? `${first.titleZh}：${first.summaryZh.slice(0, 42)}`
    : `${project.name} 的故事開場`;
  const keywordsZh = Array.from(
    new Set([
      project.name,
      "AI 影音",
      "劇情短片",
      "故事生成",
      ...segments.flatMap((segment) => [segment.emotion, segment.location]),
    ]),
  ).slice(0, 12);
  const keywordsEn = ["AI video", "storytelling", "cinematic short", "story to video"];
  const timestamp = nowIso();

  return {
    id: `seo-${project.id}`,
    projectId: project.id,
    seoTitleZh: `${project.name}｜${hook}`,
    seoTitleEn: `${project.name} | A cinematic story-to-video episode`,
    alternativeTitlesZh: [
      `${project.name}：最適合改成短影音的劇情版本`,
      `如果把這個故事做成影片，第一幕會讓人停不下來`,
      `${first?.titleZh ?? project.name} 到底藏著什麼秘密？`,
    ],
    alternativeTitlesEn: [
      `${project.name}: A story built for cinematic video`,
      `The hook that turns this story into a series`,
    ],
    youtubeHookZh: `如果你只看前 3 秒，會以為這只是普通故事；但${hook}。`,
    youtubeHookEn: `At first, it looks ordinary. Then the story turns: ${first?.titleEn ?? project.name}.`,
    shortDescriptionZh: `${project.name} 是一支以 ${project.defaultStyle} 包裝的故事影音企劃。`,
    shortDescriptionEn: `${project.name} is a story-to-video project with a ${project.defaultStyle} style.`,
    longDescriptionZh: segments
      .map((segment) => `${segment.order}. ${segment.titleZh}：${segment.summaryZh}`)
      .join("\n"),
    longDescriptionEn: segments
      .map((segment) => `${segment.order}. ${segment.titleEn}: ${segment.summaryEn}`)
      .join("\n"),
    keywordsZh,
    keywordsEn,
    targetAudience: project.defaultLanguage === "en" ? "English story viewers" : "喜歡劇情短片、懸疑敘事與 AI 影音創作的觀眾",
    emotionalSellingPoints: ["強開場鉤子", "清楚情緒轉折", "每段都可剪成 Shorts", "角色動機明確"],
    thumbnailIdeas: [
      `主角站在「${first?.location ?? "關鍵場景"}」中央，畫面放大一個懸念物件。`,
      "左右對比構圖：平靜日常 vs 真相揭露。",
    ],
    shortsCutPoints: segments.map(
      (segment) => `Short ${segment.order}: ${segment.titleZh}，用 ${segment.emotion} 情緒收尾。`,
    ),
    contentWarnings: ["Mock SEO 分數供 MVP 預覽使用。"],
    platformSuggestions:
      project.defaultAspectRatio === "9:16"
        ? "優先包裝為 Shorts / Reels；每段保留一個明確懸念收尾。"
        : "優先包裝為 YouTube 長片章節；用片段大綱做章節時間軸。",
    score: Math.min(96, 68 + segments.length * 4),
    approved: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createSegmentOutlineRows(
  project: Project,
  segments: Segment[],
  seoPackage: SeoPackage | null,
): SegmentOutlineRow[] {
  const slug = slugifyProjectName(project.name);
  return segments.map((segment) => ({
    segment_id: segment.id,
    segment_order: segment.order,
    segment_title_zh: segment.titleZh,
    segment_title_en: segment.titleEn,
    story_purpose: segment.storyPurpose,
    summary_zh: segment.summaryZh,
    summary_en: segment.summaryEn,
    emotion: segment.emotion,
    location: segment.location,
    characters: segment.characters.join(", "),
    estimated_shots: segment.userShotCount ?? segment.estimatedShots,
    seo_hook:
      seoPackage?.shortsCutPoints[segment.order - 1] ??
      `${slug} segment ${segment.order}`,
    notes: segment.approved ? "approved" : "needs approval",
  }));
}
