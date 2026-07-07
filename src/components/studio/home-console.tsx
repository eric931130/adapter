"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleXIcon,
  CloudDownloadIcon,
  DiamondIcon,
  FileSearchIcon,
  Grid2X2Icon,
  ImageIcon,
  PauseIcon,
  PenLineIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  UploadCloudIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";

import type { LocalDb } from "@/lib/local-db";

type AssetTab = "圖片" | "影片" | "角色" | "場景";

const steps = [
  ["文本分析", "完成", 100, FileSearchIcon, "#1689ff"],
  ["SEO 包裝", "完成", 100, SearchIcon, "#20b6aa"],
  ["正式劇本", "進行中", 72, PenLineIcon, "#7c5cff"],
  ["分鏡提示詞", "完成", 100, Grid2X2Icon, "#7c5cff"],
  ["角色與場景一致性", "進行中", 58, UsersIcon, "#20b6aa"],
  ["圖片生成", "等待中", 0, ImageIcon, "#20b6aa"],
  ["影片生成", "等待中", 0, VideoIcon, "#e9579d"],
  ["匯出下載", "等待中", 0, CloudDownloadIcon, "#57718b"],
] as const;

const projects = [
  ["雲之國的奇幻旅程", "更新於 2025-05-18 14:30", "/dream-assets/sky-thumb-01.png", 72, "進行中", true],
  ["時光郵差", "更新於 2025-05-17 09:21", "/dream-assets/sky-thumb-06.png", 35, "進行中", false],
  ["星塵拓荒者", "更新於 2025-05-16 18:45", "/dream-assets/sky-thumb-04.png", 100, "已完成", true],
] as const;

const assets: Array<{ tab: AssetTab; image: string; title: string }> = [
  { tab: "圖片", image: "/dream-assets/sky-thumb-02.png", title: "浮空城堡" },
  { tab: "圖片", image: "/dream-assets/sky-thumb-05.png", title: "粉色雲樹" },
  { tab: "圖片", image: "/dream-assets/sky-thumb-07.png", title: "雲端主城" },
  { tab: "影片", image: "/dream-assets/sky-thumb-08.png", title: "日落飛行" },
  { tab: "角色", image: "/dream-assets/sky-thumb-03.png", title: "旅人剪影" },
  { tab: "場景", image: "/dream-assets/sky-thumb-09.png", title: "雲廊遠景" },
  { tab: "場景", image: "/dream-assets/sky-thumb-10.png", title: "飛船港口" },
  { tab: "影片", image: "/dream-assets/sky-thumb-11.png", title: "粉紫終章" },
  { tab: "圖片", image: "/dream-assets/sky-thumb-12.png", title: "月光雲海" },
];

const initialJobs = [
  [1847, "影片生成任務 #1847", "雲之國的奇幻旅程 | 第 12 段", "/dream-assets/sky-thumb-02.png", 68, "剩餘 2 分鐘", "#1689ff"],
  [1846, "圖片生成任務 #1846", "時光郵差 | 角色：女主角", "/dream-assets/sky-thumb-06.png", 100, "已完成", "#20b6aa"],
  [1845, "影片生成任務 #1845", "星塵拓荒者 | 第 04 段", "/dream-assets/sky-thumb-04.png", 33, "剩餘 5 分鐘", "#7c5cff"],
  [1844, "分鏡生成任務 #1844", "新專案 | 分鏡提示詞", "/dream-assets/sky-thumb-03.png", 15, "排隊中", "#ff8a1d"],
] as const;

type QueueJob = (typeof initialJobs)[number];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#cbddeb]">
      <span className="block h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-white/70 bg-white/52 shadow-[0_22px_48px_rgba(56,139,219,0.15)] backdrop-blur-2xl ${className}`}>{children}</section>;
}

export function HomeConsole({ db }: { db: LocalDb }) {
  const [activeTab, setActiveTab] = useState<AssetTab>("圖片");
  const [jobs, setJobs] = useState<QueueJob[]>([...initialJobs]);
  const [pausedIds, setPausedIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("讓 AI 助你從想法到影片，快速實現創意！");
  const visibleAssets = useMemo(() => {
    const selected = assets.filter((item) => item.tab === activeTab);
    return selected.length >= 6 ? selected : assets;
  }, [activeTab]);

  return (
    <div className="mx-auto grid min-h-[calc(100vh-32px)] max-w-[1510px] gap-4">
      <header className="flex items-center justify-end gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-white/75 bg-white/42 px-5 py-3 text-sm font-extrabold text-[#0d385f] shadow-[0_12px_28px_rgba(56,139,219,0.12)] backdrop-blur-xl sm:flex">
          <span className="size-2.5 rounded-full bg-[#20e7ce] shadow-[0_0_10px_#20e7ce]" />
          系統狀態
        </div>
        <div className="hidden rounded-full border border-white/75 bg-white/42 px-5 py-3 text-sm font-bold text-[#315e86] shadow-[0_12px_28px_rgba(56,139,219,0.12)] backdrop-blur-xl md:block">專案 {db.projects.length}</div>
        <button type="button" className="flex h-12 items-center gap-2 rounded-full border border-white/75 bg-white/42 px-5 font-bold text-[#0d385f] shadow-[0_12px_28px_rgba(56,139,219,0.12)] backdrop-blur-xl">
          <DiamondIcon aria-hidden="true" className="size-5 text-[#1689ff]" />
          12,450
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </button>
        <button type="button" className="relative grid size-12 place-items-center rounded-full border border-white/75 bg-white/42 text-[#0d385f] shadow-[0_12px_28px_rgba(56,139,219,0.12)] backdrop-blur-xl" aria-label="Notifications">
          <BellIcon aria-hidden="true" className="size-5" />
          <span className="absolute right-3 top-3 size-2 rounded-full bg-[#ff2367]" />
        </button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
        <div className="relative min-h-[288px] overflow-hidden rounded-[28px] px-7 py-8 md:px-10">
          <Image src="/dream-assets/sky-thumb-02.png" alt="" fill sizes="(max-width: 1024px) 100vw, 770px" className="object-cover" priority />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(235,248,255,0.94)_0%,rgba(235,248,255,0.82)_42%,rgba(235,248,255,0.32)_100%)]" />
          <div className="relative z-10 max-w-[640px]">
            <h1 className="text-[clamp(2.25rem,5vw,4rem)] font-black leading-[1.08] text-[#0b315e]">AI 故事影音自動化生成平台</h1>
            <p className="mt-5 max-w-[520px] text-xl font-bold leading-9 text-[#1f4a72]">從故事原稿到 SEO 劇本、分鏡、角色一致性、圖片、影片與完整匯出。</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <button type="button" onClick={() => setNotice("已建立新專案草稿，流程從文本分析開始")} className="inline-flex h-[62px] min-w-[190px] items-center justify-center gap-3 rounded-2xl border border-white/80 bg-[linear-gradient(180deg,#48b9ff,#007bff)] px-7 text-lg font-extrabold text-white shadow-[0_18px_34px_rgba(0,124,255,0.34)] transition hover:-translate-y-0.5">
                <SparklesIcon aria-hidden="true" className="size-6" />
                開始新專案
              </button>
              <button type="button" onClick={() => setNotice("ZIP 匯入檢查已啟動，等待選擇檔案")} className="inline-flex h-[62px] min-w-[190px] items-center justify-center gap-3 rounded-2xl border border-white/90 bg-white/46 px-7 text-lg font-extrabold text-[#0078ff] shadow-[0_12px_28px_rgba(56,139,219,0.12)] transition hover:-translate-y-0.5 hover:bg-white/64">
                <UploadCloudIcon aria-hidden="true" className="size-6" />
                匯入專案 ZIP
              </button>
            </div>
          </div>
        </div>

        <Panel className="p-7">
          <div className="mb-6 flex items-center gap-3">
            <SparklesIcon aria-hidden="true" className="size-6 text-[#1689ff]" />
            <h2 className="text-2xl font-black text-[#0b315e]">今日創作流程</h2>
          </div>
          <div className="flex items-start overflow-x-auto pb-1">
            {[
              ["文本分析", FileSearchIcon, "#1689ff"],
              ["分鏡生成", Grid2X2Icon, "#8c63ff"],
              ["圖片生成", ImageIcon, "#22c8cf"],
              ["影片生成", VideoIcon, "#ef5fa8"],
            ].map(([label, Icon, color], index) => (
              <div key={String(label)} className="flex flex-1 items-center">
                <div className="grid min-w-[116px] justify-items-center gap-3 text-center">
                  <div className="flex size-[86px] items-center justify-center rounded-full border-[5px] border-white/80 bg-white/55" style={{ color: String(color), boxShadow: `0 0 26px ${String(color)}55` }}>
                    <Icon aria-hidden="true" className="size-9" />
                  </div>
                  <p className="text-base font-extrabold text-[#10365f]">{String(label)}</p>
                </div>
                {index < 3 ? <ArrowRightIcon aria-hidden="true" className="mx-3 size-7 text-[#2e7ed3]" /> : null}
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-[#98c9ee] pt-4 text-sm font-bold text-[#2a669a]">{notice}</div>
        </Panel>
      </section>

      <Panel className="rounded-[24px] p-3">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {steps.map(([title, status, progress, Icon, color], index) => (
            <div key={title} className="flex min-h-[136px] flex-col justify-between rounded-2xl border border-white/75 bg-white/45 p-4 shadow-[0_12px_24px_rgba(56,139,219,0.12)]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xl font-semibold" style={{ color }}>{String(index + 1).padStart(2, "0")}</span>
                <span className="rounded-full bg-white/58 px-2 py-1 text-[11px] font-bold text-[#6383a1]">{status}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icon aria-hidden="true" className="size-10 shrink-0" style={{ color }} />
                <p className="text-sm font-extrabold text-[#13395f]">{title}</p>
              </div>
              <div className="grid gap-1.5">
                <div className="text-[11px] font-bold" style={{ color }}>{progress}%</div>
                <ProgressBar value={progress} color={color} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_1fr_1.08fr]">
        <Panel className="p-5">
          <PanelTitle title="近期專案" suffix="查看全部" />
          <div className="grid gap-3">
            {projects.map(([title, updated, image, progress, status, favorite]) => (
              <article key={title} className="grid grid-cols-[126px_1fr_70px] gap-4 rounded-2xl border border-white/70 bg-white/45 p-3 shadow-[0_12px_28px_rgba(56,139,219,0.12)]">
                <div className="relative h-[88px] overflow-hidden rounded-xl"><Image src={image} alt={title} fill sizes="126px" className="object-cover" /></div>
                <div className="min-w-0 py-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-lg font-extrabold text-[#123a64]">{title}</h3>
                    <StarIcon aria-hidden="true" className={`size-4 shrink-0 ${favorite ? "fill-[#ff9f1c] text-[#ff9f1c]" : "text-[#7190ac]"}`} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#6a86a1]">{updated}</p>
                </div>
                <div className="grid place-items-center text-xs font-bold text-[#5d7f9d]">{progress}%<span>{status}</span></div>
              </article>
            ))}
          </div>
          <button type="button" onClick={() => setNotice("新專案建立入口已準備好")} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/48 text-base font-extrabold text-[#0078ff] shadow-[0_10px_24px_rgba(56,139,219,0.1)] transition hover:bg-white/70">
            <PlusIcon aria-hidden="true" className="size-5" />
            建立新專案
          </button>
        </Panel>

        <Panel className="p-5">
          <PanelTitle title="近期資產" suffix="查看全部" />
          <div className="mb-4 grid grid-cols-4 rounded-xl border border-white/70 bg-[#dcecff]/70 p-1">
            {(["圖片", "影片", "角色", "場景"] as AssetTab[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`h-9 rounded-lg text-sm font-extrabold transition ${activeTab === tab ? "bg-[linear-gradient(180deg,#4abaff,#0078ff)] text-white shadow-[0_10px_22px_rgba(0,120,255,0.22)]" : "text-[#315e86] hover:bg-white/52"}`}>{tab}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {visibleAssets.slice(0, 9).map((asset, index) => (
              <button key={`${asset.title}-${index}`} type="button" className="relative aspect-[1.34] overflow-hidden rounded-xl border border-white/75 shadow-[0_10px_22px_rgba(56,139,219,0.14)]">
                <Image src={asset.image} alt={asset.title} fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelTitle title="生成佇列" suffix={`查看全部 (${jobs.length})`} />
          <div className="grid gap-3">
            {jobs.map(([id, title, detail, image, progress, status, color]) => {
              const paused = pausedIds.has(Number(id));
              return (
                <article key={id} className="grid grid-cols-[86px_1fr_auto] items-center gap-4 rounded-2xl border border-white/70 bg-white/45 p-3 shadow-[0_12px_28px_rgba(56,139,219,0.12)]">
                  <div className="relative h-[60px] overflow-hidden rounded-xl"><Image src={String(image)} alt={String(title)} fill sizes="86px" className="object-cover" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3"><h3 className="truncate text-sm font-extrabold text-[#123a64]">{title}</h3><span className="text-[#7190ac]">{paused ? "已暫停" : status}</span></div>
                    <p className="mt-1 truncate text-[11px] font-semibold text-[#7893aa]">{detail}</p>
                    <div className="mt-3 flex items-center gap-3"><div className="flex-1"><ProgressBar value={Number(progress)} color={String(color)} /></div><span className="w-10 text-right text-xs font-bold text-[#607f9b]">{progress}%</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPausedIds((current) => new Set(current).has(Number(id)) ? new Set([...current].filter((item) => item !== Number(id))) : new Set(current).add(Number(id)))} className="grid size-9 place-items-center rounded-full bg-[#e6f3ff] text-[#2f6ea8] transition hover:bg-white" aria-label="Pause job">
                      {paused ? <PlayIcon aria-hidden="true" className="size-4" /> : <PauseIcon aria-hidden="true" className="size-4" />}
                    </button>
                    <button type="button" onClick={() => setJobs((current) => current.filter((item) => item[0] !== id))} className="grid size-9 place-items-center rounded-full bg-[#e6f3ff] text-[#6c8399] transition hover:bg-white" aria-label="Remove job">
                      <CircleXIcon aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function PanelTitle({ title, suffix }: { title: string; suffix: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-2xl font-black text-[#0b315e]">{title}</h2>
      <span className="inline-flex items-center gap-1 text-sm font-bold text-[#1477d9]">{suffix}<ArrowRightIcon aria-hidden="true" className="size-4" /></span>
    </div>
  );
}
