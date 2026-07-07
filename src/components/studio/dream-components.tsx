import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/studio/status-badge";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("glass-panel rounded-[28px]", className)}>{children}</section>;
}

export function DreamCard({
  children,
  className,
  selected,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
}) {
  return (
    <div className={cn("dream-card", selected && "dream-selected", className)}>
      {children}
    </div>
  );
}

export function DreamButton({
  href,
  children,
  variant = "primary",
  className,
}: {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const classes = cn(
    variant === "primary" ? "crystal-button" : "soft-button",
    "inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm transition hover:-translate-y-0.5",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return <button className={classes}>{children}</button>;
}

export function ProgressCloudBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("progress-cloud h-2.5", className)}>
      <span className="progress-cloud-fill block h-full" style={{ width: `${normalized}%` }} />
    </div>
  );
}

export function WorkflowStepCard({
  index,
  title,
  description,
  icon: Icon,
  percentage,
  status,
  href,
}: {
  index: number;
  title: string;
  description: string;
  icon: ComponentType<{ "aria-hidden"?: boolean }>;
  percentage: number;
  status: string;
  href?: string;
}) {
  const body = (
    <DreamCard className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--sky-primary-soft),white,var(--sky-lavender))] text-[var(--sky-text-main)] shadow-[var(--sky-shadow-soft)]">
          <Icon aria-hidden={true} />
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sky-text-muted)]">
          Step {String(index).padStart(2, "0")}
        </span>
        <h3 className="text-lg">{title}</h3>
        <p className="min-h-10 text-sm leading-6 text-[var(--sky-text-muted)]">{description}</p>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--sky-text-muted)]">
          <span>完成度</span>
          <span>{percentage}%</span>
        </div>
        <ProgressCloudBar value={percentage} />
      </div>
    </DreamCard>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export function AssetPreviewCard({
  title,
  subtitle,
  type,
  status,
  tone = "blue",
}: {
  title: string;
  subtitle: string;
  type: string;
  status: string;
  tone?: "blue" | "mint" | "lavender" | "pink";
}) {
  const gradientByTone = {
    blue: "from-[#65cfff] via-[#bfe9ff] to-white",
    mint: "from-[#c8f7f0] via-white to-[#bfe9ff]",
    lavender: "from-[#dcd6ff] via-white to-[#bfe9ff]",
    pink: "from-[#ffe2f2] via-white to-[#dcd6ff]",
  };

  return (
    <DreamCard className="overflow-hidden">
      <div className={cn("h-28 bg-gradient-to-br", gradientByTone[tone])}>
        <div className="flex h-full items-end justify-between p-4">
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[var(--sky-text-main)]">
            {type}
          </span>
          <SparklesIcon aria-hidden="true" className="text-white drop-shadow" />
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-bold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--sky-text-muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          <Button size="sm" variant="outline">
            查看
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </DreamCard>
  );
}

export function JobStatusCard({
  type,
  shotId,
  model,
  status,
  progress,
}: {
  type: string;
  shotId: string;
  model: string;
  status: string;
  progress: number;
}) {
  return (
    <div className={cn("rounded-3xl border border-[var(--sky-border)] bg-white/60 p-4", status === "running" && "running-shimmer")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--sky-bg-soft)] text-sm font-extrabold text-[var(--sky-text-main)]">
            {type.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{shotId || "project"}</p>
            <p className="truncate text-xs text-[var(--sky-text-muted)]">{model}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressCloudBar value={progress} className="flex-1" />
        <span className="text-xs font-semibold text-[var(--sky-text-muted)]">{progress}%</span>
      </div>
    </div>
  );
}
