import type { Project, Script, Segment, SeoPackage } from "@/lib/schemas";
import { nowIso } from "@/lib/local-db";

function riskForSegment(segment: Segment) {
  const risks = [];
  if (segment.characters.length >= 3) risks.push("角色多");
  if (/城市|戰場|列車|宇宙|森林|學校/.test(segment.location)) risks.push("場景複雜");
  if (/追|逃|戰|跑|跳|爆|衝/.test(segment.summaryZh)) risks.push("動作複雜");
  if (segment.characters.length >= 2) risks.push("角色一致性高風險");
  return risks.length ? risks.join("、") : "低風險";
}

export function generateScripts(
  project: Project,
  segments: Segment[],
  seoPackage: SeoPackage | null,
): Script[] {
  const timestamp = nowIso();
  return segments.map((segment) => {
    const finalShotCount = Math.min(30, Math.max(1, segment.userShotCount ?? segment.estimatedShots));
    const difficulty = finalShotCount >= 8 || segment.characters.length >= 3 ? "high" : finalShotCount >= 5 ? "medium" : "low";

    return {
      id: `script-${project.id}-${segment.id}`,
      projectId: project.id,
      segmentId: segment.id,
      narrationZh: `${segment.titleZh}。${segment.summaryZh} 這一段要延續「${seoPackage?.youtubeHookZh ?? project.name}」的觀看鉤子。`,
      narrationEn: `${segment.titleEn}. ${segment.summaryEn} This beat keeps the audience moving toward the next reveal.`,
      characterAction: `${segment.characters.join("、")} 在 ${segment.location} 面對新的阻力，行動必須推動下一個轉折。`,
      emotionalDirection: segment.emotion,
      visualDirection: `${project.defaultStyle}。鏡頭語言要服務 ${segment.storyPurpose}`,
      suggestedShotCount: finalShotCount,
      userShotCount: finalShotCount,
      difficulty,
      generationRisk: riskForSegment(segment),
      approved: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export function getFinalShotCount(script: Script) {
  return Math.min(30, Math.max(1, script.userShotCount ?? script.suggestedShotCount));
}
