"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { ArrowLeft, Columns2, GripHorizontal, GripVertical, Rows2 } from "lucide-react";
import { useEngine } from "@/lib/engine/store";
import { useT, useLocale } from "@/lib/i18n";
import { useHydrated } from "@/components/providers";
import { LogoLockup } from "@/components/logo";
import { LangToggle, PersonAvatar, ThemeToggle } from "@/components/common";

const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MIN = 0.2;
const MAX = 0.8;

/**
 * Two personas, one dataset, one screen. Each half is the full app pinned to a
 * person; a change in one half shows up in the other at once. The divider drags.
 */
export default function SplitPage() {
  const { t, tl } = useT();
  const locale = useLocale();
  const hydrated = useHydrated();
  const users = useEngine((s) => s.db.users);
  const [a, setA] = useState("u2");
  const [b, setB] = useState("u6");
  const [stacked, setStackedState] = useState(true);
  const [ratio, setRatioState] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const prefs = useRef({ ratio: 0.5, stacked: true });

  // remember the split the user liked; saved only on user changes, never on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem("flowline-split");
      if (saved) {
        const v = JSON.parse(saved) as { ratio?: number; stacked?: boolean };
        if (typeof v.ratio === "number") prefs.current.ratio = Math.min(MAX, Math.max(MIN, v.ratio));
        if (typeof v.stacked === "boolean") prefs.current.stacked = v.stacked;
        setRatioState(prefs.current.ratio);
        setStackedState(prefs.current.stacked);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const persist = () => {
    try {
      localStorage.setItem("flowline-split", JSON.stringify(prefs.current));
    } catch {
      /* ignore */
    }
  };
  const setRatio = (v: number) => {
    prefs.current.ratio = v;
    setRatioState(v);
    persist();
  };
  const setStacked = (fn: (v: boolean) => boolean) => {
    prefs.current.stacked = fn(prefs.current.stacked);
    setStackedState(prefs.current.stacked);
    persist();
  };

  const rtl = locale === "ar";
  const fromPointer = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let v: number;
      if (stacked) v = (e.clientY - r.top) / r.height;
      else v = rtl ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
      setRatio(Math.min(MAX, Math.max(MIN, v)));
    },
    [stacked, rtl],
  );

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    fromPointer(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging) fromPointer(e);
  };
  const onUp = () => setDragging(false);
  // a release outside the divider (or a lost capture) must still end the drag
  useEffect(() => {
    if (!dragging) return;
    const end = () => setDragging(false);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [dragging]);

  const active = users.filter((u) => u.active);
  const pct = Math.round(ratio * 100);
  const template = `${pct}% 12px minmax(0, 1fr)`;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link href="/app" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted" aria-label={t.common.back}>
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
        </Link>
        <LogoLockup height={22} />
        <span className="hidden text-xs text-muted-foreground sm:inline">· {t.split.title}</span>

        <div className="ms-auto flex items-center gap-1">
          {[30, 50, 70].map((p) => (
            <button
              key={p}
              onClick={() => setRatio(p / 100)}
              className={cn("h-7 rounded-md border px-2 text-[11px] tabular", pct === p ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground")}
              title={t.split.preset}
            >
              {p}/{100 - p}
            </button>
          ))}
          <button
            onClick={() => setStacked((v) => !v)}
            className="hidden h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] md:inline-flex"
            title={stacked ? t.split.sideBySide : t.split.stacked}
          >
            {stacked ? <Columns2 className="size-3.5" /> : <Rows2 className="size-3.5" />}
            {stacked ? t.split.sideBySide : t.split.stacked}
          </button>
        </div>
        <LangToggle className="hidden sm:inline-flex" />
        <ThemeToggle />
      </header>

      <div
        ref={box}
        className="grid min-h-0 flex-1 bg-border"
        style={stacked ? { gridTemplateRows: template } : { gridTemplateColumns: template }}
      >
        <Pane id={a} set={setA} label={stacked ? t.split.top : t.split.first} users={active} hydrated={hydrated} dragging={dragging} tl={tl} />

        <div
          role="separator"
          aria-orientation={stacked ? "horizontal" : "vertical"}
          aria-valuenow={pct}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          onDoubleClick={() => setRatio(0.5)}
          className={cn(
            "flex touch-none select-none items-center justify-center bg-border transition-colors hover:bg-primary/40",
            stacked ? "cursor-row-resize" : "cursor-col-resize",
            dragging && "bg-primary/60",
          )}
          title={t.split.dragHint}
        >
          <span className="rounded-full bg-background/80 p-0.5 text-muted-foreground">
            {stacked ? <GripHorizontal className="size-3.5" /> : <GripVertical className="size-3.5" />}
          </span>
        </div>

        <Pane id={b} set={setB} label={stacked ? t.split.bottom : t.split.second} users={active} hydrated={hydrated} dragging={dragging} tl={tl} />
      </div>
    </div>
  );
}

function Pane({
  id,
  set,
  label,
  users,
  hydrated,
  dragging,
  tl,
}: {
  id: string;
  set: (id: string) => void;
  label: string;
  users: ReturnType<typeof useEngine.getState>["db"]["users"];
  hydrated: boolean;
  dragging: boolean;
  tl: (l: { ar: string; en: string }) => string;
}) {
  const u = users.find((x) => x.id === id) ?? users[0];
  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/40 px-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        {u && <PersonAvatar user={u} size={18} />}
        <select value={id} onChange={(e) => set(e.target.value)} className="h-7 max-w-[60%] rounded-md border bg-background px-1.5 text-xs">
          {users.map((x) => (
            <option key={x.id} value={x.id}>
              {tl(x.name)} · {tl(x.title)}
            </option>
          ))}
        </select>
      </div>
      {hydrated && (
        <iframe
          key={id}
          src={`${BP}/app/?persona=${id}&frame=1`}
          title={u ? tl(u.name) : label}
          className={cn("min-h-0 w-full flex-1 border-0", dragging && "pointer-events-none")}
        />
      )}
    </section>
  );
}
