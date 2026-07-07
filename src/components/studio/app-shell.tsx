"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BellIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  CloudIcon,
  DownloadIcon,
  FolderIcon,
  GalleryHorizontalEndIcon,
  HelpCircleIcon,
  HomeIcon,
  ImageIcon,
  MenuIcon,
  MoonIcon,
  PlusCircleIcon,
  Settings2Icon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Studio Home", icon: HomeIcon },
  { href: "/", label: "Projects", icon: FolderIcon },
  { href: "/projects/new", label: "New Project", icon: PlusCircleIcon },
  { href: "/guide/prompts", label: "Prompt Guide", icon: BookOpenIcon },
  { href: "/settings/models", label: "Model Settings", icon: Settings2Icon },
  { href: "/", label: "Presets", icon: StarIcon },
  { href: "/", label: "Gallery", icon: GalleryHorizontalEndIcon },
  { href: "/", label: "Logs", icon: ImageIcon },
  { href: "/", label: "Export Center", icon: DownloadIcon },
];

const usageMeters = [
  { label: "運算點數", value: "23,560 / 40,000", percent: 59, icon: SparklesIcon },
  { label: "儲存空間", value: "163.2 GB / 500 GB", percent: 33, icon: CloudIcon },
  { label: "影片時數", value: "128.4 / 300 分鐘", percent: 43, icon: ImageIcon },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-[52px] items-center gap-4 rounded-2xl border border-transparent px-4 text-[15px] font-semibold text-[#0d335d] transition",
        "hover:border-white/80 hover:bg-white/50 hover:shadow-[0_12px_28px_rgba(56,139,219,0.14)]",
        active && "border-white/90 bg-white/60 text-[#0078ff] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45),0_16px_34px_rgba(60,143,234,0.18)]",
      )}
    >
      <Icon aria-hidden="true" className="size-6 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Meter({
  label,
  value,
  percent,
  icon: Icon,
}: {
  label: string;
  value: string;
  percent: number;
  icon: typeof SparklesIcon;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#4e7294]">
        <span className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 text-[#0078ff]" />
          {label}
        </span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#c9deef]">
        <span className="block h-full rounded-full bg-[linear-gradient(90deg,#0078ff,#20c7d2)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-2">
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-white/70 shadow-[0_14px_30px_rgba(21,119,226,0.18)]">
          <Image src="/dream-assets/sky-thumb-01.png" alt="" fill sizes="56px" className="object-cover" priority />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-5 text-[#0b315e]">Dreamy Sky</p>
          <p className="truncate text-sm font-semibold text-[#2d5c88]">Creator Console</p>
          <p className="truncate text-[11px] text-[#6b86a1]">AI Story-to-Video Studio</p>
        </div>
      </Link>

      <nav className="mt-9 grid gap-2">
        {navItems.map((item) => (
          <NavLink
            key={`${item.href}-${item.label}`}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href && item.label === "Studio Home"}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto grid gap-4">
        <div className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-[0_14px_32px_rgba(43,112,178,0.12)]">
          <div className="flex items-center gap-3">
            <div className="relative size-12 overflow-hidden rounded-full border border-white">
              <Image src="/dream-assets/sky-thumb-12.png" alt="" fill sizes="48px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-[#10365f]">Dreamy Creator</p>
                <span className="rounded-md bg-[#7259ff] px-1.5 py-0.5 text-[10px] font-bold text-white">Pro</span>
              </div>
              <p className="truncate text-[11px] text-[#6f8aa3]">UID: 8888 8888</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_32px_rgba(43,112,178,0.12)]">
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-[#123a64]">
            <span>本月用量</span>
            <span className="text-[#7b93aa]">重置於 30 天後</span>
          </div>
          <div className="grid gap-3">
            {usageMeters.map((meter) => (
              <Meter key={meter.label} {...meter} />
            ))}
          </div>
        </div>

        <div className="flex h-14 items-center justify-between rounded-2xl border border-white/70 bg-white/45 px-3 shadow-[0_14px_32px_rgba(43,112,178,0.12)]">
          {[SunIcon, HelpCircleIcon, BellIcon, ChevronLeftIcon].map((Icon, index) => (
            <button key={index} type="button" className="relative flex size-9 items-center justify-center rounded-full text-[#0c3761] transition hover:bg-white/80" aria-label={`Sidebar action ${index + 1}`}>
              <Icon aria-hidden="true" className="size-5" />
              {Icon === BellIcon ? <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff2367]" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden text-[#0b315e]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-white/70 bg-[rgba(235,248,255,0.66)] p-4 shadow-[12px_0_48px_rgba(50,132,205,0.12)] backdrop-blur-2xl xl:block">
        <Sidebar />
      </aside>

      <div className="fixed left-4 top-4 z-40 xl:hidden">
        <Button type="button" variant="outline" size="icon" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
          <MenuIcon aria-hidden="true" />
        </Button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-[#0b315e]/25 backdrop-blur-sm xl:hidden">
          <div className="h-full w-[292px] border-r border-white/70 bg-[rgba(235,248,255,0.9)] p-4 shadow-2xl">
            <div className="mb-4 flex justify-end">
              <Button type="button" variant="outline" size="icon" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="min-h-screen px-4 py-4 sm:px-6 xl:pl-[248px]">{children}</main>
      <button type="button" className="fixed bottom-5 right-5 hidden size-11 items-center justify-center rounded-full border border-white/80 bg-white/60 text-[#0b315e] shadow-[0_16px_34px_rgba(56,139,219,0.18)] backdrop-blur-xl md:flex" aria-label="Toggle night mode">
        <MoonIcon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
