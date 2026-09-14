"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "cn";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, X } from "lucide-react";
import { useEngine } from "@/lib/engine/store";
import { STEP_SPECS, TOUR_STEPS, discoverRoot, useTour, type TourStepId } from "@/lib/engine/tour";
import { useT, useFmt, fill } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/common";

/** The guided tour card. Lives in the app shell; drives persona, route, sheet and highlights. */
export function Tour() {
  const { t, tl } = useT();
  const { fmtNum } = useFmt();
  const router = useRouter();
  const pathname = usePathname();
  const active = useTour((s) => s.active);
  const index = useTour((s) => s.index);
  const startedAt = useTour((s) => s.startedAt);
  const refs = useTour((s) => s.refs);
  const setRefs = useTour((s) => s.setRefs);
  const next = useTour((s) => s.next);
  const prev = useTour((s) => s.prev);
  const stop = useTour((s) => s.stop);

  const db = useEngine((s) => s.db);
  const currentUserId = useEngine((s) => s.session.currentUserId);
  const setCurrentUser = useEngine((s) => s.setCurrentUser);
  const openRequest = useEngine((s) => s.openRequest);

  const stepId: TourStepId = TOUR_STEPS[index];
  const spec = STEP_SPECS[stepId];
  // phones get a compact card; the instructions unfold on tap
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(index === 0), [index]);

  // phones: content is pushed down by the card height so nothing hides under it
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.style.removeProperty("--tour-h");
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => root.style.setProperty("--tour-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--tour-h");
    };
  }, [active]);

  // pick up the request even when the user created it by hand
  useEffect(() => {
    if (!active || !startedAt) return;
    const root = discoverRoot(db, refs, startedAt);
    if (root && refs.rootId !== root.id) setRefs({ rootId: root.id });
    if (root) {
      const ids = db.requests.filter((r) => r.parentId === root.id).map((r) => r.id);
      if (ids.length !== refs.subIds.length) setRefs({ subIds: ids });
    }
  }, [active, startedAt, db, refs, setRefs]);

  const done = useMemo(() => (active && startedAt ? spec.done(db, refs, startedAt) : false), [active, startedAt, spec, db, refs]);

  // entering a step: persona, route, open request, lines view
  useEffect(() => {
    if (!active) return;
    if (spec.persona && spec.persona !== currentUserId) setCurrentUser(spec.persona);
    if (pathname !== spec.route) router.push(spec.route);
    const id = spec.open(refs);
    const timer = setTimeout(() => openRequest(id), 150);
    if (stepId === "lines") spec.run(refs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  // highlight the element the step talks about
  useEffect(() => {
    if (!active || !spec.target) return;
    let el: Element | null = null;
    const tick = () => {
      const found = document.querySelector(`[data-tour="${spec.target}"]`);
      if (found && found !== el) {
        el?.classList.remove("tour-target");
        el = found;
        el.classList.add("tour-target");
      }
    };
    tick();
    const iv = setInterval(tick, 400);
    return () => {
      clearInterval(iv);
      el?.classList.remove("tour-target");
    };
  }, [active, index, spec.target, done]);

  if (!active) return null;

  const persona = spec.persona ? db.users.find((u) => u.id === spec.persona) : null;
  const copy = t.tour.steps[stepId];
  const last = index === TOUR_STEPS.length - 1;
  const hasRun = stepId !== "intro" && stepId !== "end" && stepId !== "notifications" && stepId !== "lines";

  return (
    <div
      ref={cardRef}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-x-2 top-[3.9rem] z-[70] rounded-2xl border border-primary/40 bg-card p-2.5 shadow-2xl md:inset-x-auto md:top-auto md:bottom-4 md:start-4 md:w-[380px] md:p-3.5"
      role="dialog"
      aria-label={t.tour.title}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[11px] font-semibold text-primary tabular">
          {fill(t.tour.progress, { n: fmtNum(index + 1), total: fmtNum(TOUR_STEPS.length) })}
        </span>
        {persona && (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <PersonAvatar user={persona} size={18} />
            <span className="truncate">
              {t.tour.youAre} {tl(persona.name)} · {tl(persona.title)}
            </span>
          </span>
        )}
        <button onClick={stop} className="ms-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t.tour.stop}>
          <X className="size-3.5" />
        </button>
      </div>

      <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1.5 flex w-full items-start gap-2 text-start md:mt-2 md:cursor-default">
        <span className="min-w-0 flex-1">
          <h3 className="text-[13px] font-bold md:text-sm">{copy.title}</h3>
          <p className={cn("mt-0.5 text-[11px] leading-relaxed text-muted-foreground md:mt-1 md:text-xs", !expanded && "line-clamp-1 md:line-clamp-none")}>{copy.text}</p>
        </span>
        <span className="mt-0.5 text-muted-foreground md:hidden">{expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}</span>
      </button>

      <div className="mt-2 flex items-center gap-1.5 md:mt-3">
        <Button variant="ghost" size="sm" onClick={prev} disabled={index === 0}>
          <ChevronRight className="size-3.5 ltr:hidden" />
          <ChevronLeft className="size-3.5 rtl:hidden" />
          {t.tour.back}
        </Button>
        {hasRun && !done && (
          <Button size="sm" variant="outline" onClick={() => spec.run(refs)}>
            <Play className="size-3.5 rtl:-scale-x-100" />
            {t.tour.run}
          </Button>
        )}
        {hasRun && done && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stage-done">
            <Check className="size-3.5" />
            {t.tour.stepDone}
          </span>
        )}
        <span className="ms-auto" />
        {last ? (
          <Button size="sm" onClick={stop}>
            {t.tour.finish}
          </Button>
        ) : (
          <Button size="sm" onClick={next} disabled={!done} className={cn(!done && "opacity-60")}>
            {t.tour.next}
            <ChevronLeft className="size-3.5 ltr:hidden" />
            <ChevronRight className="size-3.5 rtl:hidden" />
          </Button>
        )}
      </div>
    </div>
  );
}
