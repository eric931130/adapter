import type { Asset, Character, Shot } from "@/lib/schemas";
import { nowIso } from "@/lib/local-db";

function normalizeCharacterName(name: string) {
  return name
    .trim()
    .replace(/^character[-_]/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function characterId(projectId: string, name: string) {
  return `character-${projectId}-${normalizeCharacterName(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-") || "unnamed"}`;
}

export function extractCharactersFromShots(projectId: string, shots: Shot[], existing: Character[] = []) {
  const timestamp = nowIso();
  const existingNames = new Set(
    existing.flatMap((character) => [character.id, character.nameZh, character.nameEn].filter(Boolean)),
  );
  const names = Array.from(
    new Set(
      shots
        .flatMap((shot) => shot.characters)
        .map(normalizeCharacterName)
        .filter(Boolean),
    ),
  );

  return names
    .filter((name) => !existingNames.has(name) && !existingNames.has(characterId(projectId, name)))
    .map((name) => ({
      id: characterId(projectId, name),
      projectId,
      nameZh: name,
      nameEn: name,
      gender: "unspecified",
      ageRange: "to be defined",
      bodyType: "to be defined",
      faceFeatures: "to be defined",
      hairFeatures: "to be defined",
      eyeFeatures: "to be defined",
      outfitFeatures: "to be defined",
      colorPalette: "to be defined",
      personality: "to be defined",
      fixedPromptZh: `${name} 的固定外觀尚待補完。`,
      fixedPromptEn: `Fixed appearance for ${name} is pending.`,
      negativePrompt: "wrong outfit, different face, inconsistent hair, duplicated character",
      consistencyNotes: "Keep this character visually consistent across every shot.",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Character));
}

function matchesCharacter(shotName: string, character: Character) {
  const normalizedShotName = normalizeCharacterName(shotName).toLowerCase();
  return [character.id, character.nameZh, character.nameEn]
    .filter(Boolean)
    .some((value) => normalizeCharacterName(value).toLowerCase() === normalizedShotName);
}

function characterBlock(shot: Shot, characters: Character[], language: "zh" | "en") {
  const matched = characters.filter((character) =>
    shot.characters.some((name) => matchesCharacter(name, character)),
  );
  if (!matched.length) return "";

  const lines = matched.map((character) => {
    const prompt = language === "zh" ? character.fixedPromptZh : character.fixedPromptEn;
    return `- ${character.nameZh || character.nameEn}: ${prompt}`;
  });
  return `[CHARACTER CONSISTENCY]\n${lines.join("\n")}\n\n[SHOT VISUAL PROMPT]\n`;
}

function removeCharacterBlock(prompt: string) {
  return prompt.replace(/^\[CHARACTER CONSISTENCY\][\s\S]*?\[SHOT VISUAL PROMPT\]\n?/m, "").trim();
}

export function applyCharacterBibleToShotPrompts(shots: Shot[], characters: Character[]) {
  const timestamp = nowIso();
  return shots.map((shot) => {
    const matched = characters.filter((character) =>
      shot.characters.some((name) => matchesCharacter(name, character)),
    );
    const negativeAdditions = matched.map((character) => character.negativePrompt).filter(Boolean);
    const continuityAdditions = matched.map((character) => character.consistencyNotes).filter(Boolean);

    return {
      ...shot,
      imagePromptZh: `${characterBlock(shot, characters, "zh")}${removeCharacterBlock(shot.imagePromptZh)}`,
      imagePromptEn: `${characterBlock(shot, characters, "en")}${removeCharacterBlock(shot.imagePromptEn)}`,
      negativePrompt: Array.from(new Set([shot.negativePrompt, ...negativeAdditions].flatMap((item) => item.split(",").map((part) => part.trim()).filter(Boolean)))).join(", "),
      continuityRules: [shot.continuityRules, ...continuityAdditions].filter(Boolean).join("\n"),
      stale: true,
      updatedAt: timestamp,
    };
  });
}

export function getCharacterIssues(shots: Shot[], characters: Character[], assets: Asset[]) {
  const issues: Array<{
    shotId: string;
    characterName: string;
    severity: "error" | "warning";
    message: string;
  }> = [];

  for (const shot of shots) {
    for (const name of shot.characters) {
      const character = characters.find((item) => matchesCharacter(name, item));
      if (!character) {
        issues.push({
          shotId: shot.id,
          characterName: name,
          severity: "error",
          message: "角色名稱不存在於 Character Bible。",
        });
        continue;
      }
      const referenceAssets = assets.filter(
        (asset) => asset.characterId === character.id && asset.type === "reference_image",
      );
      if (!character.fixedPromptEn || !character.fixedPromptZh) {
        issues.push({
          shotId: shot.id,
          characterName: character.nameZh || character.nameEn,
          severity: "error",
          message: "角色固定提示詞缺失。",
        });
      }
      if (!referenceAssets.length) {
        issues.push({
          shotId: shot.id,
          characterName: character.nameZh || character.nameEn,
          severity: "warning",
          message: "缺少角色參考圖。",
        });
      }
      if (character.lockedReferenceAssetId && !referenceAssets.some((asset) => asset.id === character.lockedReferenceAssetId)) {
        issues.push({
          shotId: shot.id,
          characterName: character.nameZh || character.nameEn,
          severity: "error",
          message: "角色已鎖定但找不到 locked reference asset。",
        });
      }
    }
  }

  return issues;
}
