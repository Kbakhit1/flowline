"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { ArrowLeft, Columns2, Rows2 } from "lucide-react";
import { useEngine } from "@/lib/engine/store";
import { useT } from "@/lib/i18n";
import { useHydrated } from "@/components/providers";
import { LogoLockup } from "@/components/logo";
import { LangToggle, PersonAvatar, ThemeToggle } from "@/components/common";

const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Two personas, one dataset, one screen. Each half is the full app pinned to a
 * person; a change in one half shows up in the other at once.
 */
export default function SplitPage() {
  const { t, tl } = useT();
  const hydrated = useHydrated();
  const users = useEngine((s) => s.db.users);
  const [a, setA] = useState("u2");
  const [b, setB] = useState("u6");
  const [stacked, setStacked] = useState(true);

  const active = users.filter((u) => u.active);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link href="/app" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted" aria-label={t.common.back}>
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
        </Link>
        <LogoLockup height={22} />
        <span className="hidden text-xs text-muted-foreground sm:inline">· {t.split.title}</span>
        <span className="ms-auto hidden text-[11px] text-muted-foreground md:inline">{t.split.hint}</span>
        <button
          onClick={() => setStacked((v) => !v)}
          className="ms-auto hidden h-8 items-center gap-1.5 rounded-lg border px-2 text-xs md:inline-flex"
          title={stacked ? t.split.sideBySide : t.split.stacked}
        >
          {stacked ? <Columns2 className="size-3.5" /> : <Rows2 className="size-3.5" />}
          {stacked ? t.split.sideBySide : t.split.stacked}
        </button>
        <LangToggle className="hidden sm:inline-flex" />
        <ThemeToggle />
      </header>

      <div className={cn("grid min-h-0 flex-1 gap-1 bg-border", stacked ? "grid-rows-2" : "grid-rows-2 md:grid-cols-2 md:grid-rows-1")}>
        {[
          { id: a, set: setA, label: stacked ? t.split.top : t.split.first },
          { id: b, set: setB, label: stacked ? t.split.bottom : t.split.second },
        ].map((pane, i) => {
          const u = users.find((x) => x.id === pane.id) ?? active[0];
          return (
            <section key={i} className="flex min-h-0 flex-col bg-background">
              <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/40 px-2 text-xs">
                <span className="text-muted-foreground">{pane.label}</span>
                {u && <PersonAvatar user={u} size={18} />}
                <select value={pane.id} onChange={(e) => pane.set(e.target.value)} className="h-7 max-w-[60%] rounded-md border bg-background px-1.5 text-xs">
                  {active.map((x) => (
                    <option key={x.id} value={x.id}>
                      {tl(x.name)} · {tl(x.title)}
                    </option>
                  ))}
                </select>
              </div>
              {hydrated && (
                <iframe
                  key={pane.id}
                  src={`${BP}/app/?persona=${pane.id}&frame=1`}
                  title={u ? tl(u.name) : pane.label}
                  className="min-h-0 w-full flex-1 border-0"
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
