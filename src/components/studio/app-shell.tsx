"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HomeIcon,
  KeyRoundIcon,
  MenuIcon,
  PlusCircleIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "工具首頁", icon: HomeIcon },
  { href: "/projects/new", label: "建立任務", icon: PlusCircleIcon },
  { href: "/settings/models", label: "API 設定", icon: KeyRoundIcon },
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
        "flex h-12 items-center gap-3 rounded-xl border border-transparent px-4 text-sm font-semibold text-[#0d335d] transition",
        "hover:border-white/80 hover:bg-white/60 hover:shadow-[0_12px_28px_rgba(56,139,219,0.14)]",
        active &&
          "border-white/90 bg-white/70 text-[#0078ff] shadow-[0_16px_34px_rgba(60,143,234,0.18)]",
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-2">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/75 text-[#0078ff] shadow-[0_14px_30px_rgba(21,119,226,0.18)]">
          <HomeIcon aria-hidden="true" className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-5 text-[#0b315e]">影片生成工具</p>
          <p className="truncate text-xs font-semibold text-[#5f7f9d]">腳本、分鏡、素材與費用控管</p>
        </div>
      </Link>

      <nav className="mt-8 grid gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-white/70 bg-white/45 p-4 text-xs font-medium leading-5 text-[#5f7f9d] shadow-[0_14px_32px_rgba(43,112,178,0.12)]">
        <p className="font-bold text-[#10365f]">工具模式</p>
        <p className="mt-1">
          不需要登入、註冊或積分。只記錄任務資料、API 用量與即時預估費用。
        </p>
      </div>
    </div>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden text-[#0b315e]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-white/70 bg-[rgba(235,248,255,0.72)] p-4 shadow-[12px_0_48px_rgba(50,132,205,0.12)] backdrop-blur-2xl xl:block">
        <Sidebar />
      </aside>

      <div className="fixed left-4 top-4 z-40 xl:hidden">
        <Button type="button" variant="outline" size="icon" aria-label="開啟選單" onClick={() => setMobileOpen(true)}>
          <MenuIcon aria-hidden="true" />
        </Button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-[#0b315e]/25 backdrop-blur-sm xl:hidden">
          <div className="h-full w-[292px] border-r border-white/70 bg-[rgba(235,248,255,0.95)] p-4 shadow-2xl">
            <div className="mb-4 flex justify-end">
              <Button type="button" variant="outline" size="icon" aria-label="關閉選單" onClick={() => setMobileOpen(false)}>
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="min-h-screen px-4 py-4 sm:px-6 xl:pl-[248px]">{children}</main>
    </div>
  );
}
