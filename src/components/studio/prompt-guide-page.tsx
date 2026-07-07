"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const guides = [
  {
    title: "圖片提示詞寫法",
    stage: "Shots / Images",
    description: "圖片 prompt 要描述畫風、角色外觀、場景背景、光線、色調、構圖與鏡頭距離。",
    prompt: "Dreamy watercolor storybook style, consistent character face and outfit, soft sky-blue lighting, detailed background, medium shot, no text, no extra limbs, no duplicated character, no wrong clothing, no background drift.",
  },
  {
    title: "影片提示詞寫法",
    stage: "Videos",
    description: "影片 prompt 要以首幀圖片為基礎，分開描述角色動作、鏡頭運動、情緒變化與剪輯停格。",
    prompt: "Use the approved storyboard image as the first frame. The character slowly walks from left to right, camera dolly-in, emotion changes from worry to hope, keep background, face and clothing consistent, no subtitles, no dialogue, final 0.8 seconds hold still.",
  },
  {
    title: "角色一致性提示詞",
    stage: "Character Bible",
    description: "把固定外觀放在 [CHARACTER CONSISTENCY] 區塊，避免覆蓋分鏡原 prompt。",
    prompt: "[CHARACTER CONSISTENCY]\n- Joseph: young Hebrew man, gentle eyes, shoulder-length dark hair, simple linen robe, blue sash, consistent face and clothing.\n\n[SHOT VISUAL PROMPT]\nOriginal shot prompt here.",
  },
  {
    title: "場景一致性提示詞",
    stage: "Environment Bible",
    description: "明確指定牆面、地板、光線、材質和不可漂移的背景邏輯。",
    prompt: "[ENVIRONMENT CONSISTENCY]\nLocation: ancient Egyptian prison\nLighting: dim torch light, closed stone walls\nMust keep: same wall texture, same narrow corridor, same straw floor\n\n[SHOT PROMPT]\nOriginal shot prompt here.",
  },
  {
    title: "Shot A → Shot B 轉場提示詞",
    stage: "Transitions",
    description: "轉場 prompt 要同時描述 from/to 畫面、camera motion、subject movement 與 identity continuity。",
    prompt: "Transition from Shot A visual description to Shot B visual description. Smooth crane camera motion, subject turns toward the doorway, emotional transition from fear to resolve, keep character identity and clothing, keep environment logic, no subtitles, no dialogue.",
  },
  {
    title: "YouTube Shorts Hook",
    stage: "SEO",
    description: "開頭用清楚衝突與懸念，避免抽象形容堆疊。",
    prompt: "他只是被關進監牢，卻在三分鐘內改變了整個王國的命運。",
  },
  {
    title: "兒童故事提示詞",
    stage: "Presets",
    description: "使用安全、溫暖、清楚動作和柔和表情，避免恐怖與過度寫實。",
    prompt: "Gentle children's storybook illustration, soft watercolor texture, warm expressions, safe and hopeful tone, simple readable composition, pastel sky-blue and mint palette.",
  },
  {
    title: "日系動漫提示詞",
    stage: "Presets",
    description: "控制線條、眼神、光影與背景細節，保留同一角色設定。",
    prompt: "Japanese anime storyboard frame, clean line art, expressive eyes, cinematic rim light, detailed but stable background, consistent outfit and hairstyle across shots.",
  },
  {
    title: "水彩童書提示詞",
    stage: "Presets",
    description: "適合聖經故事、療癒短片和兒童敘事。",
    prompt: "Soft watercolor children's book style, airy paper texture, dreamy sky-blue ambience, gentle mint highlights, clear silhouette, peaceful emotional tone.",
  },
  {
    title: "常見錯誤修正",
    stage: "Shots / Videos",
    description: "針對走錯方向、背景漂移、變臉、服裝變化、多出角色、亂加字幕與僵硬動作。",
    prompt: "Keep the character walking left to right only. Do not change face, clothing, hairstyle, background layout, character count, or add subtitles. Motion should be natural and subtle, not stiff.",
  },
];

export function PromptGuidePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-main)]">Prompt Guide 提示詞教學</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          圖片、影片、角色、場景、轉場與 Shorts hook 的可複製 prompt 範本。
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {guides.map((guide) => (
          <Card key={guide.title} className="dream-panel">
            <CardHeader>
              <CardTitle>{guide.title}</CardTitle>
              <CardDescription>{guide.stage} · {guide.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <pre className="min-h-28 whitespace-pre-wrap rounded-2xl border bg-white/65 p-4 text-sm text-[var(--color-text-main)]">{guide.prompt}</pre>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(guide.prompt)}>
                <CopyIcon data-icon="inline-start" aria-hidden="true" />
                複製 prompt
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
