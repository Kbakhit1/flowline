"use client";

import { cn } from "cn";
import { Moon, Sun, Languages } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { Request, Stage, User } from "@/lib/engine/types";
import { isLate, stageOf } from "@/lib/engine/rules";
import { useT, useUi } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/* ---------- avatar ---------- */

export function PersonAvatar({ user, size = 32, className }: { user: User; size?: number; className?: string }) {
  const { tl } = useT();
  const name = tl(user.name);
  const initials = name
    .replace(/^(م\.|Eng\.)\s*/, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: `oklch(0.9 0.05 ${user.hue})`,
        color: `oklch(0.35 0.08 ${user.hue})`,
      }}
    >
      {initials}
    </span>
  );
}

/* ---------- stage + flags ---------- */

const STAGE_CLASS: Record<Stage, string> = {
  you: "bg-stage-you-soft text-stage-you",
  waiting: "bg-stage-wait-soft text-stage-wait",
  done: "bg-stage-done-soft text-stage-done",
  stopped: "bg-stage-stop-soft text-stage-stop",
};

export function StageChip({ stage, label, className }: { stage: Stage; label?: string; className?: string }) {
  const { t } = useT();
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap", STAGE_CLASS[stage], className)}>
      {label ?? t.stage[stage]}
    </span>
  );
}

export function StageDot({ stage, className }: { stage: Stage; className?: string }) {
  const color: Record<Stage, string> = {
    you: "bg-stage-you",
    waiting: "bg-stage-wait",
    done: "bg-stage-done",
    stopped: "bg-stage-stop",
  };
  return <span className={cn("inline-block size-2 rounded-full", color[stage], className)} />;
}

export function Flags({ r, now, className }: { r: Request; now: number; className?: string }) {
  const { t } = useT();
  const late = isLate(r, now);
  if (!late && r.priority !== "urgent") return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {r.priority === "urgent" && (
        <span className="inline-flex h-5 items-center rounded-full bg-urgent-soft px-2 text-[11px] font-semibold text-urgent">{t.flag.urgent}</span>
      )}
      {late && (
        <span className="inline-flex h-5 items-center rounded-full bg-late-soft px-2 text-[11px] font-semibold text-late">{t.flag.late}</span>
      )}
    </span>
  );
}

export function stageClassOf(r: Request): string {
  return STAGE_CLASS[stageOf(r.status)];
}

/* ---------- layout bits ---------- */

export function SectionTitle({ children, count, className }: { children: React.ReactNode; count?: number; className?: string }) {
  return (
    <h2 className={cn("flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase", className)}>
      {children}
      {typeof count === "number" && (
        <span className="tabular rounded-full bg-muted px-1.5 text-[11px] text-foreground/70">{count}</span>
      )}
    </h2>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 thin-scroll", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {typeof o.count === "number" && o.count > 0 && (
            <span className={cn("tabular rounded-full px-1.5 text-[11px]", value === o.value ? "bg-primary/10 text-primary" : "bg-foreground/5")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- language + theme toggles ---------- */

export function LangToggle({ className }: { className?: string }) {
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  return (
    <Button variant="ghost" size="sm" className={className} onClick={() => setLocale(locale === "ar" ? "en" : "ar")} aria-label="Language">
      <Languages />
      <span className="font-medium">{locale === "ar" ? "EN" : "عربي"}</span>
    </Button>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon-sm" className={className} onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Theme">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
